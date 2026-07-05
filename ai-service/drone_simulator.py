"""
Drone Simulator
Simulates GPS movement, battery drain, obstacle generation,
and synthetic camera image generation using OpenCV.
"""
import math
import random
import time
import numpy as np
import cv2
import base64
from dataclasses import dataclass, field, asdict
from typing import List, Optional


@dataclass
class Obstacle:
    x: float
    y: float
    radius: float = 50.0
    type: str = "building"


@dataclass
class DroneState:
    id: int
    name: str
    status: str = "Idle"
    battery: float = 100.0
    latitude: float = 28.6100
    longitude: float = 77.2050
    speed: float = 0.0
    altitude: float = 0.0
    mission: Optional[str] = None
    heading: float = 0.0
    obstacles: List[dict] = field(default_factory=list)
    last_updated: float = field(default_factory=time.time)
    waypoints: List[dict] = field(default_factory=list)
    current_waypoint: int = 0


BASE_LAT = 28.6100
BASE_LON = 77.2050


class DroneSimulator:
    def __init__(self):
        self.drones: dict[int, DroneState] = {}
        self._init_fleet()

    def _init_fleet(self):
        configs = [
            (1, "Drone-01", "Flying", 86, 28.6139, 77.2090, 12.4, 110, "Mapping Mission"),
            (2, "Drone-02", "Mission", 62, 28.6200, 77.2150, 8.1, 85, "Crop Monitoring"),
            (3, "Drone-03", "Idle", 100, 28.6100, 77.2050, 0, 0, None),
            (4, "Drone-04", "Charging", 34, 28.6080, 77.2030, 0, 0, None),
            (5, "Drone-05", "Returning", 22, 28.6170, 77.2200, 15.0, 60, None),
            (6, "Drone-06", "Flying", 74, 28.6220, 77.2080, 10.5, 95, "Delivery"),
        ]
        for cfg in configs:
            d = DroneState(
                id=cfg[0], name=cfg[1], status=cfg[2], battery=cfg[3],
                latitude=cfg[4], longitude=cfg[5], speed=cfg[6],
                altitude=cfg[7], mission=cfg[8]
            )
            # Generate random obstacles
            d.obstacles = self._generate_obstacles(d.latitude, d.longitude)
            self.drones[cfg[0]] = d

    def _generate_obstacles(self, base_lat, base_lon, count=5):
        obstacles = []
        for _ in range(count):
            obstacles.append({
                "lat": base_lat + (random.random() - 0.5) * 0.02,
                "lon": base_lon + (random.random() - 0.5) * 0.02,
                "radius": random.randint(30, 120),
                "type": random.choice(["building", "tree", "power_line", "restricted_area"])
            })
        return obstacles

    def step(self, drone_id: int) -> dict:
        if drone_id not in self.drones:
            drone_id = 1
        drone = self.drones[drone_id]
        self._simulate_step(drone)
        result = asdict(drone)
        result["camera_image"] = self._generate_camera_image(drone)
        return result

    def get_all_states(self) -> List[dict]:
        results = []
        for drone in self.drones.values():
            self._simulate_step(drone)
            results.append(asdict(drone))
        return results

    def _simulate_step(self, drone: DroneState):
        if drone.status in ("Flying", "Mission"):
            drain = 0.08
            drone.battery = max(0, drone.battery - drain)
            if drone.battery < 20:
                drone.status = "Returning"
            else:
                lat_delta = (random.random() - 0.5) * 0.0015
                lon_delta = (random.random() - 0.5) * 0.0015
                drone.latitude += lat_delta
                drone.longitude += lon_delta
                drone.altitude = max(50, min(200, drone.altitude + (random.random() - 0.5) * 3))
                drone.speed = max(5, min(20, drone.speed + (random.random() - 0.5) * 0.5))
                # Check obstacles
                drone.obstacles = self._generate_obstacles(drone.latitude, drone.longitude, 3)

        elif drone.status == "Returning":
            drone.battery = max(0, drone.battery - 0.15)
            lat_delta = (BASE_LAT - drone.latitude) * 0.02
            lon_delta = (BASE_LON - drone.longitude) * 0.02
            drone.latitude += lat_delta
            drone.longitude += lon_delta
            dist = math.sqrt((drone.latitude - BASE_LAT) ** 2 + (drone.longitude - BASE_LON) ** 2)
            if dist < 0.001:
                drone.status = "Charging"
                drone.altitude = 0
                drone.speed = 0

        elif drone.status == "Charging":
            drone.battery = min(100, drone.battery + 0.5)
            if drone.battery >= 100:
                drone.status = "Idle"

        drone.last_updated = time.time()

    def _generate_camera_image(self, drone: DroneState) -> str:
        """Generate a synthetic aerial camera image using OpenCV."""
        try:
            img = np.zeros((480, 640, 3), dtype=np.uint8)

            # Sky/ground gradient
            for y in range(480):
                ratio = y / 480
                r = int(10 + ratio * 20)
                g = int(15 + ratio * 35)
                b = int(25 + ratio * 30)
                img[y, :] = [b, g, r]

            # Draw ground features
            # Roads
            cv2.line(img, (0, 240), (640, 240), (60, 60, 70), 8)
            cv2.line(img, (320, 0), (320, 480), (60, 60, 70), 6)

            # Buildings
            buildings = [(100, 150, 80, 100), (400, 180, 60, 80), (250, 300, 90, 70), (500, 350, 50, 60)]
            for bx, by, bw, bh in buildings:
                color = (random.randint(50, 80), random.randint(60, 90), random.randint(50, 80))
                cv2.rectangle(img, (bx, by), (bx + bw, by + bh), color, -1)
                cv2.rectangle(img, (bx, by), (bx + bw, by + bh), (90, 110, 90), 1)

            # Trees (green circles)
            for _ in range(8):
                cx = random.randint(20, 620)
                cy = random.randint(20, 460)
                r = random.randint(8, 20)
                cv2.circle(img, (cx, cy), r, (20, 80 + random.randint(0, 40), 20), -1)

            # Vehicles
            for _ in range(4):
                vx = random.randint(50, 590)
                vy = random.randint(100, 380)
                cv2.rectangle(img, (vx, vy), (vx + 12, vy + 20), (random.randint(100, 200), random.randint(80, 180), 80), -1)

            # HUD overlays
            status_text = f"DRONE: {drone.name} | ALT: {drone.altitude:.0f}m | BAT: {drone.battery:.0f}%"
            cv2.putText(img, status_text, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 220, 255), 1)
            cv2.putText(img, f"GPS: {drone.latitude:.4f}N {drone.longitude:.4f}E", (10, 38),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 200), 1)

            # Detection boxes (simulated)
            num_detections = random.randint(0, 4)
            labels = ["Person", "Vehicle", "Tree", "Building", "Fire"]
            for _ in range(num_detections):
                dx = random.randint(50, 550)
                dy = random.randint(50, 380)
                dw = random.randint(30, 100)
                dh = random.randint(30, 100)
                label = random.choice(labels)
                conf = random.uniform(0.6, 0.98)
                color = (0, 255, 100) if label != "Fire" else (0, 80, 255)
                cv2.rectangle(img, (dx, dy), (dx + dw, dy + dh), color, 2)
                cv2.putText(img, f"{label} {conf:.0%}", (dx, dy - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1)

            # Encode to base64
            _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return base64.b64encode(buffer).decode('utf-8')

        except Exception as e:
            return ""
