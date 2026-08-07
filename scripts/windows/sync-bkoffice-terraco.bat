@echo off
REM Sync BK Office Terraço → banco producao (PC gerencia BR, ligado 24h)
cd /d "%~dp0..\.."
if not exist Logs mkdir Logs
set BKOFFICE_USE_CHROME=1
set BKOFFICE_HEADLESS=1
set BKOFFICE_SYNC_CRON_MS=0
node backend/scripts/sync-bkoffice-vendas.mjs --loja=21 --db=prod >> Logs\bkoffice-sync-local.log 2>&1
