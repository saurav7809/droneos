package com.droneos.controller;

import com.droneos.entity.Drone;
import com.droneos.entity.FlightLog;
import com.droneos.entity.Mission;
import com.droneos.repository.DroneRepository;
import com.droneos.repository.FlightLogRepository;
import com.droneos.repository.MissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/missions")
@RequiredArgsConstructor
public class MissionController {

    private final MissionRepository missionRepository;
    private final DroneRepository droneRepository;
    private final FlightLogRepository flightLogRepository;

    @GetMapping
    public List<Mission> getAllMissions() {
        return missionRepository.findAllByOrderByStartTimeDesc();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Mission> getMission(@PathVariable Long id) {
        return missionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createMission(@RequestBody Map<String, Object> body) {
        Long droneId = Long.valueOf(body.get("droneId").toString());
        Drone drone = droneRepository.findById(droneId)
                .orElse(null);
        if (drone == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Drone not found"));
        }

        Mission mission = new Mission();
        mission.setDrone(drone);
        mission.setMissionType(body.get("missionType").toString());
        mission.setStartLocation(body.getOrDefault("startLocation", "Base Alpha").toString());
        mission.setDestination(body.get("destination").toString());
        mission.setAltitude(Double.valueOf(body.getOrDefault("altitude", "100").toString()));
        mission.setSpeed(Double.valueOf(body.getOrDefault("speed", "12").toString()));
        mission.setStatus("Active");
        mission.setStartTime(LocalDateTime.now());
        Mission saved = missionRepository.save(mission);

        // Update drone status
        drone.setStatus("Mission");
        drone.setMission(mission.getMissionType());
        drone.setLastUpdated(LocalDateTime.now());
        droneRepository.save(drone);

        // Log it
        FlightLog log = new FlightLog();
        log.setDrone(drone);
        log.setAction("Mission started: " + mission.getMissionType() + " → " + mission.getDestination());
        log.setType("info");
        flightLogRepository.save(log);

        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Mission> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return missionRepository.findById(id).map(m -> {
            m.setStatus(body.get("status"));
            if ("Completed".equals(body.get("status")) || "Cancelled".equals(body.get("status"))) {
                m.setEndTime(LocalDateTime.now());
            }
            return ResponseEntity.ok(missionRepository.save(m));
        }).orElse(ResponseEntity.notFound().build());
    }
}
