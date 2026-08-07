"""Worker BK Office — kit portátil (PC gerência). Sem janela via pythonw + serviço."""
from __future__ import annotations

import os
import subprocess
import time
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

CREATE_NO_WINDOW = 0x08000000
ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
LOG_DIR = ROOT / "Logs"
LOG_FILE = LOG_DIR / "bkoffice-python-service.log"
SYNC_SCRIPT = APP / "backend" / "scripts" / "sync-bkoffice-vendas.mjs"
CONFIG = ROOT / "config.env"


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
    for k, v in load_dotenv(CONFIG).items():
        env[k] = v
    db = env.get("DB_NAME_PROD") or env.get("DB_NAME") or "vision_check"
    env["DB_NAME"] = db
    env["DB_NAME_PROD"] = db
    env.setdefault("BKOFFICE_USE_CHROME", "0")
    env.setdefault("BKOFFICE_HEADLESS", "1")
    env["BKOFFICE_SYNC_CRON_MS"] = "0"
    env["NODE_ENV"] = "production"
    node_dir = str(ROOT / "runtime" / "node")
    env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")
    env["PLAYWRIGHT_BROWSERS_PATH"] = str(ROOT / "runtime" / "ms-playwright")
    return env


def log(msg: str) -> None:
    line = f"[bk-kit] {datetime.now().isoformat(timespec='seconds')} {msg}"
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass
    try:
        print(line, flush=True)
    except Exception:
        pass


def find_node() -> str:
    bundled = ROOT / "runtime" / "node" / "node.exe"
    if bundled.is_file():
        return str(bundled)
    raise FileNotFoundError("Node do kit ausente em runtime/node/node.exe")


def hoje_br() -> str:
    return datetime.now(timezone(timedelta(hours=-3))).strftime("%Y-%m-%d")


def run_sync(env: dict[str, str], id_loja: int) -> int:
    node = find_node()
    if not SYNC_SCRIPT.is_file():
        raise FileNotFoundError(f"Script ausente: {SYNC_SCRIPT}")
    dia = hoje_br()
    cmd = [node, str(SYNC_SCRIPT), f"--loja={id_loja}", "--db=prod", f"--data={dia}"]
    log(f"sync start loja={id_loja} dia={dia}")
    proc = subprocess.run(
        cmd,
        cwd=str(APP),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    for stream, label in ((proc.stdout, "out"), (proc.stderr, "err")):
        if stream:
            for ln in stream.strip().splitlines()[-40:]:
                log(f"{label} {ln}")
    log("sync OK" if proc.returncode == 0 else f"sync FALHOU exit={proc.returncode}")
    return proc.returncode


def main() -> int:
    env = merge_env()
    id_loja = int(env.get("BKOFFICE_SYNC_ID_LOJA") or "21")
    interval = max(60, int(env.get("SYNC_INTERVAL_MS") or "60000") // 1000)
    log(f"iniciado intervalo={interval}s loja={id_loja}")
    if not env.get("BKOFFICE_USER") or not env.get("BKOFFICE_PASS"):
        log("ERRO: faltam BKOFFICE_USER/PASS em config.env")
        return 1
    while True:
        try:
            run_sync(env, id_loja)
        except Exception as e:
            log(f"ERRO {e}")
            log(traceback.format_exc())
        time.sleep(interval)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("parado")
        raise SystemExit(0)
