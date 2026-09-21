#!/bin/bash
# Limpa Backup_BD:
#   local  — 3 dias (hoje + 2 anteriores)
#   Drive  — 7 dias
# Uso: ./deploy/limpar-backups-antigos.sh
# Cron / hook: chamado no fim de /var/www/app/scripts/backup_30min.sh

set -euo pipefail

export TZ="${TZ:-America/Sao_Paulo}"

BACKUP_ROOT="${BACKUP_ROOT:-/var/www/app/backups/Backup_BD}"
KEEP_DAYS="${KEEP_DAYS:-3}"
KEEP_DAYS_DRIVE="${KEEP_DAYS_DRIVE:-7}"
REMOTE_BASE="${REMOTE_BASE:-gdrive:Grupo Alvim Backup/Backup_BD}"
RCLONE="${RCLONE:-/usr/bin/rclone}"
RCLONE_CONFIG="${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"
}

fill_keep() {
  local days="$1"
  local -n dest="$2"
  local i day
  for ((i = 0; i < days; i++)); do
    day="$(date -d "today - ${i} days" +%d_%m_%Y)"
    dest["$day"]=1
  done
}

is_day_folder() {
  [[ "$1" =~ ^[0-9]{2}_[0-9]{2}_[0-9]{4}$ ]]
}

limpar_local() {
  if [[ ! -d "$BACKUP_ROOT" ]]; then
    log "Pasta local não existe: $BACKUP_ROOT"
    return 0
  fi
  if [[ ! "$KEEP_DAYS" =~ ^[1-9][0-9]*$ ]]; then
    log "KEEP_DAYS inválido: $KEEP_DAYS"
    return 1
  fi

  declare -A KEEP_LOCAL=()
  fill_keep "$KEEP_DAYS" KEEP_LOCAL
  log "Local — retenção ${KEEP_DAYS} dias: $(printf '%s ' "${!KEEP_LOCAL[@]}")"

  local removed=0 kept=0 skipped=0 name size
  shopt -s nullglob
  for dir in "$BACKUP_ROOT"/*; do
    [[ -d "$dir" ]] || continue
    name="$(basename "$dir")"
    if ! is_day_folder "$name"; then
      skipped=$((skipped + 1))
      log "Local ignorado (nome fora do padrão): $name"
      continue
    fi
    if [[ -n "${KEEP_LOCAL[$name]:-}" ]]; then
      kept=$((kept + 1))
      continue
    fi
    size="$(du -sh "$dir" 2>/dev/null | awk '{print $1}')"
    log "Local apagando $name (${size:-?})"
    rm -rf "$dir"
    removed=$((removed + 1))
  done
  log "Local OK — manteve $kept, apagou $removed, ignorou $skipped"
  df -h "$BACKUP_ROOT" | tail -1 | awk '{print "[disco] "$0}'
}

limpar_drive() {
  if [[ ! -x "$RCLONE" ]]; then
    log "rclone não encontrado ($RCLONE) — pulando Google Drive"
    return 0
  fi
  if [[ ! -f "$RCLONE_CONFIG" ]]; then
    log "rclone.conf não encontrado ($RCLONE_CONFIG) — pulando Google Drive"
    return 0
  fi
  if [[ ! "$KEEP_DAYS_DRIVE" =~ ^[1-9][0-9]*$ ]]; then
    log "KEEP_DAYS_DRIVE inválido: $KEEP_DAYS_DRIVE"
    return 1
  fi

  declare -A KEEP_DRIVE=()
  fill_keep "$KEEP_DAYS_DRIVE" KEEP_DRIVE
  log "Drive — retenção ${KEEP_DAYS_DRIVE} dias: $(printf '%s ' "${!KEEP_DRIVE[@]}")"

  local listing name removed=0 kept=0 skipped=0
  listing="$("$RCLONE" --config "$RCLONE_CONFIG" lsf --dirs-only "$REMOTE_BASE" 2>/dev/null || true)"
  if [[ -z "$listing" ]]; then
    log "Drive sem pastas em $REMOTE_BASE"
    return 0
  fi

  while IFS= read -r name; do
    name="${name%/}"
    name="${name//$'\r'/}"
    [[ -n "$name" ]] || continue
    if ! is_day_folder "$name"; then
      skipped=$((skipped + 1))
      log "Drive ignorado (nome fora do padrão): $name"
      continue
    fi
    if [[ -n "${KEEP_DRIVE[$name]:-}" ]]; then
      kept=$((kept + 1))
      continue
    fi
    log "Drive apagando $name"
    "$RCLONE" --config "$RCLONE_CONFIG" purge "$REMOTE_BASE/$name" --retries 5
    removed=$((removed + 1))
  done <<<"$listing"

  log "Drive OK — manteve $kept, apagou $removed, ignorou $skipped"
}

limpar_local
limpar_drive
log "Fim"
