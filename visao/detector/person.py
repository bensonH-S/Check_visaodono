"""Detecção e rastreamento de pessoas com YOLOv11 + ByteTrack (ultralytics)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Detection:
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float
    class_id: int
    label: str
    track_id: int | None = None


class PersonDetector:
    """Wrapper fino sobre ultralytics YOLO focado em classe 'person'."""

    def __init__(
        self,
        model_name: str = "yolo11n.pt",
        *,
        conf: float = 0.35,
        device: str | None = None,
    ) -> None:
        from ultralytics import YOLO

        self.model = YOLO(model_name)
        self.conf = conf
        self.device = device

    def detect(self, frame: np.ndarray) -> list[Detection]:
        results = self.model.predict(
            source=frame,
            conf=self.conf,
            classes=[0],
            verbose=False,
            device=self.device,
        )
        return self._parse(results, with_track=False)

    def track(self, frame: np.ndarray) -> list[Detection]:
        """Mantém ID estável por pessoa (ByteTrack via ultralytics)."""
        results = self.model.track(
            source=frame,
            conf=self.conf,
            classes=[0],
            verbose=False,
            device=self.device,
            persist=True,
            tracker="bytetrack.yaml",
        )
        return self._parse(results, with_track=True)

    def _parse(self, results: list, *, with_track: bool) -> list[Detection]:
        out: list[Detection] = []
        if not results:
            return out
        r0 = results[0]
        if r0.boxes is None:
            return out
        names = r0.names or {}
        for box in r0.boxes:
            xyxy = box.xyxy[0].tolist()
            cls_id = int(box.cls[0].item()) if box.cls is not None else 0
            conf = float(box.conf[0].item()) if box.conf is not None else 0.0
            tid: int | None = None
            if with_track and box.id is not None:
                tid = int(box.id[0].item())
            out.append(
                Detection(
                    x1=int(xyxy[0]),
                    y1=int(xyxy[1]),
                    x2=int(xyxy[2]),
                    y2=int(xyxy[3]),
                    confidence=conf,
                    class_id=cls_id,
                    label=str(names.get(cls_id, "person")),
                    track_id=tid,
                )
            )
        return out
