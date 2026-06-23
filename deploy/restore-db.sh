#!/bin/bash
# Restaura backup .sql.gz no PostgreSQL. Uso interativo e destrutivo.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"

read_env() {
  local key="$1"
  local default="${2:-}"
  [[ -f "$ENV_FILE" ]] || { echo "$default"; return; }
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)"
  [[ -n "$line" ]] || { echo "$default"; return; }
  local value="${line#*=}"
  value="${value//$'\r'/}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  echo "$value"
}

DB_HOST="$(read_env DB_HOST)"
DB_USER="$(read_env DB_USER)"
DB_PASS="$(read_env DB_PASS)"
DB_NAME="$(read_env DB_NAME vision_check)"
DB_PORT="$(read_env DB_PORT 5432)"
BACKUP_DIR="$(read_env BACKUP_DIR "$PROJECT_DIR/backups")"

die() {
  echo "ERRO: $*" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || die ".env não encontrado: $ENV_FILE"

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Backups em $BACKUP_DIR:"
  echo ""
  ls -lah "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (nenhum .sql.gz encontrado)"
  echo ""
  echo "Uso: $0 caminho/para/vision_check_YYYYMMDD_HHMMSS.sql.gz"
  echo "     $0 latest   # usa $BACKUP_DIR/latest.sql.gz"
  exit 1
fi

if [[ "$BACKUP_FILE" == "latest" ]]; then
  BACKUP_FILE="$BACKUP_DIR/latest.sql.gz"
fi

[[ -f "$BACKUP_FILE" ]] || die "Arquivo não encontrado: $BACKUP_FILE"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ATENÇÃO: isso SOBRESCREVE o banco $DB_NAME"
echo "║  Host: $DB_HOST"
echo "║  Arquivo: $BACKUP_FILE"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
read -r -p "Digite RESTAURAR para confirmar: " CONFIRM
[[ "$CONFIRM" == "RESTAURAR" ]] || die "Cancelado"

export PGPASSWORD="$DB_PASS"
gunzip -c "$BACKUP_FILE" | psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  --single-transaction
unset PGPASSWORD

echo ""
echo "Restore concluído."
