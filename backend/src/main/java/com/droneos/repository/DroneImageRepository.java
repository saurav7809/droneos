package com.droneos.repository;

import com.droneos.entity.DroneImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DroneImageRepository extends JpaRepository<DroneImage, Long> {
    List<DroneImage> findByDroneIdOrderByCapturedAtDesc(Long droneId);
    List<DroneImage> findAllByOrderByCapturedAtDesc();
}
