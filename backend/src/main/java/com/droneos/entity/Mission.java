package com.droneos.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "missions")
@Data
@NoArgsConstructor
public class Mission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "drone_id", nullable = false)
    private Drone drone;

    @Column(name = "mission_type", nullable = false)
    private String missionType;

    @Column(name = "start_location")
    private String startLocation;

    private String destination;

    private String status = "Planned"; // Planned, Active, Completed, Cancelled, Aborted

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    private Double distance;
    private Double altitude;
    private Double speed;

    @Column(name = "battery_used")
    private Integer batteryUsed;
}
