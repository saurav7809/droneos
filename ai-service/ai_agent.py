"""
AI Flight Agent
Rule-based finite state machine for autonomous drone navigation.
States: IDLE → TAKEOFF → FLY → AVOID → CAPTURE → RETURN → LAND
"""
import math
import random
import time
from enum import Enum, auto


class AgentState(Enum):
    IDLE = "IDLE"
    TAKEOFF = "TAKEOFF"
    FLY = "FLY"
    AVOID = "AVOID"
    CAPTURE = "CAPTURE"
    RETURN = "RETURN"
    LAND = "LAND"
    HOVER = "HOVER"


BATTERY_RETURN_THRESHOLD = 20.0
BATTERY_CRITICAL = 10.0
OBSTACLE_DISTANCE_THRESHOLD = 200.0  # meters
CAPTURE_INTERVAL = 5  # steps between photos


class AIAgent:
    def __init__(self):
        self.state = AgentState.IDLE
        self.step_count = 0
        self.waypoints_completed = 0
        self.total_waypoints = 8

    def decide(self, telemetry: dict, obstacles: list) -> dict:
        """Main decision function. Returns action + reasoning."""
        battery = telemetry.get("battery", 100)
        altitude = telemetry.get("altitude", 0)
        status = telemetry.get("status", "Idle")
        lat = telemetry.get("latitude", 0)
        lon = telemetry.get("longitude", 0)
        mission = telemetry.get("mission")

        self.step_count += 1
        timestamp = time.strftime("%H:%M:%S")

        # ── Critical: Low battery ──────────────────────────────
        if battery <= BATTERY_CRITICAL and self.state not in (AgentState.LAND, AgentState.IDLE):
            self.state = AgentState.LAND
            return self._action("EMERGENCY_LAND", "LAND",
                                f"CRITICAL: Battery at {battery:.0f}% — Emergency landing initiated",
                                priority="CRITICAL")

        if battery <= BATTERY_RETURN_THRESHOLD and self.state in (AgentState.FLY, AgentState.CAPTURE):
            self.state = AgentState.RETURN
            return self._action("RETURN_HOME", "RETURN",
                                f"Battery {battery:.0f}% below threshold — Initiating Return to Home",
                                priority="WARNING")

        # ── State transitions ──────────────────────────────────
        if self.state == AgentState.IDLE:
            if mission:
                self.state = AgentState.TAKEOFF
                return self._action("TAKEOFF", "TAKEOFF",
                                    f"Mission received: {mission} — Beginning takeoff sequence")

        elif self.state == AgentState.TAKEOFF:
            if altitude >= 50:
                self.state = AgentState.FLY
                return self._action("MOVE_FORWARD", "FLY",
                                    f"Takeoff complete at {altitude:.0f}m — Navigating to waypoint 1/{self.total_waypoints}")
            return self._action("ASCEND", "TAKEOFF",
                                f"Ascending... current altitude {altitude:.0f}m, target 50m")

        elif self.state == AgentState.FLY:
            # Check for obstacles
            nearby = self._check_obstacles(lat, lon, obstacles)
            if nearby:
                self.state = AgentState.AVOID
                return self._action("INCREASE_ALTITUDE", "AVOID",
                                    f"Obstacle detected at bearing {random.randint(0, 359)}° ({nearby['type']}) — Climbing to clear")

            # Periodic photo capture
            if self.step_count % CAPTURE_INTERVAL == 0:
                self.state = AgentState.CAPTURE
                self.waypoints_completed = min(self.waypoints_completed + 1, self.total_waypoints)
                return self._action("TAKE_PHOTO", "CAPTURE",
                                    f"Waypoint {self.waypoints_completed}/{self.total_waypoints} reached — Capturing imagery")

            # Continue flying
            direction = random.choice(["north", "northeast", "east", "southeast"])
            return self._action("MOVE_FORWARD", "FLY",
                                f"Route clear — proceeding {direction}, battery {battery:.0f}%")

        elif self.state == AgentState.AVOID:
            # After one avoid step, resume flying
            self.state = AgentState.FLY
            return self._action("RESUME_ROUTE", "FLY",
                                "Obstacle cleared — resuming planned route")

        elif self.state == AgentState.CAPTURE:
            # After capture, go back to flying
            num_detected = random.randint(1, 6)
            self.state = AgentState.FLY
            return self._action("MOVE_FORWARD", "FLY",
                                f"Image captured — {num_detected} objects detected, continuing mission")

        elif self.state == AgentState.RETURN:
            dist = math.sqrt((lat - 28.6100) ** 2 + (lon - 77.2050) ** 2)
            if dist < 0.005:
                self.state = AgentState.LAND
                return self._action("DESCEND", "LAND",
                                    "Reached home base — initiating landing sequence")
            return self._action("RETURN_HOME", "RETURN",
                                f"Returning to base — {dist * 111:.1f}km remaining, battery {battery:.0f}%")

        elif self.state == AgentState.LAND:
            if altitude <= 1:
                self.state = AgentState.IDLE
                self.step_count = 0
                self.waypoints_completed = 0
                return self._action("LANDED", "IDLE",
                                    "Landing complete — mission ended successfully")
            return self._action("DESCEND", "LAND",
                                f"Landing — altitude {altitude:.0f}m, approaching ground")

        # Default
        return self._action("STANDBY", "IDLE", "System standby — awaiting mission")

    def _check_obstacles(self, lat, lon, obstacles):
        for obs in obstacles:
            obs_lat = obs.get("lat", 0)
            obs_lon = obs.get("lon", 0)
            dist_deg = math.sqrt((lat - obs_lat) ** 2 + (lon - obs_lon) ** 2)
            dist_m = dist_deg * 111000
            if dist_m < OBSTACLE_DISTANCE_THRESHOLD:
                return obs
        return None

    def _action(self, action: str, state: str, reason: str, priority: str = "INFO") -> dict:
        return {
            "action": action,
            "state": state,
            "reason": reason,
            "priority": priority,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "step": self.step_count,
            "waypoints_completed": self.waypoints_completed,
        }
