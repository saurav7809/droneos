package com.droneos.controller;

import com.droneos.entity.Drone;
import com.droneos.repository.DroneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drones")
@RequiredArgsConstructor
public class DroneController {

    private final DroneRepository droneRepository;

    @GetMapping
    public List<Drone> getAllDrones() {
        return droneRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Drone> getDrone(@PathVariable Long id) {
        return droneRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Drone> updateDrone(@PathVariable Long id, @RequestBody Drone update) {
        return droneRepository.findById(id).map(drone -> {
            if (update.getStatus() != null) drone.setStatus(update.getStatus());
            if (update.getBattery() != null) drone.setBattery(update.getBattery());
            if (update.getLatitude() != null) drone.setLatitude(update.getLatitude());
            if (update.getLongitude() != null) drone.setLongitude(update.getLongitude());
            if (update.getSpeed() != null) drone.setSpeed(update.getSpeed());
            if (update.getAltitude() != null) drone.setAltitude(update.getAltitude());
            drone.setLastUpdated(java.time.LocalDateTime.now());
            return ResponseEntity.ok(droneRepository.save(drone));
        }).orElse(ResponseEntity.notFound().build());
    }
}
