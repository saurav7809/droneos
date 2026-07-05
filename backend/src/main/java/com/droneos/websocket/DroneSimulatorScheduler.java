package com.droneos.websocket;

import com.droneos.entity.Drone;
import com.droneos.entity.FlightLog;
import com.droneos.repository.DroneRepository;
import com.droneos.repository.FlightLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Real-life drone flight simulator:
 * - Accurate GPS movement toward waypoints
 * - Battery drain based on speed + altitude
 * - Auto RTH at 20%, auto-land at 5%
 * - Obstacle events, mission phases
 * - WebSocket broadcasts: /topic/drones + /topic/alerts
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DroneSimulatorScheduler {

    private final DroneRepository droneRepository;
    private final FlightLogRepository flightLogRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private final Random rng = new Random();

    // Waypoint missions per drone (circular routes)
    private static final double[][] WAYPOINTS = {
        {28.6200, 77.2150}, {28.6220, 77.2080}, {28.6170, 77.2000},
        {28.6100, 77.2020}, {28.6080, 77.2120}, {28.6130, 77.2200},
    };

    // Per-drone waypoint tracking
    private final Map<Long, Integer> waypointIndex   = new HashMap<>();
    private final Map<Long, Boolean> obstacleActive  = new HashMap<>();
    private final Map<Long, Integer> obstacleTimer   = new HashMap<>();

    @Scheduled(fixedRate = 2000)
    public void simulateTelemetry() {
        List<Drone> drones = droneRepository.findAll();
        List<Map<String, Object>> alerts = new ArrayList<>();

        for (Drone drone : drones) {
            List<Map<String, Object>> droneAlerts = tick(drone);
            alerts.addAll(droneAlerts);
        }

        droneRepository.saveAll(drones);

        // Broadcast drone list
        try {
            messagingTemplate.convertAndSend("/topic/drones", drones);
        } catch (Exception e) {
            log.warn("Drone broadcast failed: {}", e.getMessage());
        }

        // Broadcast alerts (if any)
        if (!alerts.isEmpty()) {
            try {
                messagingTemplate.convertAndSend("/topic/alerts", alerts);
            } catch (Exception e) {
                log.warn("Alert broadcast failed: {}", e.getMessage());
            }
        }
    }

    private List<Map<String, Object>> tick(Drone drone) {
        List<Map<String, Object>> alerts = new ArrayList<>();

        switch (drone.getStatus()) {

            case "Flying", "Mission" -> {
                // ── Physics-based battery drain ─────────────────
                double drainRate = 0.06 + (drone.getSpeed() / 100.0) + (drone.getAltitude() / 5000.0);
                double newBattery = drone.getBattery() - drainRate;

                // ── Critical battery threshold ───────────────────
                if (newBattery <= 5 && drone.getBattery() > 5) {
                    drone.setStatus("Returning");
                    drone.setMission(null);
                    alerts.add(alert(drone, "CRITICAL", "🔴 Battery critical (" + (int)newBattery + "%) — Emergency RTH initiated", "critical"));
                    logEvent(drone, "Battery critical — Emergency RTH", "critical");
                } else if (newBattery <= 20 && drone.getBattery() > 20) {
                    drone.setStatus("Returning");
                    drone.setMission(null);
                    alerts.add(alert(drone, "WARNING", "⚠ Battery low (" + (int)newBattery + "%) — Return to home initiated", "warning"));
                    logEvent(drone, "Battery < 20% — Auto RTH triggered", "warning");
                } else {
                    drone.setBattery((int) Math.max(0, newBattery));
                }

                // ── Waypoint navigation ──────────────────────────
                int wpIdx = waypointIndex.getOrDefault(drone.getId(), (int)(drone.getId() % WAYPOINTS.length));
                double[] target = WAYPOINTS[wpIdx % WAYPOINTS.length];
                double lat = drone.getLatitude();
                double lon = drone.getLongitude();
                double dLat = target[0] - lat;
                double dLon = target[1] - lon;
                double dist  = Math.sqrt(dLat*dLat + dLon*dLon);

                if (dist < 0.0008) {
                    // Reached waypoint — advance
                    int nextWp = (wpIdx + 1) % WAYPOINTS.length;
                    waypointIndex.put(drone.getId(), nextWp);
                    if (nextWp == 0) {
                        alerts.add(alert(drone, "INFO", "✅ " + drone.getName() + " completed circuit — mission loop restarted", "info"));
                    }
                } else {
                    // Move toward waypoint with realistic speed
                    double step = 0.0006 + rng.nextDouble() * 0.0002;
                    drone.setLatitude(lat + (dLat / dist) * step);
                    drone.setLongitude(lon + (dLon / dist) * step);
                }

                // ── Realistic speed and altitude ─────────────────
                double targetSpeed = 8 + rng.nextGaussian() * 1.5;
                drone.setSpeed(Math.max(3, Math.min(22, drone.getSpeed() * 0.8 + targetSpeed * 0.2)));
                double targetAlt = 80 + rng.nextGaussian() * 10;
                drone.setAltitude(Math.max(50, Math.min(200, drone.getAltitude() * 0.9 + targetAlt * 0.1)));

                // ── Random obstacle event (1% per tick) ──────────
                if (!obstacleActive.getOrDefault(drone.getId(), false) && rng.nextInt(100) < 1) {
                    obstacleActive.put(drone.getId(), true);
                    obstacleTimer.put(drone.getId(), 5);
                    drone.setAltitude(drone.getAltitude() + 20); // climb to avoid
                    alerts.add(alert(drone, "WARNING", "⚡ " + drone.getName() + " — obstacle detected, altitude increased to avoid", "warning"));
                    logEvent(drone, "Obstacle detected — altitude increased", "warning");
                }

                // ── Obstacle timer countdown ─────────────────────
                if (obstacleActive.getOrDefault(drone.getId(), false)) {
                    int t = obstacleTimer.getOrDefault(drone.getId(), 0) - 1;
                    if (t <= 0) {
                        obstacleActive.put(drone.getId(), false);
                        alerts.add(alert(drone, "INFO", "✅ " + drone.getName() + " — obstacle cleared, resuming mission", "info"));
                    } else {
                        obstacleTimer.put(drone.getId(), t);
                    }
                }
            }

            case "Returning" -> {
                // ── Navigate home ────────────────────────────────
                final double HOME_LAT = 28.6100, HOME_LON = 77.2050;
                double dLat = HOME_LAT - drone.getLatitude();
                double dLon = HOME_LON - drone.getLongitude();
                double dist = Math.sqrt(dLat*dLat + dLon*dLon);
                double drain = 0.08 + (drone.getSpeed() / 80.0);
                drone.setBattery((int) Math.max(0, drone.getBattery() - drain));

                if (dist < 0.0005) {
                    drone.setLatitude(HOME_LAT);
                    drone.setLongitude(HOME_LON);
                    drone.setStatus("Charging");
                    drone.setAltitude(0.0);
                    drone.setSpeed(0.0);
                    alerts.add(alert(drone, "SUCCESS", "🏠 " + drone.getName() + " landed safely — charging started", "success"));
                    logEvent(drone, "Landed — charging started", "success");
                } else {
                    double step = 0.001;
                    drone.setLatitude(drone.getLatitude() + (dLat / dist) * step);
                    drone.setLongitude(drone.getLongitude() + (dLon / dist) * step);
                    drone.setAltitude(Math.max(0, drone.getAltitude() - 3));
                    drone.setSpeed(Math.max(4, Math.min(18, drone.getSpeed() * 0.85 + 12 * 0.15)));
                }
            }

            case "Charging" -> {
                // ── Charge at 0.5%/tick (1%/sec) ────────────────
                int charge = Math.min(100, drone.getBattery() + 1);
                drone.setBattery(charge);
                drone.setSpeed(0.0);
                drone.setAltitude(0.0);
                if (charge >= 100) {
                    drone.setStatus("Idle");
                    alerts.add(alert(drone, "SUCCESS", "🔋 " + drone.getName() + " fully charged — ready for mission", "success"));
                    logEvent(drone, "Fully charged — status: Idle", "info");
                }
            }

            case "Idle" -> {
                drone.setSpeed(0.0);
                drone.setAltitude(0.0);
            }
        }

        drone.setLastUpdated(LocalDateTime.now());
        return alerts;
    }

    private Map<String, Object> alert(Drone drone, String level, String message, String type) {
        return Map.of(
            "droneId",   drone.getId(),
            "droneName", drone.getName(),
            "level",     level,
            "message",   message,
            "type",      type,
            "timestamp", LocalDateTime.now().toString()
        );
    }

    private void logEvent(Drone drone, String action, String type) {
        try {
            FlightLog entry = new FlightLog();
            entry.setDrone(drone);
            entry.setAction(action);
            entry.setType(type);
            flightLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("Failed to save flight log: {}", e.getMessage());
        }
    }
}
