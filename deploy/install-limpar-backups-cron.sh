#!/bin/bash
# Instala cron diário (00:10, Brasília) para limpar Backup_BD.
# O backup de 30 min também chama o mesmo script no final.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLEAN_SCRIPT="${CLEAN_SCRIPT:-$SCRIPT_DIR/limpar-backups-antigos.sh}"
LOG_FILE="${LOG_FILE:-/var/log/limpar-backups.log}"

chmod +x "$CLEAN_SCRIPT"

CRON_LINE="10 0 * * * TZ=America/Sao_Paulo /bin/bash $CLEAN_SCRIPT >> $LOG_FILE 2>&1"

if crontab -l 2>/dev/null | grep -F "$CLEAN_SCRIPT" >/dev/null; then
  echo "Cron de limpeza já está instalado:"
  crontab -l | grep -F "$CLEAN_SCRIPT"
  exit 0
fi

(
  crontab -l 2>/dev/null || true
  echo "$CRON_LINE"
) | crontab -

echo "Limpeza de backups instalada."
echo "  Horário: 00:10 (America/Sao_Paulo)"
echo "  Script:  $CLEAN_SCRIPT"
echo "  Log:     $LOG_FILE"
echo "  Retenção local: 3 dias | Google Drive: 7 dias"
