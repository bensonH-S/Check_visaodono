"""
Tenta abrir a câmera da loja testando URLs RTSP comuns.

Uso:
  python -m scripts.probe_loja --ip 192.168.1.50
  python -m scripts.probe_loja --ip 192.168.1.50 --channel 1
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import cv2

from config import get_settings
from stream.rtsp import build_rtsp_candidates
from stream.source import VideoSource


def _mask(url: str) -> str:
    if "@" not in url or "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    creds, host = rest.split("@", 1)
    user = creds.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host}"


def try_url(url: str, frames: int = 8) -> bool:
    with VideoSource(url) as vs:
        info = vs.open()
        if not info.opened:
            return False
        got = 0
        for _ in vs.frames(limit=frames):
            got += 1
        return got > 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe RTSP da loja")
    parser.add_argument("--ip", required=True, help="IP local do DVR/NVR/câmera na loja")
    parser.add_argument("--port", type=int, default=554, help="Porta RTSP (padrão 554)")
    parser.add_argument("--channel", type=int, default=1, help="Canal da câmera")
    parser.add_argument(
        "--save-env",
        action="store_true",
        help="Se achar URL, grava VISAO_RTSP_URL no .env",
    )
    args = parser.parse_args()

    s = get_settings()
    if not s.camera_user or not s.camera_pass:
        print("Preencha VISAO_CAMERA_USER e VISAO_CAMERA_PASS no visao/.env")
        return 1

    candidates = build_rtsp_candidates(
        host=args.ip,
        user=s.camera_user,
        password=s.camera_pass,
        port=args.port,
        channel=args.channel,
    )

    print(f"Testando {len(candidates)} URLs em {args.ip}:{args.port} (canal {args.channel})")
    print(f"Câmera: {s.camera_name} serial={s.camera_serial or '-'}")

    for i, url in enumerate(candidates, 1):
        print(f"[{i}/{len(candidates)}] {_mask(url)} …", end=" ", flush=True)
        try:
            ok = try_url(url)
        except Exception as e:  # noqa: BLE001
            print(f"erro ({e})")
            continue
        if ok:
            print("OK")
            print()
            print("URL que funcionou (guarde):")
            print(url)
            if args.save_env:
                env_path = ROOT / ".env"
                text = env_path.read_text(encoding="utf-8") if env_path.exists() else ""
                lines = text.splitlines()
                found = False
                for idx, line in enumerate(lines):
                    if line.startswith("VISAO_RTSP_URL="):
                        lines[idx] = f"VISAO_RTSP_URL={url}"
                        found = True
                        break
                if not found:
                    lines.append(f"VISAO_RTSP_URL={url}")
                env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
                print(f"Salvo em {env_path}")
            print()
            print("Próximo:")
            print('  python -m scripts.live_demo --rtsp "' + url + '"')
            return 0
        print("falhou")

    print()
    print("Nenhuma URL abriu.")
    print("Confira: IP certo, mesma rede/VPN da loja, usuário/senha, canal.")
    print("Cloud/serial sozinho não substitui o IP local.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
