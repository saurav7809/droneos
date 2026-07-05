"""
DroneOS AI Service — Flask API
Endpoints: health, detect (YOLO), decision (AI agent), simulate, weather
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import os
import logging

from drone_simulator import DroneSimulator
from ai_agent import AIAgent
from vision import VisionService
from weather import WeatherService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Allow origins from env var (comma-separated) or default to all for dev
_cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "*")
_origins_list = [o.strip() for o in _cors_origins.split(",")] if _cors_origins != "*" else ["*"]
CORS(app, origins=_origins_list, supports_credentials=True)

# ── Singletons ──────────────────────────────────────────────────
simulator = DroneSimulator()
agent     = AIAgent()
vision    = VisionService()
weather   = WeatherService()

# ── Health ───────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "DroneOS AI Service",
        "version": "1.1.0",
        "endpoints": ["/health", "/ai/detect", "/ai/decision", "/ai/simulate", "/ai/simulate/all", "/ai/weather", "/ai/camera/<id>", "/ai/images"]
    })

# ── Object Detection ─────────────────────────────────────────────
@app.route("/ai/detect", methods=["POST"])
def detect_objects():
    """Run YOLO detection on a base64-encoded image."""
    try:
        data = request.get_json()
        if not data or "image" not in data:
            return jsonify({"error": "No image provided"}), 400
        image_bytes = base64.b64decode(data["image"])
        results = vision.detect(image_bytes)
        return jsonify({"detections": results, "count": len(results)})
    except Exception as e:
        logger.error(f"Detection error: {e}")
        return jsonify({"error": str(e)}), 500

# ── AI Decision ──────────────────────────────────────────────────
@app.route("/ai/decision", methods=["POST"])
def make_decision():
    """Given drone telemetry and obstacles, return AI agent decision."""
    try:
        data = request.get_json()
        telemetry = data.get("telemetry", {})
        obstacles = data.get("obstacles", [])
        decision = agent.decide(telemetry, obstacles)
        return jsonify(decision)
    except Exception as e:
        logger.error(f"AI decision error: {e}")
        return jsonify({"error": str(e)}), 500

# ── Drone Simulation ─────────────────────────────────────────────
@app.route("/ai/simulate", methods=["GET"])
def simulate_step():
    """Advance one drone's simulation and return state + camera image."""
    try:
        drone_id = request.args.get("droneId", 1, type=int)
        state = simulator.step(drone_id)
        return jsonify(state)
    except Exception as e:
        logger.error(f"Simulation error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/ai/simulate/all", methods=["GET"])
def simulate_all():
    """Return current state of all simulated drones."""
    try:
        return jsonify({"drones": simulator.get_all_states()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Weather ──────────────────────────────────────────────────────
@app.route("/ai/weather", methods=["GET"])
def get_weather():
    """Return current weather conditions and flight safety assessment."""
    try:
        return jsonify(weather.get_current())
    except Exception as e:
        logger.error(f"Weather error: {e}")
        return jsonify({"error": str(e)}), 500

# ── Camera Image Generation ──────────────────────────────────────
@app.route("/ai/camera/<int:drone_id>", methods=["GET"])
def get_camera(drone_id: int):
    """Generate and return a synthetic aerial camera frame for a drone."""
    try:
        state = simulator.step(drone_id)
        return jsonify({
            "droneId": drone_id,
            "image": state.get("camera_image", ""),
            "detections": state.get("detections", []),
            "timestamp": state.get("last_updated"),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── All drone images (for CameraFeed page) ───────────────────────
@app.route("/ai/images", methods=["GET"])
def get_all_images():
    """Return camera frames + detections for all 6 drones in one call."""
    try:
        images = []
        for drone_id in range(1, 7):
            state = simulator.step(drone_id)
            detections = state.get("detections", [])
            images.append({
                "id": drone_id,
                "droneId": drone_id,
                # Base64 data URI so the frontend can use it as an <img src>
                "imageUrl": f"data:image/jpeg;base64,{state.get('camera_image', '')}",
                "prediction": detections[0]["label"] if detections else "None",
                "confidence": detections[0]["confidence"] if detections else 0.0,
                "timestamp": state.get("last_updated"),
                "detections": detections,
            })
        return jsonify(images)
    except Exception as e:
        logger.error(f"Images error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"🚀 Starting DroneOS AI Service on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
