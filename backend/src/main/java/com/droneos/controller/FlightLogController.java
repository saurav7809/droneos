package com.droneos.controller;

import com.droneos.entity.FlightLog;
import com.droneos.repository.FlightLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
public class FlightLogController {

    private final FlightLogRepository flightLogRepository;

    @GetMapping
    public List<FlightLog> getAllLogs() {
        return flightLogRepository.findAllByOrderByTimestampDesc();
    }

    @GetMapping("/{droneId}")
    public List<FlightLog> getLogsByDrone(@PathVariable Long droneId) {
        return flightLogRepository.findByDroneIdOrderByTimestampDesc(droneId);
    }
}
