#!/bin/bash
# Instala cron: backup todo dia às 00:00 (America/Sao_Paulo).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-db.sh"
LOG_DIR="$PROJECT_DIR/Logs"
LOG_FILE="$LOG_DIR/backup-cron.log"

chmod +x "$BACKUP_SCRIPT"
mkdir -p "$LOG_DIR"

CRON_LINE="0 0 * * * TZ=America/Sao_Paulo $BACKUP_SCRIPT >> $LOG_FILE 2>&1"

if crontab -l 2>/dev/null | grep -F "$BACKUP_SCRIPT" >/dev/null; then
  echo "Cron de backup já está instalado:"
  crontab -l | grep -F "$BACKUP_SCRIPT"
  exit 0
fi

(
  crontab -l 2>/dev/null || true
  echo "$CRON_LINE"
) | crontab -

echo "Backup diário instalado."
echo ""
echo "  Horário: 00:00 (America/Sao_Paulo)"
echo "  Script:  $BACKUP_SCRIPT"
echo "  Log:     $LOG_FILE"
echo ""
echo "Teste agora: $BACKUP_SCRIPT"
echo "Listar cron: crontab -l"
