"""
Weather Service module for the DroneOS AI service.
Generates realistic weather data using simple physics-based models.
"""
import random
import math
import time


WIND_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

# Thresholds for flight safety
SAFE_WIND_SPEED     = 40.0   # km/h
SAFE_TEMP_MIN       = -5.0   # °C
SAFE_TEMP_MAX       = 45.0   # °C
SAFE_VISIBILITY     = 1.0    # km
SAFE_RAIN_MAX       = 5.0    # mm/h


class WeatherService:
    """Generates realistic weather with time-of-day and seasonal variation."""

    def __init__(self):
        self._base_temp   = 28.0
        self._base_wind   = 12.0
        self._t0          = time.time()

    def get_current(self) -> dict:
        """Return current simulated weather conditions."""
        t = time.time() - self._t0
        hour = (time.localtime().tm_hour + time.localtime().tm_min / 60)

        # Temperature: cooler at night, warmer midday
        temp_variation = 6 * math.sin((hour - 6) * math.pi / 12)
        temperature = round(self._base_temp + temp_variation + random.uniform(-1.5, 1.5), 1)

        # Wind: gusts with slight oscillation
        wind_speed = round(max(0, self._base_wind + 5 * math.sin(t / 120) + random.uniform(-3, 5)), 1)
        wind_dir   = random.choice(WIND_DIRECTIONS)
        wind_gust  = round(wind_speed * random.uniform(1.1, 1.6), 1)

        # Humidity: inverse of temperature (roughly)
        humidity = round(max(10, min(95, 70 - (temperature - 28) * 2 + random.uniform(-5, 5))), 1)

        # Visibility: drops when humidity is high or rain occurs
        visibility = round(max(0.5, min(20.0, 15 - humidity / 10 + random.uniform(-2, 2))), 1)

        # Precipitation
        rain_chance = max(0, (humidity - 60) / 40)
        rain = round(random.uniform(0, 20) * rain_chance, 1) if rain_chance > 0 else 0.0

        # Pressure, UV, cloud cover
        pressure    = round(1013 + random.uniform(-8, 8), 1)
        uv_index    = round(max(0, min(11, 6 - abs(hour - 13) * 0.8 + random.uniform(-1, 1))), 1)
        cloud_cover = round(min(100, max(0, humidity - 20 + random.uniform(-10, 30))), 1)

        # Flight safety
        warnings = []
        if wind_speed > SAFE_WIND_SPEED:
            warnings.append(f"High winds: {wind_speed} km/h (limit {SAFE_WIND_SPEED})")
        if temperature < SAFE_TEMP_MIN or temperature > SAFE_TEMP_MAX:
            warnings.append(f"Extreme temperature: {temperature}°C")
        if visibility < SAFE_VISIBILITY:
            warnings.append(f"Low visibility: {visibility} km")
        if rain > SAFE_RAIN_MAX:
            warnings.append(f"Heavy rain: {rain} mm/h")

        flight_safe = len(warnings) == 0

        return {
            "temperature":  temperature,
            "humidity":     humidity,
            "windSpeed":    wind_speed,
            "windGust":     wind_gust,
            "windDirection":wind_dir,
            "visibility":   visibility,
            "rain":         rain,
            "pressure":     pressure,
            "uvIndex":      uv_index,
            "cloudCover":   cloud_cover,
            "flightSafe":   flight_safe,
            "warnings":     warnings,
            "condition":    self._condition(cloud_cover, rain, wind_speed),
            "timestamp":    time.strftime("%Y-%m-%dT%H:%M:%S"),
        }

    def _condition(self, cloud: float, rain: float, wind: float) -> str:
        if rain > 10:   return "Heavy Rain"
        if rain > 2:    return "Light Rain"
        if wind > 40:   return "High Winds"
        if cloud > 75:  return "Overcast"
        if cloud > 40:  return "Partly Cloudy"
        return "Clear"
