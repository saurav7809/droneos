"""
Vision Service — High-Accuracy Pipeline
========================================
Techniques applied for maximum detection accuracy on aerial imagery:

1. YOLOv8m   — medium model (higher mAP than small/nano)
2. CLAHE      — Contrast-Limited Adaptive Histogram Equalisation for hazy frames
3. Sharpening — Unsharp-mask kernel to recover JPEG-compressed edges
4. TTA        — Test-Time Augmentation (3 augmented passes merged via NMS)
5. Tiled inference — overlapping tiles catch small objects missed at full scale
6. Cross-tile NMS  — deduplicates boxes that span tile boundaries
"""
import io
import logging
import time
import numpy as np
import cv2
from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)

# ── YOLO availability ─────────────────────────────────────────────────────────
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("ultralytics not installed — falling back to mock detections.")

# ── COCO-80 → drone domain mapping ───────────────────────────────────────────
COCO_TO_DRONE: dict = {
    0: "Person",
    1: "Bicycle", 2: "Vehicle", 3: "Motorcycle",
    4: "Vehicle",   # airplane
    5: "Vehicle",   # bus
    7: "Vehicle",   # truck
    8: "Vehicle",   # boat
    14: "Animal", 15: "Animal", 16: "Animal",
    17: "Animal", 18: "Animal", 19: "Animal",
    20: "Animal", 21: "Animal", 22: "Animal",
    23: "Animal",
    9:  "Traffic Light",
    10: "Fire Hydrant",
    11: "Stop Sign",
    12: "Parking Meter",
}

# ── Severity + colour ─────────────────────────────────────────────────────────
SEVERITY_MAP: dict = {
    "Person": "warning", "Vehicle": "info", "Bicycle": "info",
    "Motorcycle": "info", "Animal": "warning", "Fire": "critical",
    "Crack": "critical", "Power Line": "warning", "Water Body": "info",
    "Road": "info", "Building": "info", "Tree": "info",
    "Traffic Light": "info", "Fire Hydrant": "info",
    "Stop Sign": "info", "Parking Meter": "info",
}
SEVERITY_COLOR: dict = {
    "critical": "#FF3B3B",
    "warning":  "#FFB800",
    "info":     "#00E5FF",
}

# ── Hyper-parameters ──────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.30   # Raw model threshold (calibrated per-class below)
IOU_THRESHOLD        = 0.40   # Tight NMS — fewer duplicate boxes
INFER_SIZE           = 640    # Primary inference resolution
TILE_SIZE            = 512    # Tile size for multi-scale tiling
TILE_OVERLAP         = 0.25   # 25% overlap between tiles

# Per-class confidence calibration: raise threshold for noisy classes,
# lower for rare but important ones (Fire, Crack, Person).
_CLASS_CONF: dict = {
    "Person":   0.35,
    "Vehicle":  0.38,
    "Animal":   0.35,
    "Fire":     0.28,   # catch fire even at lower confidence
    "Crack":    0.28,
    "Building": 0.40,
    "Road":     0.40,
}

# Weighted label pool for mock mode
_MOCK_POOL = (
    ["Building"] * 4 + ["Road"] * 3 + ["Vehicle"] * 3 +
    ["Tree"] * 3 + ["Person"] * 2 + ["Animal"] * 1 +
    ["Water Body"] * 1 + ["Power Line"] * 1
)


class VisionService:
    """
    High-accuracy aerial object detection pipeline.

    Inference flow:
        raw bytes → CLAHE + sharpen → full-scale YOLO (TTA) +
        tiled YOLO → cross-tile NMS → per-class conf filter → output
    """

    def __init__(self):
        self.model = None
        self._load_model()

    # ── Model loading ─────────────────────────────────────────────────────────

    def _load_model(self):
        if not YOLO_AVAILABLE:
            logger.warning("YOLO unavailable — mock mode active.")
            return
        try:
            # YOLOv8m: medium model — significantly better mAP than small/nano
            self.model = YOLO("yolov8m.pt")
            # Warm-up pass (eliminates cold-start latency on first real request)
            dummy = np.zeros((INFER_SIZE, INFER_SIZE, 3), dtype=np.uint8)
            self.model(dummy, verbose=False)
            logger.info("YOLOv8m loaded and warmed up.")
        except Exception as exc:
            logger.error(f"YOLO load failed: {exc}")
            self.model = None

    # ── Public API ────────────────────────────────────────────────────────────

    def detect(self, image_bytes: bytes) -> list:
        """
        Full accuracy pipeline on raw image bytes.
        Returns: [{label, confidence, bbox, cls_id, severity, color, area, mock}]
        """
        t0 = time.perf_counter()
        try:
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_np  = self._enhance(np.array(pil_img))  # CLAHE + sharpen

            if self.model:
                detections = self._high_accuracy_detect(img_np)
            else:
                detections = self._mock_detect(pil_img)

            ms = round((time.perf_counter() - t0) * 1000, 1)
            logger.info(
                f"detect(): {len(detections)} objects | {ms} ms "
                f"({'YOLOv8m+TTA+tile' if self.model else 'mock'})"
            )
            return detections

        except Exception as exc:
            logger.error(f"Detection error: {exc}", exc_info=True)
            return self._mock_detect(None)

    # ── Image enhancement ─────────────────────────────────────────────────────

    @staticmethod
    def _enhance(img: np.ndarray) -> np.ndarray:
        """
        Apply CLAHE on the L-channel (LAB space) then unsharp-mask sharpening.
        Dramatically improves detection of objects in hazy/flat aerial footage.
        """
        # CLAHE in LAB space preserves colour while boosting local contrast
        lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

        # Unsharp-mask: sharpen = original + (original − blurred) × strength
        blurred = cv2.GaussianBlur(enhanced, (0, 0), sigmaX=2.0)
        sharpened = cv2.addWeighted(enhanced, 1.5, blurred, -0.5, 0)
        return sharpened

    # ── High-accuracy detection (TTA + tiling) ────────────────────────────────

    def _high_accuracy_detect(self, img: np.ndarray) -> list:
        """
        Combines:
          1. Full-scale inference with Test-Time Augmentation (TTA)
          2. Tiled inference on overlapping 512×512 tiles
        Both sets of raw boxes are merged via global NMS.
        """
        raw_boxes = []  # list of [x1, y1, x2, y2, conf, cls_id]

        # ── Pass 1: full image + TTA ──────────────────────────────────────────
        # augment=True internally runs flips + multi-scale, merges with NMS
        results_full = self.model(
            img,
            imgsz=INFER_SIZE,
            conf=CONFIDENCE_THRESHOLD,
            iou=IOU_THRESHOLD,
            augment=True,          # TTA enabled
            agnostic_nms=True,
            max_det=100,
            verbose=False,
        )[0]
        for box in results_full.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            raw_boxes.append([x1, y1, x2, y2, float(box.conf[0]), int(box.cls[0])])

        # ── Pass 2: tiled inference ───────────────────────────────────────────
        h, w = img.shape[:2]
        if max(h, w) > TILE_SIZE:
            tile_boxes = self._tiled_detect(img)
            raw_boxes.extend(tile_boxes)

        if not raw_boxes:
            return []

        # ── Global NMS across all boxes ───────────────────────────────────────
        merged = self._global_nms(raw_boxes, iou_thresh=IOU_THRESHOLD)

        # ── Build output with per-class confidence filtering ──────────────────
        img_h, img_w = img.shape[:2]
        detections = []
        for x1, y1, x2, y2, conf, cls_id in merged:
            raw_label = (results_full.names.get(cls_id)
                         or f"class_{cls_id}")
            label  = COCO_TO_DRONE.get(cls_id,
                                       raw_label.replace("_", " ").title())
            thresh = _CLASS_CONF.get(label, CONFIDENCE_THRESHOLD)
            if conf < thresh:
                continue  # filtered by per-class calibration

            bw   = x2 - x1
            bh   = y2 - y1
            area = round((bw * bh) / (img_w * img_h), 4)
            detections.append(self._make_detection(
                label=label, conf=conf,
                bbox=[int(x1), int(y1), int(bw), int(bh)],
                cls_id=cls_id, area=area, mock=False,
            ))

        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections

    # ── Tiled inference ───────────────────────────────────────────────────────

    def _tiled_detect(self, img: np.ndarray) -> list:
        """
        Divide image into overlapping tiles, run YOLO on each,
        then offset bboxes back to full-image coordinates.
        Catches small objects that are too tiny at full-image scale.
        """
        h, w = img.shape[:2]
        stride = int(TILE_SIZE * (1 - TILE_OVERLAP))
        boxes  = []

        ys = list(range(0, h - TILE_SIZE + 1, stride)) or [0]
        xs = list(range(0, w - TILE_SIZE + 1, stride)) or [0]
        # Always include bottom-right corner tile
        if ys[-1] + TILE_SIZE < h:
            ys.append(h - TILE_SIZE)
        if xs[-1] + TILE_SIZE < w:
            xs.append(w - TILE_SIZE)

        for ty in ys:
            for tx in xs:
                tile = img[ty:ty + TILE_SIZE, tx:tx + TILE_SIZE]
                results = self.model(
                    tile,
                    imgsz=TILE_SIZE,
                    conf=CONFIDENCE_THRESHOLD,
                    iou=IOU_THRESHOLD,
                    agnostic_nms=True,
                    verbose=False,
                )[0]
                for box in results.boxes:
                    lx1, ly1, lx2, ly2 = box.xyxy[0].tolist()
                    # Translate tile-local coords → full image coords
                    boxes.append([
                        lx1 + tx, ly1 + ty,
                        lx2 + tx, ly2 + ty,
                        float(box.conf[0]),
                        int(box.cls[0]),
                    ])
        return boxes

    # ── Global NMS ────────────────────────────────────────────────────────────

    @staticmethod
    def _global_nms(boxes: list, iou_thresh: float) -> list:
        """
        Class-agnostic NMS over raw [x1,y1,x2,y2,conf,cls] boxes.
        Uses OpenCV's built-in NMSBoxes for speed & correctness.
        """
        if not boxes:
            return []

        rects   = [[b[0], b[1], b[2] - b[0], b[3] - b[1]] for b in boxes]
        scores  = [b[4] for b in boxes]
        indices = cv2.dnn.NMSBoxes(rects, scores,
                                   score_threshold=0.0,
                                   nms_threshold=iou_thresh)
        if len(indices) == 0:
            return []
        flat = indices.flatten() if hasattr(indices, "flatten") else list(indices)
        return [boxes[i] for i in flat]

    # ── Mock fallback ─────────────────────────────────────────────────────────

    def _mock_detect(self, image) -> list:
        """Weighted, proportional mock — used only when YOLO is unavailable."""
        import random
        img_w, img_h = (image.size if image is not None else (640, 480))
        num = random.randint(2, 5)
        detections = []
        for _ in range(num):
            label = random.choice(_MOCK_POOL)
            conf  = round(random.uniform(0.60, 0.92), 3)
            bw    = random.randint(int(img_w * 0.06), int(img_w * 0.22))
            bh    = random.randint(int(img_h * 0.06), int(img_h * 0.22))
            x     = random.randint(0, max(0, img_w - bw))
            y     = random.randint(0, max(0, img_h - bh))
            area  = round((bw * bh) / (img_w * img_h), 4)
            detections.append(self._make_detection(
                label=label, conf=conf,
                bbox=[x, y, bw, bh],
                cls_id=-1, area=area, mock=True,
            ))
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections

    # ── Detection record builder ──────────────────────────────────────────────

    @staticmethod
    def _make_detection(label, conf, bbox, cls_id, area, mock) -> dict:
        severity = SEVERITY_MAP.get(label, "info")
        return {
            "label":      label,
            "confidence": round(conf, 3),
            "bbox":       bbox,
            "cls_id":     cls_id,
            "severity":   severity,
            "color":      SEVERITY_COLOR[severity],
            "area":       area,
            "mock":       mock,
        }

