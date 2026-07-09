package com.droneos.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/")
public class HomeController {

    @GetMapping
    public ResponseEntity<?> home() {
        return ResponseEntity.ok(Map.of(
                "service", "DroneOS Backend API",
                "status", "UP",
                "version", "1.0.0",
                "timestamp", Instant.now().toString(),
                "endpoints", Map.of(
                        "auth", "/api/auth/login  |  /api/auth/register",
                        "drones", "/api/drones",
                        "missions", "/api/missions",
                        "health", "/actuator/health"
                )
        ));
    }
}
