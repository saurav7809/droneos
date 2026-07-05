package com.droneos.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "drones")
@Data
@NoArgsConstructor
public class Drone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private String status = "Idle"; // Flying, Idle, Charging, Error, Returning, Mission

    private Integer battery = 100;
    private Double latitude = 28.6100;
    private Double longitude = 77.2050;
    private Double speed = 0.0;
    private Double altitude = 0.0;
    private String mission;

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated = LocalDateTime.now();
}
