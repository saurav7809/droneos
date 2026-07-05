package com.droneos.repository;

import com.droneos.entity.Drone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DroneRepository extends JpaRepository<Drone, Long> {
    Optional<Drone> findByName(String name);
}
