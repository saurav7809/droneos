package com.droneos.repository;

import com.droneos.entity.Mission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MissionRepository extends JpaRepository<Mission, Long> {
    List<Mission> findByDroneIdOrderByStartTimeDesc(Long droneId);
    List<Mission> findByDroneId(Long droneId);
    List<Mission> findAllByOrderByStartTimeDesc();
}
