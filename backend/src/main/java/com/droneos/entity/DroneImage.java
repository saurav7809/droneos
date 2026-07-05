package com.droneos.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "drone_images")
@Data
@NoArgsConstructor
public class DroneImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "drone_id", nullable = false)
    private Drone drone;

    @Column(name = "image_path")
    private String imagePath;

    private String prediction;
    private Float confidence;

    @Column(name = "captured_at")
    private LocalDateTime capturedAt = LocalDateTime.now();
}
