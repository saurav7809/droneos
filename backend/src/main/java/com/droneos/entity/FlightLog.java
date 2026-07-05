package com.droneos.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "flight_logs")
@Data
@NoArgsConstructor
public class FlightLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "drone_id", nullable = false)
    private Drone drone;

    @Column(nullable = false)
    private String action;

    private String type = "info"; // info, warning, critical, success, ai

    private LocalDateTime timestamp = LocalDateTime.now();
}
