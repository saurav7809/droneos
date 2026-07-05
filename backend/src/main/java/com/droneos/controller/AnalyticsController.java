package com.droneos.controller;

import com.droneos.entity.Drone;
import com.droneos.entity.Mission;
import com.droneos.repository.DroneRepository;
import com.droneos.repository.FlightLogRepository;
import com.droneos.repository.MissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final DroneRepository droneRepository;
    private final MissionRepository missionRepository;
    private final FlightLogRepository flightLogRepository;

    /**
     * GET /api/analytics/fleet
     * Returns fleet-wide analytics: status distribution, avg battery, mission stats.
     */
    @GetMapping("/fleet")
    public ResponseEntity<?> getFleetAnalytics() {
        List<Drone> drones = droneRepository.findAll();
        List<Mission> missions = missionRepository.findAll();

        // Status breakdown
        Map<String, Long> statusCounts = drones.stream()
                .collect(Collectors.groupingBy(Drone::getStatus, Collectors.counting()));

        // Battery stats
        double avgBattery = drones.stream()
                .mapToInt(d -> d.getBattery() != null ? d.getBattery() : 0)
                .average().orElse(0);
        long lowBatteryCount = drones.stream()
                .filter(d -> d.getBattery() != null && d.getBattery() < 20)
                .count();

        // Mission stats
        Map<String, Long> missionStatusCounts = missions.stream()
                .collect(Collectors.groupingBy(Mission::getStatus, Collectors.counting()));

        double totalDistance = missions.stream()
                .filter(m -> m.getDistance() != null)
                .mapToDouble(Mission::getDistance)
                .sum();

        double avgDistance = missions.stream()
                .filter(m -> m.getDistance() != null && m.getStatus().equals("Completed"))
                .mapToDouble(Mission::getDistance)
                .average().orElse(0);

        // Mission type breakdown
        Map<String, Long> missionTypeCounts = missions.stream()
                .collect(Collectors.groupingBy(Mission::getMissionType, Collectors.counting()));

        // Fleet health score (0-100)
        long activeCount = drones.stream()
                .filter(d -> "Flying".equals(d.getStatus()) || "Mission".equals(d.getStatus()))
                .count();
        long errorCount = drones.stream().filter(d -> "Error".equals(d.getStatus())).count();
        double healthScore = drones.isEmpty() ? 100 :
                ((avgBattery * 0.4) + (((double)(drones.size() - errorCount) / drones.size()) * 60));

        Map<String, Object> analytics = new HashMap<>();
        analytics.put("totalDrones", drones.size());
        analytics.put("activeDrones", activeCount);
        analytics.put("avgBatteryPct", Math.round(avgBattery));
        analytics.put("lowBatteryCount", lowBatteryCount);
        analytics.put("statusBreakdown", statusCounts);
        analytics.put("totalMissions", missions.size());
        analytics.put("missionStatusBreakdown", missionStatusCounts);
        analytics.put("missionTypeBreakdown", missionTypeCounts);
        analytics.put("totalDistanceKm", Math.round(totalDistance * 10.0) / 10.0);
        analytics.put("avgMissionDistanceKm", Math.round(avgDistance * 10.0) / 10.0);
        analytics.put("fleetHealthScore", Math.round(healthScore));
        analytics.put("logCount", flightLogRepository.count());

        return ResponseEntity.ok(analytics);
    }

    /**
     * GET /api/analytics/drone/{id}
     * Returns per-drone statistics: mission history, battery trend, total flight time.
     */
    @GetMapping("/drone/{id}")
    public ResponseEntity<?> getDroneAnalytics(@PathVariable Long id) {
        return droneRepository.findById(id).map(drone -> {
            List<Mission> droneMissions = missionRepository.findByDroneId(id);
            long completed = droneMissions.stream().filter(m -> "Completed".equals(m.getStatus())).count();
            double totalDist = droneMissions.stream().filter(m -> m.getDistance() != null).mapToDouble(Mission::getDistance).sum();
            long totalMinutes = droneMissions.stream().filter(m -> m.getEndTime() != null && m.getStartTime() != null)
                    .mapToLong(m -> java.time.Duration.between(m.getStartTime(), m.getEndTime()).toMinutes())
                    .sum();

            Map<String, Object> stats = new HashMap<>();
            stats.put("droneId", drone.getId());
            stats.put("droneName", drone.getName());
            stats.put("totalMissions", droneMissions.size());
            stats.put("completedMissions", completed);
            stats.put("successRate", droneMissions.isEmpty() ? 0 : Math.round((double) completed / droneMissions.size() * 100));
            stats.put("totalDistanceKm", Math.round(totalDist * 10.0) / 10.0);
            stats.put("totalFlightMinutes", totalMinutes);
            stats.put("currentBattery", drone.getBattery());
            stats.put("currentStatus", drone.getStatus());
            stats.put("missions", droneMissions.stream().map(m -> Map.of(
                    "id", m.getId(),
                    "type", m.getMissionType(),
                    "status", m.getStatus(),
                    "distance", m.getDistance() != null ? m.getDistance() : 0,
                    "startTime", m.getStartTime() != null ? m.getStartTime().toString() : ""
            )).collect(Collectors.toList()));

            return ResponseEntity.ok(stats);
        }).orElse(ResponseEntity.notFound().build());
    }
}
