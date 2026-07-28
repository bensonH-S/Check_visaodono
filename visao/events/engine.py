"""Motor de eventos por zona (enter / exit / dwell). Não afirma furto."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from detector.person import Detection
from zones.roi import Zone, foot_point


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class VisionEvent:
    tipo: str  # zone_enter | zone_exit | zone_dwell
    zone_id: str
    zone_name: str
    track_id: int | None
    camera: str
    ts: str
    dwell_sec: float | None = None
    snapshot: str | None = None
    suspeito_auditoria: bool = False
    nota: str = ""


@dataclass
class _Presence:
    entered_at: float
    last_seen_at: float
    dwell_emitted: bool = False


class ZoneEventEngine:
    """
    Observa IDs em zonas e emite eventos.
    dwell: se permanecer >= dwell_sec na zona, marca para auditoria (heurística).
    """

    def __init__(
        self,
        zones: list[Zone],
        *,
        camera: str,
        dwell_sec: float = 20.0,
        on_event: Callable[[VisionEvent], None] | None = None,
    ) -> None:
        self.zones = zones
        self.camera = camera
        self.dwell_sec = dwell_sec
        self.on_event = on_event
        # (track_id, zone_id) -> Presence
        self._inside: dict[tuple[int, str], _Presence] = {}

    def update(self, dets: list[Detection], frame_w: int, frame_h: int, now: float) -> list[VisionEvent]:
        events: list[VisionEvent] = []
        seen: set[tuple[int, str]] = set()

        for d in dets:
            if d.track_id is None:
                continue
            fx, fy = foot_point(d.x1, d.y1, d.x2, d.y2)
            for z in self.zones:
                key = (d.track_id, z.id)
                if not z.contains_point(fx, fy, frame_w, frame_h):
                    continue
                seen.add(key)
                if key not in self._inside:
                    self._inside[key] = _Presence(entered_at=now, last_seen_at=now)
                    ev = VisionEvent(
                        tipo="zone_enter",
                        zone_id=z.id,
                        zone_name=z.name,
                        track_id=d.track_id,
                        camera=self.camera,
                        ts=_utc_now(),
                        nota="Pessoa entrou na zona (heurística visual).",
                    )
                    events.append(ev)
                else:
                    self._inside[key].last_seen_at = now
                    presence = self._inside[key]
                    dwell = now - presence.entered_at
                    if not presence.dwell_emitted and dwell >= self.dwell_sec:
                        presence.dwell_emitted = True
                        ev = VisionEvent(
                            tipo="zone_dwell",
                            zone_id=z.id,
                            zone_name=z.name,
                            track_id=d.track_id,
                            camera=self.camera,
                            ts=_utc_now(),
                            dwell_sec=round(dwell, 1),
                            suspeito_auditoria=True,
                            nota=(
                                f"Permanência incomum na zona (~{dwell:.0f}s). "
                                "Sinal para auditoria — não afirma irregularidade."
                            ),
                        )
                        events.append(ev)

        # saídas
        for key in list(self._inside.keys()):
            if key in seen:
                continue
            track_id, zone_id = key
            presence = self._inside.pop(key)
            zone = next((z for z in self.zones if z.id == zone_id), None)
            dwell = now - presence.entered_at
            ev = VisionEvent(
                tipo="zone_exit",
                zone_id=zone_id,
                zone_name=zone.name if zone else zone_id,
                track_id=track_id,
                camera=self.camera,
                ts=_utc_now(),
                dwell_sec=round(dwell, 1),
                nota="Pessoa saiu da zona.",
            )
            events.append(ev)

        if self.on_event:
            for ev in events:
                self.on_event(ev)
        return events


class JsonlEventStore:
    """Persistência simples em arquivo JSONL (depois vai para Postgres)."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, event: VisionEvent) -> None:
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(event), ensure_ascii=False) + "\n")
