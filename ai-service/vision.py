"""
Vision Service
YOLO-based object detection with OpenCV fallback.
"""
import io
import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

COCO_LABELS_OF_INTEREST = {
    0: "Person", 1: "Bicycle", 2: "Vehicle", 3: "Motorcycle",
    5: "Vehicle", 7: "Vehicle", 14: "Animal", 15: "Animal",
    16: "Animal", 56: "Animal", 57: "Animal", 58: "Animal",
    59: "Animal", 60: "Animal",
}

DRONE_LABELS = ["Person", "Vehicle", "Tree", "Building", "Fire", "Animal",
                "Crack", "Water Body", "Road", "Power Line"]


class VisionService:
    def __init__(self):
        self.model = None  # YOLO disabled — using mock detection

    def detect(self, image_bytes: bytes) -> list:
        """Detect objects in image bytes. Returns list of detections with [x,y,w,h] bbox."""
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            return self._mock_detect(image)
        except Exception as e:
            logger.error(f"Detection failed: {e}")
            return self._mock_detect(None)

    def _mock_detect(self, image) -> list:
        """Generate realistic mock detections when YOLO is unavailable.
        bbox format: [x, y, w, h] — top-left origin, width, height.
        Image assumed to be 800×600 (matches frontend scaleX/scaleY baseline).
        """
        import random
        num = random.randint(1, 5)
        detections = []
        for _ in range(num):
            label = random.choice(DRONE_LABELS)
            conf = round(random.uniform(0.55, 0.98), 3)
            x = random.randint(50, 600)
            y = random.randint(50, 400)
            w = random.randint(40, 150)
            h = random.randint(40, 150)
            detections.append({
                "label": label,
                "confidence": conf,
                "bbox": [x, y, w, h],   # xywh — NOT xyxy
                "cls_id": -1,
                "mock": True,
            })
        return detections
