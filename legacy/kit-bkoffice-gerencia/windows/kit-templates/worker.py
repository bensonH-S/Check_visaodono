"""Worker BK Office — kit portatil (PC gerencia).

Puxa relatório "Restaurante e Produto Venda" (itens + valor).
Valor preferido: venda BRUTA. Grava no PostgreSQL Meridian (prod).

Estratégia:
  - Boot / troca de mês: backfill dia a dia (01 → hoje)
  - Depois: só o dia de hoje (rápido)
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

CREATE_NO_WINDOW = 0x08000000
ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
CONFIG = ROOT / "config.env"
SYNC_SCRIPT = APP / "backend" / "scripts" / "sync-bkoffice-vendas.mjs"

LOG_DIRS = [
    ROOT / "Logs",
    Path(os.environ.get("PROGRAMDATA", r"C:\ProgramData")) / "MeridianBkOffice" / "Logs",
]


def _stamp() -> str:
    return datetime.now().isoformat(timespec="seconds")


def log(msg: str) -> None:
    line = f"[bk-kit] {_stamp()} {msg}"
    for d in LOG_DIRS:
        try:
            d.mkdir(parents=True, exist_ok=True)
            with (d / "bkoffice-python-service.log").open("a", encoding="utf-8") as f:
                f.write(line + "\n")
                f.flush()
                os.fsync(f.fileno())
        except OSError:
            continue
    try:
        print(line, flush=True)
    except Exception:
        pass


log(f"boot pid={os.getpid()} root={ROOT} py={sys.executable}")


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
    env.setdefault("BKOFFICE_USE_CHROME", "1")
    env.setdefault("BKOFFICE_HEADLESS", "1")
    # Scheduler do app Node fica off — este worker é quem agenda
    env["BKOFFICE_SYNC_CRON_MS"] = "0"
    env["BKOFFICE_SERVER_SYNC"] = "0"
    env["NODE_ENV"] = "production"
    if os.name == "nt":
        env["BKOFFICE_USE_CHROME"] = env.get("BKOFFICE_USE_CHROME") or "1"
    node_dir = str(ROOT / "runtime" / "node")
    env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")
    browsers = ROOT / "runtime" / "ms-playwright"
    env["PLAYWRIGHT_BROWSERS_PATH"] = str(browsers)
    return env


def find_node() -> str:
    bundled = ROOT / "runtime" / "node" / "node.exe"
    if bundled.is_file():
        return str(bundled)
    raise FileNotFoundError("Node do kit ausente em runtime/node/node.exe")


def hoje_br() -> str:
    return datetime.now(timezone(timedelta(hours=-3))).strftime("%Y-%m-%d")


def add_days(iso: str, delta: int) -> str:
    y, m, d = map(int, iso.split("-"))
    dt = datetime(y, m, d, tzinfo=timezone.utc) + timedelta(days=delta)
    return dt.strftime("%Y-%m-%d")


def data_inicio(env: dict[str, str]) -> str:
    fixo = (env.get("BKOFFICE_SYNC_DATA_INICIO") or "").strip()[:10]
    if len(fixo) == 10 and fixo[4] == "-" and fixo[7] == "-":
        return fixo
    return hoje_br()[:8] + "01"


def sync_periodo(env: dict[str, str], id_loja: int, ini: str, fim: str) -> int:
    node = find_node()
    if not SYNC_SCRIPT.is_file():
        raise FileNotFoundError(f"Script ausente: {SYNC_SCRIPT}")
    cmd = [
        node,
        str(SYNC_SCRIPT),
        f"--loja={id_loja}",
        "--db=prod",
        f"--inicio={ini}",
        f"--fim={fim}",
    ]
    log(f"sync start loja={id_loja} periodo={ini}→{fim}")
    t0 = time.time()
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
    elapsed = int(time.time() - t0)
    for stream, label in ((proc.stdout, "out"), (proc.stderr, "err")):
        if stream:
            for ln in stream.strip().splitlines()[-40:]:
                log(f"{label} {ln}")
    if proc.returncode == 0:
        log(f"sync OK em {elapsed}s ({ini}→{fim})")
    else:
        log(f"sync FALHOU exit={proc.returncode} em {elapsed}s ({ini}→{fim})")
    return proc.returncode


def backfill_mes(env: dict[str, str], id_loja: int) -> bool:
    """Dia a dia do dia 01 (ou DATA_INICIO) até hoje. Retorna True se todos OK."""
    ini = data_inicio(env)
    fim = hoje_br()
    log(f"backfill {ini} → {fim}")
    ok_all = True
    d = ini
    while d <= fim:
        rc = sync_periodo(env, id_loja, d, d)
        if rc != 0:
            ok_all = False
            # Continua os outros dias
        d = add_days(d, 1)
    return ok_all


def main() -> int:
    log(f"config existe={CONFIG.is_file()} app={APP.is_dir()} sync={SYNC_SCRIPT.is_file()}")
    env = merge_env()
    id_loja = int(env.get("BKOFFICE_SYNC_ID_LOJA") or "21")
    # Padrão 15 min — full mês a cada 60s trava o PC
    interval = max(60, int(env.get("SYNC_INTERVAL_MS") or "900000") // 1000)
    log(
        f"iniciado intervalo={interval}s loja={id_loja} "
        f"db={env.get('DB_NAME')} modo=PC-gerencia "
        f"user={'(ok)' if env.get('BKOFFICE_USER') else '(vazio)'}"
    )
    if not env.get("BKOFFICE_USER") or not env.get("BKOFFICE_PASS"):
        log("ERRO: faltam BKOFFICE_USER/PASS em config.env")
        return 1

    backfill_feito_mes: str | None = None
    ciclo = 0
    while True:
        ciclo += 1
        log(f"ciclo #{ciclo} — acordando")
        try:
            hoje = hoje_br()
            mes = hoje[:7]
            if backfill_feito_mes != mes:
                if backfill_mes(env, id_loja):
                    backfill_feito_mes = mes
                    log(f"backfill do mês {mes} concluído")
                else:
                    log("backfill parcial — tenta de novo no próximo ciclo")
            else:
                sync_periodo(env, id_loja, hoje, hoje)
        except Exception as e:
            log(f"ERRO {e}")
            log(traceback.format_exc())
        log(f"ciclo #{ciclo} — dormindo {interval}s")
        time.sleep(interval)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        log("parado")
        raise SystemExit(0)
    except Exception:
        log("FATAL")
        log(traceback.format_exc())
        raise
