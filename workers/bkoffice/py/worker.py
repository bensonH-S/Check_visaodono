"""
Worker BK Office Terraço — loop 24h sem janela (pythonw / serviço Windows).

Chama o sync Node já existente com CREATE_NO_WINDOW (zero CMD/PowerShell).
Instalar: INSTALAR-SERVICO-BKOFFICE.bat (como administrador)
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# CREATE_NO_WINDOW — processo filho sem console
CREATE_NO_WINDOW = 0x08000000
DETACHED_PROCESS = 0x00000008

# .../workers/bkoffice/py/worker.py → repo root = parents[3]
ROOT = Path(__file__).resolve().parents[3]
LOG_DIR = ROOT / "Logs"
LOG_FILE = LOG_DIR / "bkoffice-python-service.log"
SYNC_SCRIPT = ROOT / "backend" / "scripts" / "sync-bkoffice-vendas.mjs"
ENV_CANDIDATES = [
    ROOT / "workers" / "bkoffice" / ".env",
    ROOT / "backend" / ".env",
]


def load_dotenv(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def merge_env() -> dict[str, str]:
    env = os.environ.copy()
    merged: dict[str, str] = {}
    for p in ENV_CANDIDATES:
        merged.update(load_dotenv(p))
    for k, v in merged.items():
        if v is not None:
            env[k] = v
    # Força produção + browser oculto no PC gerência
    db = env.get("DB_NAME_PROD") or env.get("DB_NAME") or "vision_check"
    env["DB_NAME"] = db
    env["DB_NAME_PROD"] = db
    env.setdefault("BKOFFICE_USE_CHROME", "1")
    env.setdefault("BKOFFICE_HEADLESS", "1")
    env["BKOFFICE_SYNC_CRON_MS"] = "0"
    return env


def log(msg: str) -> None:
    line = f"[bk-py] {datetime.now().isoformat(timespec='seconds')} {msg}"
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass
    # Em serviço (pythonw) stdout pode ser None
    try:
        print(line, flush=True)
    except Exception:
        pass


def find_node() -> str:
    for name in ("node.exe", "node"):
        try:
            r = subprocess.run(
                ["where" if os.name == "nt" else "which", name],
                capture_output=True,
                text=True,
                creationflags=CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            if r.returncode == 0:
                path = (r.stdout or "").strip().splitlines()[0].strip()
                if path:
                    return path
        except Exception:
            pass
    raise FileNotFoundError("Node.js nao encontrado no PATH")


def hoje_br() -> str:
    try:
        return datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m-%d")
    except Exception:
        # Windows sem tzdata: Brasil sem horário de verão = UTC-3
        from datetime import timedelta, timezone

        return datetime.now(timezone(timedelta(hours=-3))).strftime("%Y-%m-%d")


def run_sync(env: dict[str, str], id_loja: int) -> int:
    node = find_node()
    if not SYNC_SCRIPT.is_file():
        raise FileNotFoundError(f"Script ausente: {SYNC_SCRIPT}")
    dia = hoje_br()
    cmd = [
        node,
        str(SYNC_SCRIPT),
        f"--loja={id_loja}",
        "--db=prod",
        f"--data={dia}",
    ]
    log(f"sync start loja={id_loja} dia={dia} db={env.get('DB_NAME')}")
    flags = CREATE_NO_WINDOW if os.name == "nt" else 0
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=flags,
    )
    out = (proc.stdout or "").strip()
    err = (proc.stderr or "").strip()
    if out:
        for ln in out.splitlines()[-40:]:
            log(f"out {ln}")
    if err:
        for ln in err.splitlines()[-40:]:
            log(f"err {ln}")
    if proc.returncode == 0:
        log("sync OK")
    else:
        log(f"sync FALHOU exit={proc.returncode}")
    return proc.returncode


def main() -> int:
    env = merge_env()
    id_loja = int(env.get("BKOFFICE_SYNC_ID_LOJA") or env.get("ID_LOJA") or "21")
    interval = max(60, int(env.get("SYNC_INTERVAL_MS") or "60000") // 1000)
    log(f"iniciado intervalo={interval}s loja={id_loja} root={ROOT}")

    if not env.get("BKOFFICE_USER") or not env.get("BKOFFICE_PASS"):
        log("ERRO: BKOFFICE_USER/PASS ausentes no .env")
        return 1

    busy = False
    while True:
        if busy:
            log("pulando: sync ainda em andamento")
        else:
            busy = True
            try:
                run_sync(env, id_loja)
            except Exception as e:
                log(f"ERRO {e}")
                log(traceback.format_exc())
            finally:
                busy = False
        time.sleep(interval)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("parado pelo usuario")
        raise SystemExit(0)
