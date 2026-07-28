"""
Teste de conexão / captura de frames.

Uso (a partir da pasta visao/):
  python -m scripts.test_stream
  python -m scripts.test_stream --webcam
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

# permite rodar como script sem instalar o pacote
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import cv2

from config import get_settings
from stream.source import VideoSource, resolve_source


def main() -> int:
    parser = argparse.ArgumentParser(description="Testa stream de câmera / webcam")
    parser.add_argument(
        "--webcam",
        action="store_true",
        help="Força webcam local (índice 0), ignora RTSP",
    )
    parser.add_argument("--frames", type=int, default=None, help="Qtd. de frames")
    args = parser.parse_args()

    settings = get_settings()
    frames_target = args.frames if args.frames is not None else settings.test_frames

    if args.webcam:
        source: str | int = 0
        print("Fonte: webcam local (0)")
    else:
        source = resolve_source(settings.rtsp_url)
        if isinstance(source, str):
            # mascara senha na URL para log
            safe = source
            if "@" in safe and "://" in safe:
                scheme, rest = safe.split("://", 1)
                if "@" in rest and ":" in rest.split("@", 1)[0]:
                    creds, host = rest.split("@", 1)
                    user = creds.split(":", 1)[0]
                    safe = f"{scheme}://{user}:***@{host}"
            print(f"Fonte: RTSP {safe}")
            print(f"Câmera (ref.): {settings.camera_name} serial={settings.camera_serial or '-'}")
        else:
            print("VISAO_RTSP_URL vazio — usando webcam local (0) para smoke test")
            print(
                "Dica: Cloud/P2P (serial) não abre direto no OpenCV. "
                "Precisamos de RTSP (IP local, VPN ou túnel)."
            )

    settings.snapshots_path.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = settings.snapshots_path / f"{settings.camera_name.replace(' ', '_')}_{stamp}.jpg"

    with VideoSource(source) as vs:
        info = vs.open()
        if not info.opened:
            print("FALHA: não foi possível abrir o stream.")
            if settings.camera_serial and not settings.rtsp_url.strip():
                print(
                    f"Serial Cloud informado ({settings.camera_serial}), porta {settings.camera_port}. "
                    "OpenCV não fala P2P Dahua/Intelbras nativamente."
                )
            return 1

        print(
            f"OK aberto: {info.width}x{info.height} @ {info.fps:.1f} fps (reportado)"
        )

        last_frame = None
        count = 0
        for idx, frame in vs.frames(limit=frames_target):
            last_frame = frame
            count = idx + 1
            if count == 1 or count % 10 == 0:
                print(f"  frame {count}/{frames_target}")

        if last_frame is None:
            print("FALHA: stream abriu, mas nenhum frame foi lido.")
            return 1

        ok = cv2.imwrite(str(out_path), last_frame)
        if not ok:
            print(f"FALHA ao gravar snapshot em {out_path}")
            return 1

        print(f"Snapshot: {out_path} ({count} frames lidos)")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
