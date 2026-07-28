"""Configuração do serviço de visão (somente via env / .env local)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent


class VisaoSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    rtsp_url: str = Field(default="", alias="VISAO_RTSP_URL")
    camera_name: str = Field(default="camera", alias="VISAO_CAMERA_NAME")
    camera_serial: str = Field(default="", alias="VISAO_CAMERA_SERIAL")
    camera_port: int = Field(default=37777, alias="VISAO_CAMERA_PORT")
    camera_user: str = Field(default="admin", alias="VISAO_CAMERA_USER")
    camera_pass: str = Field(default="", alias="VISAO_CAMERA_PASS")
    snapshot_dir: str = Field(default="snapshots", alias="VISAO_SNAPSHOT_DIR")
    test_frames: int = Field(default=30, alias="VISAO_TEST_FRAMES")

    @property
    def snapshots_path(self) -> Path:
        path = Path(self.snapshot_dir)
        if not path.is_absolute():
            path = ROOT / path
        return path


@lru_cache
def get_settings() -> VisaoSettings:
    return VisaoSettings()
