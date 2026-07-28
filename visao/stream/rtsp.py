"""Montagem de URLs RTSP comuns (Dahua / Intelbras)."""

from __future__ import annotations

from urllib.parse import quote


def build_rtsp_candidates(
    *,
    host: str,
    user: str,
    password: str,
    port: int = 554,
    channel: int = 1,
) -> list[str]:
    """
    Gera URLs típicas para testar na loja.
    channel=1 → câmera 1; subtype 0 = main stream, 1 = sub stream.
    """
    u = quote(user, safe="")
    p = quote(password, safe="")
    base = f"rtsp://{u}:{p}@{host}:{port}"
    ch = channel
    # Dahua / Intelbras (variações mais comuns)
    return [
        f"{base}/cam/realmonitor?channel={ch}&subtype=0",
        f"{base}/cam/realmonitor?channel={ch}&subtype=1",
        f"{base}/Streaming/Channels/{ch}01",
        f"{base}/Streaming/Channels/{ch}02",
        f"{base}/h264/ch{ch}/main/av_stream",
        f"{base}/h264/ch{ch}/sub/av_stream",
    ]
