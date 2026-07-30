"""Fontes de vídeo (RTSP / arquivo / webcam)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import cv2
import numpy as np


@dataclass(frozen=True)
class StreamInfo:
    source: str
    opened: bool
    width: int = 0
    height: int = 0
    fps: float = 0.0


class VideoSource:
    """Abre um stream OpenCV (RTSP, arquivo ou índice de webcam)."""

    def __init__(self, source: str | int, *, read_timeout_ms: int = 10000) -> None:
        self.source = source
        self.read_timeout_ms = read_timeout_ms
        self._cap: cv2.VideoCapture | None = None

    def open(self) -> StreamInfo:
        # FFMPEG costuma se comportar melhor com RTSP
        if isinstance(self.source, str) and self.source.lower().startswith("rtsp"):
            self._cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        else:
            self._cap = cv2.VideoCapture(self.source)

        if not self._cap.isOpened():
            return StreamInfo(source=str(self.source), opened=False)

        width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fps = float(self._cap.get(cv2.CAP_PROP_FPS) or 0.0)
        return StreamInfo(
            source=str(self.source),
            opened=True,
            width=width,
            height=height,
            fps=fps,
        )

    def read(self) -> tuple[bool, np.ndarray | None]:
        if self._cap is None or not self._cap.isOpened():
            return False, None
        ok, frame = self._cap.read()
        if not ok:
            return False, None
        return True, frame

    def frames(self, limit: int | None = None) -> Iterator[tuple[int, np.ndarray]]:
        if self._cap is None or not self._cap.isOpened():
            raise RuntimeError("Stream não está aberto. Chame open() antes.")

        idx = 0
        while limit is None or idx < limit:
            ok, frame = self.read()
            if not ok or frame is None:
                break
            yield idx, frame
            idx += 1

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def __enter__(self) -> VideoSource:
        return self

    def __exit__(self, *args: object) -> None:
        self.release()


def resolve_source(rtsp_url: str, fallback_webcam: int = 0) -> str | int:
    """Prioriza RTSP; se vazio, usa webcam local para smoke test."""
    url = (rtsp_url or "").strip()
    if url:
        return url
    return fallback_webcam
