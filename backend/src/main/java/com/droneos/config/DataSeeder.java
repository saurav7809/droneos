package com.droneos.config;

import com.droneos.entity.Drone;
import com.droneos.entity.FlightLog;
import com.droneos.entity.Mission;
import com.droneos.entity.User;
import com.droneos.repository.DroneRepository;
import com.droneos.repository.FlightLogRepository;
import com.droneos.repository.MissionRepository;
import com.droneos.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final DroneRepository droneRepository;
    private final MissionRepository missionRepository;
    private final FlightLogRepository flightLogRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (droneRepository.count() > 0) {
            log.info("Data already seeded, skipping.");
            return;
        }

        log.info("🌱 Seeding initial drone fleet data...");

        // ── Users ──────────────────────────────────────────────
        User admin = new User();
        admin.setUsername("admin");
        admin.setPasswordHash(passwordEncoder.encode("admin123"));
        admin.setRole("ADMIN");
        userRepository.save(admin);

        User pilot = new User();
        pilot.setUsername("pilot");
        pilot.setPasswordHash(passwordEncoder.encode("pilot123"));
        pilot.setRole("USER");
        userRepository.save(pilot);

        // ── Drone Fleet ────────────────────────────────────────
        Drone d1 = drone("Drone-01", "Flying",    86, 28.6139, 77.2090, 12.4, 110.0, "Mapping Mission");
        Drone d2 = drone("Drone-02", "Mission",   62, 28.6200, 77.2150,  8.1,  85.0, "Crop Monitoring");
        Drone d3 = drone("Drone-03", "Idle",     100, 28.6100, 77.2050,  0.0,   0.0, null);
        Drone d4 = drone("Drone-04", "Charging",  34, 28.6080, 77.2030,  0.0,   0.0, null);
        Drone d5 = drone("Drone-05", "Returning", 22, 28.6170, 77.2200, 15.0,  60.0, null);
        Drone d6 = drone("Drone-06", "Flying",    74, 28.6220, 77.2080, 10.5,  95.0, "Delivery");
        droneRepository.save(d1); droneRepository.save(d2); droneRepository.save(d3);
        droneRepository.save(d4); droneRepository.save(d5); droneRepository.save(d6);

        // ── Missions ───────────────────────────────────────────
        missionRepository.save(mission(d1, "Mapping",         "Base Alpha",    "Sector 7-G",      "Active",    18));
        missionRepository.save(mission(d2, "Crop Monitoring", "Farm HQ",       "Field Block 3",   "Active",    32));
        missionRepository.save(completedMission(d5, "Surveillance",  "Command Center","Perimeter East",  90, 12, 8.4,  56));
        missionRepository.save(completedMission(d3, "Delivery",      "Warehouse",     "Customer Site A", 180, 40, 12.1, 38));

        // ── Flight Logs ────────────────────────────────────────
        flightLogRepository.save(log(d1, "Mission started — Mapping Mission",                 "info",     18));
        flightLogRepository.save(log(d1, "Takeoff successful — altitude 110m",                "success",  17));
        flightLogRepository.save(log(d1, "Obstacle detected at bearing 120° — rerouting",    "warning",  15));
        flightLogRepository.save(log(d1, "Route clear, resuming mission",                    "info",     14));
        flightLogRepository.save(log(d2, "Crop scan sector A — 847 images captured",         "success",  10));
        flightLogRepository.save(log(d5, "Battery < 20% on Drone-05 — RTH initiated",       "critical",  8));

        log.info("✅ Seeded: 2 users, 6 drones, 4 missions, 6 flight logs");
    }

    private Drone drone(String name, String status, int battery,
                        double lat, double lon, double speed, double alt, String mission) {
        Drone d = new Drone();
        d.setName(name); d.setStatus(status); d.setBattery(battery);
        d.setLatitude(lat); d.setLongitude(lon);
        d.setSpeed(speed); d.setAltitude(alt);
        d.setMission(mission);
        d.setLastUpdated(LocalDateTime.now());
        return d;
    }

    private Mission mission(Drone drone, String type, String start, String dest,
                            String status, int minutesAgo) {
        Mission m = new Mission();
        m.setDrone(drone); m.setMissionType(type);
        m.setStartLocation(start); m.setDestination(dest);
        m.setStatus(status);
        m.setStartTime(LocalDateTime.now().minusMinutes(minutesAgo));
        m.setDistance(Math.random() * 10 + 2);
        return m;
    }

    private Mission completedMission(Drone drone, String type, String start, String dest,
                                     int startMinsAgo, int durationMins, double distance, int batteryUsed) {
        Mission m = mission(drone, type, start, dest, "Completed", startMinsAgo);
        m.setEndTime(LocalDateTime.now().minusMinutes(startMinsAgo - durationMins));
        m.setDistance(distance);
        m.setBatteryUsed(batteryUsed);
        return m;
    }

    private FlightLog log(Drone drone, String action, String type, int minutesAgo) {
        FlightLog log = new FlightLog();
        log.setDrone(drone); log.setAction(action); log.setType(type);
        log.setTimestamp(LocalDateTime.now().minusMinutes(minutesAgo));
        return log;
    }
}
