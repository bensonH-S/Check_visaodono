#!/bin/bash
# Backup diário do PostgreSQL (vision_check).
# Uso manual: ./deploy/backup-db.sh
# Cron: ./deploy/install-backup-cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"

read_env() {
  local key="$1"
  local default="${2:-}"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "$default"
    return
  fi
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | head -1 || true)"
  if [[ -z "$line" ]]; then
    echo "$default"
    return
  fi
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
RETENTION_DAYS="$(read_env BACKUP_RETENTION_DAYS 30)"
BACKUP_UPLOADS="$(read_env BACKUP_UPLOADS false)"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"
}

die() {
  log "ERRO: $*"
  exit 1
}

[[ -f "$ENV_FILE" ]] || die ".env não encontrado: $ENV_FILE"
[[ -n "$DB_HOST" ]] || die "DB_HOST vazio em $ENV_FILE"
[[ -n "$DB_USER" ]] || die "DB_USER vazio em $ENV_FILE"
[[ -n "$DB_NAME" ]] || die "DB_NAME vazio em $ENV_FILE"

if ! command -v pg_dump >/dev/null 2>&1; then
  die "pg_dump não encontrado. No servidor: sudo apt install postgresql-client"
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date '+%Y%m%d_%H%M%S')"
DB_FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

log "Iniciando backup de $DB_NAME @ $DB_HOST:$DB_PORT"
log "Destino: $DB_FILE"

export PGPASSWORD="$DB_PASS"
if ! pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip -9 >"$DB_FILE"; then
  unset PGPASSWORD
  rm -f "$DB_FILE"
  die "pg_dump falhou"
fi
unset PGPASSWORD

if [[ ! -s "$DB_FILE" ]]; then
  rm -f "$DB_FILE"
  die "Arquivo de backup vazio"
fi

ln -sfn "$(basename "$DB_FILE")" "$BACKUP_DIR/latest.sql.gz"

DB_SIZE="$(du -h "$DB_FILE" | awk '{print $1}')"
log "Backup do banco concluído ($DB_SIZE)"

if [[ "$BACKUP_UPLOADS" == "true" || "$BACKUP_UPLOADS" == "1" ]]; then
  UPLOADS_DIR="$PROJECT_DIR/uploads"
  if [[ -d "$UPLOADS_DIR" ]]; then
    UPLOADS_FILE="$BACKUP_DIR/uploads_${STAMP}.tar.gz"
    log "Compactando uploads/ -> $UPLOADS_FILE"
    tar -czf "$UPLOADS_FILE" -C "$PROJECT_DIR" uploads
    ln -sfn "$(basename "$UPLOADS_FILE")" "$BACKUP_DIR/latest-uploads.tar.gz"
    UP_SIZE="$(du -h "$UPLOADS_FILE" | awk '{print $1}')"
    log "Backup de uploads concluído ($UP_SIZE)"
    find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -type f -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
  else
    log "AVISO: pasta uploads/ não encontrada, pulando"
  fi
fi

REMOVED="$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -print -delete 2>/dev/null | wc -l | tr -d ' ')"
log "Retenção: ${RETENTION_DAYS} dias — $REMOVED arquivo(s) antigo(s) removido(s)"
log "OK"
