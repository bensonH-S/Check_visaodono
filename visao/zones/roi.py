"""Zonas (ROI) em coordenadas normalizadas 0–1 (independente da resolução)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass(frozen=True)
class Zone:
    id: str
    name: str
    # retângulo normalizado: x, y, w, h em [0, 1]
    x: float
    y: float
    w: float
    h: float
    color: tuple[int, int, int] = (0, 200, 255)

    def pixel_rect(self, frame_w: int, frame_h: int) -> tuple[int, int, int, int]:
        x1 = int(self.x * frame_w)
        y1 = int(self.y * frame_h)
        x2 = int((self.x + self.w) * frame_w)
        y2 = int((self.y + self.h) * frame_h)
        return x1, y1, x2, y2

    def contains_point(self, px: float, py: float, frame_w: int, frame_h: int) -> bool:
        x1, y1, x2, y2 = self.pixel_rect(frame_w, frame_h)
        return x1 <= px <= x2 and y1 <= py <= y2


def load_zones(path: Path) -> list[Zone]:
    if not path.exists():
        return default_zones()
    data = json.loads(path.read_text(encoding="utf-8"))
    zones: list[Zone] = []
    for z in data.get("zones", []):
        color = tuple(z.get("color", [0, 200, 255]))
        zones.append(
            Zone(
                id=str(z["id"]),
                name=str(z.get("name", z["id"])),
                x=float(z["x"]),
                y=float(z["y"]),
                w=float(z["w"]),
                h=float(z["h"]),
                color=(int(color[0]), int(color[1]), int(color[2])),
            )
        )
    return zones or default_zones()


def default_zones() -> list[Zone]:
    """Zonas de exemplo para webcam / MVP (ajuste depois no JSON)."""
    return [
        Zone("expedicao", "Expedicao", 0.55, 0.15, 0.40, 0.70, (0, 200, 255)),
        Zone("montagem", "Montagem", 0.05, 0.20, 0.40, 0.65, (255, 160, 0)),
    ]


def draw_zones(frame: np.ndarray, zones: list[Zone]) -> None:
    h, w = frame.shape[:2]
    for z in zones:
        x1, y1, x2, y2 = z.pixel_rect(w, h)
        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), z.color, -1)
        cv2.addWeighted(overlay, 0.12, frame, 0.88, 0, frame)
        cv2.rectangle(frame, (x1, y1), (x2, y2), z.color, 2)
        cv2.putText(
            frame,
            z.name,
            (x1 + 6, y1 + 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            z.color,
            2,
            cv2.LINE_AA,
        )


def foot_point(x1: int, y1: int, x2: int, y2: int) -> tuple[float, float]:
    """Ponto de referência: centro da base da bbox (pés)."""
    return (x1 + x2) / 2.0, float(y2)
