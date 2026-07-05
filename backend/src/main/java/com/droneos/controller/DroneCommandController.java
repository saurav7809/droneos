package com.droneos.controller;

import com.droneos.entity.Drone;
import com.droneos.entity.FlightLog;
import com.droneos.repository.DroneRepository;
import com.droneos.repository.FlightLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/drones/{id}/commands")
@RequiredArgsConstructor
@Slf4j
public class DroneCommandController {

    private final DroneRepository droneRepository;
    private final FlightLogRepository flightLogRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * POST /api/drones/{id}/commands
     * Body: { "command": "RTH" | "LAND" | "HOVER" | "RESUME" | "TAKEOFF" | "ABORT" }
     */
    @PostMapping
    public ResponseEntity<?> sendCommand(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String command = body.getOrDefault("command", "").toUpperCase().trim();
        if (command.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "command is required"));
        }

        Drone drone = droneRepository.findById(id)
                .orElse(null);
        if (drone == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Drone not found"));
        }

        String previousStatus = drone.getStatus();
        String logMessage;

        switch (command) {
            case "RTH" -> {
                if (!isActive(drone)) {
                    return badRequest("Drone is not currently active (status: " + drone.getStatus() + ")");
                }
                drone.setStatus("Returning");
                drone.setMission(null);
                logMessage = "RTH command received — returning to home base";
            }
            case "LAND" -> {
                if (!isActive(drone)) {
                    return badRequest("Drone is not currently active");
                }
                drone.setStatus("Charging");
                drone.setAltitude(0.0);
                drone.setSpeed(0.0);
                drone.setMission(null);
                logMessage = "LAND command received — drone landing immediately";
            }
            case "HOVER" -> {
                if (!isActive(drone)) {
                    return badRequest("Drone is not currently airborne");
                }
                drone.setStatus("Flying");
                drone.setSpeed(0.0);
                logMessage = "HOVER command received — drone holding position";
            }
            case "RESUME" -> {
                if (!"Idle".equals(drone.getStatus())) {
                    return badRequest("Drone must be Idle to resume, currently: " + drone.getStatus());
                }
                drone.setStatus("Flying");
                logMessage = "RESUME command received — drone resuming patrol";
            }
            case "TAKEOFF" -> {
                if (!"Idle".equals(drone.getStatus()) && !"Charging".equals(drone.getStatus())) {
                    return badRequest("Drone must be Idle or Charging to take off");
                }
                if (drone.getBattery() < 20) {
                    return badRequest("Battery too low to take off (" + drone.getBattery() + "%)");
                }
                drone.setStatus("Flying");
                drone.setAltitude(50.0);
                drone.setSpeed(5.0);
                logMessage = "TAKEOFF command received — drone ascending";
            }
            case "ABORT" -> {
                drone.setStatus("Returning");
                drone.setMission(null);
                logMessage = "ABORT command received — mission cancelled, returning to base";
            }
            default -> {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Unknown command: " + command +
                                ". Valid: RTH, LAND, HOVER, RESUME, TAKEOFF, ABORT"));
            }
        }

        drone.setLastUpdated(LocalDateTime.now());
        droneRepository.save(drone);

        // Log the command
        FlightLog entry = new FlightLog();
        entry.setDrone(drone);
        entry.setAction("[CMD:" + command + "] " + logMessage);
        entry.setType("info");
        flightLogRepository.save(entry);
        log.info("Command '{}' sent to {} (was: {})", command, drone.getName(), previousStatus);

        // Push updated drone list via WebSocket
        try {
            messagingTemplate.convertAndSend("/topic/drones", droneRepository.findAll());
        } catch (Exception e) {
            log.warn("WebSocket push after command failed: {}", e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "command", command,
                "drone", drone.getName(),
                "newStatus", drone.getStatus(),
                "message", logMessage
        ));
    }

    /**
     * GET /api/drones/{id}/commands/status
     * Returns available commands for this drone based on its current state.
     */
    @GetMapping("/status")
    public ResponseEntity<?> getAvailableCommands(@PathVariable Long id) {
        Drone drone = droneRepository.findById(id)
                .orElse(null);
        if (drone == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Drone not found"));
        }

        List<String> available = switch (drone.getStatus()) {
            case "Flying", "Mission" -> List.of("RTH", "LAND", "HOVER", "ABORT");
            case "Returning" -> List.of("LAND", "ABORT");
            case "Idle" -> List.of("TAKEOFF", "RESUME");
            case "Charging" -> List.of("TAKEOFF");
            default -> List.of();
        };

        return ResponseEntity.ok(Map.of(
                "droneId", id,
                "droneName", drone.getName(),
                "status", drone.getStatus(),
                "battery", drone.getBattery(),
                "availableCommands", available
        ));
    }

    private boolean isActive(Drone drone) {
        return "Flying".equals(drone.getStatus()) || "Mission".equals(drone.getStatus());
    }

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }
}
