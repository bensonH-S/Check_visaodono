"""Smoke test headless: abre fonte, detecta pessoas, grava snapshot anotado."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import cv2

from config import get_settings
from detector.person import PersonDetector
from stream.source import VideoSource, resolve_source


def main() -> int:
    settings = get_settings()
    source = resolve_source(settings.rtsp_url)
    # Prefer webcam for smoke se não houver RTSP
    if not settings.rtsp_url.strip():
        source = 0

    print(f"Fonte: {source}")
    print("Carregando YOLO…")
    det = PersonDetector(conf=0.35)

    settings.snapshots_path.mkdir(parents=True, exist_ok=True)
    with VideoSource(source) as vs:
        info = vs.open()
        if not info.opened:
            print("FALHA ao abrir fonte")
            return 1
        print(f"Aberto {info.width}x{info.height}")

        frame = None
        for i, f in vs.frames(limit=15):
            frame = f
            if (i + 1) % 5 == 0:
                print(f"  frame {i + 1}")

        if frame is None:
            print("FALHA: sem frames")
            return 1

        people = det.detect(frame)
        for d in people:
            cv2.rectangle(frame, (d.x1, d.y1), (d.x2, d.y2), (0, 180, 80), 2)
            cv2.putText(
                frame,
                f"{d.label} {d.confidence:.2f}",
                (d.x1, max(20, d.y1 - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 180, 80),
                2,
            )

        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        out = settings.snapshots_path / f"smoke_{stamp}.jpg"
        cv2.imwrite(str(out), frame)
        print(f"Pessoas detectadas: {len(people)}")
        print(f"Snapshot: {out}")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
