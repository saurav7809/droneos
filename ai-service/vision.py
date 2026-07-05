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
        self.model = None
        self._try_load_yolo()

    def _try_load_yolo(self):
        try:
            from ultralytics import YOLO
            self.model = YOLO("yolov8n.pt")  # Downloads automatically on first run
            logger.info("✓ YOLOv8n model loaded")
        except Exception as e:
            logger.warning(f"YOLO not available, using mock detection: {e}")
            self.model = None

    def detect(self, image_bytes: bytes) -> list:
        """Detect objects in image bytes. Returns list of detections."""
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            if self.model:
                return self._yolo_detect(image)
            else:
                return self._mock_detect(image)
        except Exception as e:
            logger.error(f"Detection failed: {e}")
            return self._mock_detect(None)

    def _yolo_detect(self, image: Image.Image) -> list:
        """Run real YOLO detection. Returns detections with bbox as [x, y, w, h]."""
        import numpy as np
        img_array = np.array(image)
        results = self.model(img_array, verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                if conf < 0.4:
                    continue
                # xyxy → xywh so the frontend can use left/top/width/height directly
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                label = COCO_LABELS_OF_INTEREST.get(cls_id, r.names.get(cls_id, "Object"))
                detections.append({
                    "label": label,
                    "confidence": round(conf, 3),
                    "bbox": [round(x1), round(y1), round(x2 - x1), round(y2 - y1)],
                    "cls_id": cls_id,
                })
        return detections

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
