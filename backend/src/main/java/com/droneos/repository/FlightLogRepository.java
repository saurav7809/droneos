package com.droneos.repository;

import com.droneos.entity.FlightLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FlightLogRepository extends JpaRepository<FlightLog, Long> {
    List<FlightLog> findByDroneIdOrderByTimestampDesc(Long droneId);
    List<FlightLog> findAllByOrderByTimestampDesc();
}
