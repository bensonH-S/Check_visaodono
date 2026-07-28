"""
Demo ao vivo: stream + detecção + tracking (ID por pessoa).

Uso (pasta visao/, venv ativo):
  python -m scripts.live_demo --webcam
  python -m scripts.live_demo --rtsp "rtsp://..."

Teclas: q = sair | s = salvar snapshot
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import cv2

from config import get_settings
from detector.person import PersonDetector
from stream.source import resolve_source, VideoSource


def _mask_rtsp(url: str) -> str:
    if "@" not in url or "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" not in rest:
        return url
    creds, host = rest.split("@", 1)
    user = creds.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host}"


def _color_for_id(track_id: int | None) -> tuple[int, int, int]:
    if track_id is None:
        return (0, 180, 80)
    palette = [
        (0, 180, 80),
        (255, 140, 0),
        (80, 160, 255),
        (200, 80, 200),
        (50, 220, 220),
        (220, 220, 50),
    ]
    return palette[track_id % len(palette)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Demo ao vivo — visão operacional")
    parser.add_argument("--webcam", action="store_true", help="Usa webcam local")
    parser.add_argument("--rtsp", default="", help="URL RTSP (sobrescreve .env)")
    parser.add_argument("--conf", type=float, default=0.35, help="Confiança mínima")
    parser.add_argument("--model", default="yolo11n.pt", help="Modelo ultralytics")
    parser.add_argument(
        "--every",
        type=int,
        default=1,
        help="Roda tracking a cada N frames (1 = todos; tracking precisa ser frequente)",
    )
    parser.add_argument(
        "--no-track",
        action="store_true",
        help="Só detecta, sem ID (ByteTrack)",
    )
    args = parser.parse_args()

    settings = get_settings()
    if args.webcam:
        source: str | int = 0
        title = "Visao — webcam + tracking"
    elif args.rtsp.strip():
        source = args.rtsp.strip()
        title = f"Visao — {_mask_rtsp(source)}"
    else:
        source = resolve_source(settings.rtsp_url)
        title = (
            f"Visao — {_mask_rtsp(source)}"
            if isinstance(source, str)
            else "Visao — webcam + tracking"
        )

    print(f"Carregando modelo {args.model}…")
    detector = PersonDetector(model_name=args.model, conf=args.conf)
    settings.snapshots_path.mkdir(parents=True, exist_ok=True)

    with VideoSource(source) as vs:
        info = vs.open()
        if not info.opened:
            print("FALHA: não abriu o stream.")
            print(
                "Sem RTSP local, use --webcam. Para a loja: python -m scripts.probe_loja --ip IP"
            )
            return 1

        mode = "detect" if args.no_track else "track"
        print(
            f"Stream OK {info.width}x{info.height} ({mode}). Teclas: q sair | s snapshot"
        )
        cv2.namedWindow(title, cv2.WINDOW_NORMAL)

        last_dets = []
        frame_i = 0
        t0 = time.perf_counter()
        fps_smooth = 0.0

        while True:
            ok, frame = vs.read()
            if not ok or frame is None:
                print("Stream encerrado / sem frame.")
                break

            frame_i += 1
            if frame_i % max(1, args.every) == 0:
                last_dets = (
                    detector.detect(frame) if args.no_track else detector.track(frame)
                )

            ids = {d.track_id for d in last_dets if d.track_id is not None}
            for d in last_dets:
                color = _color_for_id(d.track_id)
                cv2.rectangle(frame, (d.x1, d.y1), (d.x2, d.y2), color, 2)
                if d.track_id is not None:
                    label = f"ID {d.track_id}  {d.confidence:.2f}"
                else:
                    label = f"{d.label} {d.confidence:.2f}"
                cv2.putText(
                    frame,
                    label,
                    (d.x1, max(20, d.y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    color,
                    2,
                    cv2.LINE_AA,
                )

            now = time.perf_counter()
            inst = 1.0 / max(1e-6, now - t0)
            t0 = now
            fps_smooth = fps_smooth * 0.9 + inst * 0.1
            hud = (
                f"pessoas={len(last_dets)} ids={len(ids)}  "
                f"fps~{fps_smooth:.1f}  {settings.camera_name}"
            )
            cv2.putText(
                frame,
                hud,
                (12, 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (240, 240, 240),
                2,
                cv2.LINE_AA,
            )

            cv2.imshow(title, frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("s"):
                stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
                path = settings.snapshots_path / f"live_{stamp}.jpg"
                cv2.imwrite(str(path), frame)
                print(f"Snapshot: {path}")

        cv2.destroyAllWindows()
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
