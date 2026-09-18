#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

########################################
# BACKUP SEGURO DO SCRIPT (FIX PRINCIPAL)
########################################

# NÃO usar nome fixo em /tmp (evita conflitos de permissões)
DEPLOY_SCRIPT_BACKUP="$(mktemp /tmp/meridian-deploy-backup.XXXXXX.sh)"
cp "${BASH_SOURCE[0]}" "$DEPLOY_SCRIPT_BACKUP"

# Garante limpeza automática no final do script
trap 'rm -f "$DEPLOY_SCRIPT_BACKUP"' EXIT

########################################
# CONFIGURAÇÕES
########################################

CONTAINER_NAME="${CONTAINER_NAME:-vision-check}"
WPP_CONTAINER_NAME="${WPP_CONTAINER_NAME:-vision-check-wpp}"
HOST_WPP="${WPP_HOST_DIR:-/var/www/app/wppconnect-server}"
APP_PORT="3007"

if [ -f .env ] && grep -qE '^PORT=' .env; then
  APP_PORT="$(grep -E '^PORT=' .env | head -1 | cut -d= -f2- | tr -d '[:space:]"')"
fi

########################################
# DOCKER COMPOSE WRAPPER
########################################

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo ""
    echo "ERRO: Docker Compose não está instalado neste servidor."
    echo "Instale com:"
    echo "  sudo apt-get install -y docker-compose-plugin"
    echo "  ou: sudo apt-get install -y docker-compose"
    exit 1
  fi
}

########################################
# HELPERS
########################################

container_existe() {
  docker ps -a --format '{{.Names}}' | grep -qx "$1"
}

container_rodando() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

container_gerido_pelo_compose() {
  local project
  project="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$1" 2>/dev/null || true)"
  [ -n "$project" ]
}

remover_container_legado() {
  local name="$1"

  if ! container_existe "$name"; then
    return 0
  fi

  if container_gerido_pelo_compose "$name"; then
    return 0
  fi

  echo "Removendo container legado «${name}»..."
  docker stop "$name" 2>/dev/null || true
  docker rm "$name" 2>/dev/null || true
}

limpar_containers_residuals() {
  local padrao="$1"

  docker ps -a --format '{{.Names}}' | grep -E "$padrao" | while read -r name; do
    [ -z "$name" ] && continue
    echo "Removendo container residual «${name}»..."
    docker rm -f "$name" 2>/dev/null || true
  done
}

compose_build_up() {
  local servico="$1"
  # App precisa recriar para aplicar imagem nova após tag.
  # WPP mantém container se já estiver saudável (start sem rebuild).
  if [ "$servico" = "app" ]; then
    # Força rebuild da imagem (Playwright/Chromium muda entre tags)
    compose_cmd build --pull --no-cache "$servico"
    compose_cmd up -d --force-recreate --remove-orphans "$servico"
  else
    compose_cmd build "$servico"
    compose_cmd up -d --no-recreate "$servico"
  fi
}

########################################
# WPPCONNECT (host — igual o PC)
########################################

parar_wpp_docker() {
  if container_existe "$WPP_CONTAINER_NAME"; then
    echo "Parando wppconnect Docker (Alpine não gera QR)..."
    docker update --restart=no "$WPP_CONTAINER_NAME" 2>/dev/null || true
    docker stop "$WPP_CONTAINER_NAME" 2>/dev/null || true
  fi
}

wpp_host_no_ar() {
  curl -sf -o /dev/null --max-time 3 http://127.0.0.1:21465/ || return 1
}

subir_wppconnect() {
  parar_wpp_docker

  if [ ! -d "$HOST_WPP" ]; then
    echo "ERRO: $HOST_WPP não existe. É o mesmo WPPConnect do PC."
    exit 1
  fi

  if [ -f "$SCRIPT_DIR/deploy/wppconnect-host-config.js" ]; then
    cp "$SCRIPT_DIR/deploy/wppconnect-host-config.js" "$HOST_WPP/dist/config.js"
    echo "Config host copiada para $HOST_WPP/dist/config.js"
  fi

  if [ -f "$SCRIPT_DIR/deploy/wppconnect.service" ]; then
    sudo cp "$SCRIPT_DIR/deploy/wppconnect.service" /etc/systemd/system/wppconnect-meridian.service
    sudo systemctl daemon-reload
    sudo systemctl enable wppconnect-meridian >/dev/null 2>&1 || true
    sudo systemctl restart wppconnect-meridian
    echo "systemd wppconnect-meridian"
  fi

  if wpp_host_no_ar; then
    echo "wppconnect host já na porta 21465."
    return 0
  fi

  echo "Iniciando wppconnect host ($HOST_WPP)..."
  mkdir -p "$HOST_WPP/log"
  (
    cd "$HOST_WPP"
    nohup npm start >> "$HOST_WPP/log/meridian-host.log" 2>&1 &
  )

  i=0
  while [ "$i" -lt 20 ]; do
    sleep 2
    if wpp_host_no_ar; then
      echo "wppconnect host no ar."
      return 0
    fi
    i=$((i + 1))
  done

  echo "AVISO: wppconnect host não respondeu na 21465."
  echo "       journalctl -u wppconnect-meridian -n 40 --no-pager"
  echo "       ou $HOST_WPP/log/meridian-host.log"
}

########################################
# APP
########################################

subir_app() {
  remover_container_legado "$CONTAINER_NAME"
  limpar_containers_residuals 'vision-check'

  echo "Construindo app..."
  compose_build_up app
}

########################################
# GIT TAGS
########################################

# Evita abrir o pager (less) e travar o terminal com "END" na tela.
export GIT_PAGER=cat
export PAGER=cat

verificar_git_repo() {
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "ERRO: este diretório não é um repositório Git."
    exit 1
  fi

  if ! git status >/dev/null 2>&1; then
    echo "ERRO: o Git bloqueou este repositório (dubious ownership)."
    echo "Execute no servidor:"
    echo "  git config --global --add safe.directory $(pwd)"
    echo "ou ajuste o dono da pasta com chown."
    exit 1
  fi
}

verificar_git_repo

echo "Atualizando tags..."
if ! git fetch origin --tags 2>&1; then
  echo "AVISO: não foi possível atualizar todas as tags remotas."
  echo "      Se a tag não aparecer, rode: git fetch origin --tags"
fi

TAGS_RECENTES_QTD="${TAGS_RECENTES_QTD:-10}"

listar_tags() {
  git --no-pager tag --sort=v:refname 2>/dev/null || git --no-pager tag | sort -V
}

TOTAL_TAGS="$(listar_tags | wc -l | tr -d '[:space:]')"
LATEST_TAG="$(listar_tags | tail -n 1)"
mapfile -t TAGS_LIST < <(listar_tags | tail -n "$TAGS_RECENTES_QTD")

echo ""
echo "Deploy — mostrando até ${TAGS_RECENTES_QTD} versões recentes (total no repo: ${TOTAL_TAGS})"
echo "Última versão: ${LATEST_TAG:-nenhuma}"

if [ "$TOTAL_TAGS" -eq 0 ] || [ "${#TAGS_LIST[@]}" -eq 0 ]; then
  echo "Nenhuma tag encontrada. Crie tags no repositório antes do deploy."
  exit 1
fi

echo ""
if [ "$TOTAL_TAGS" -gt "$TAGS_RECENTES_QTD" ]; then
  echo "Versões recentes:"
else
  echo "Versões disponíveis:"
fi

for tag in "${TAGS_LIST[@]}"; do
  [ -z "$tag" ] && continue
  msg="$(git --no-pager tag -l --format='%(contents:subject)' "$tag" 2>/dev/null | head -n 1)"
  if [ -n "$msg" ]; then
    if [ "$tag" = "$LATEST_TAG" ]; then
      printf '  * %s  %s  (mais recente)\n' "$tag" "$msg"
    else
      printf '    %s  %s\n' "$tag" "$msg"
    fi
  else
    if [ "$tag" = "$LATEST_TAG" ]; then
      printf '  * %s  (mais recente)\n' "$tag"
    else
      printf '    %s\n' "$tag"
    fi
  fi
done

if [ "$TOTAL_TAGS" -gt "$TAGS_RECENTES_QTD" ]; then
  echo ""
  echo "Tags mais antigas omitidas. Ver todas: git --no-pager tag --sort=v:refname"
fi

echo ""
echo "────────────────────────────────────────"
if [ -n "$LATEST_TAG" ]; then
  echo "Enter = usar a última versão (${LATEST_TAG})"
fi
echo "Ctrl+C = cancelar o deploy"

########################################
# SELEÇÃO DE TAG
########################################

while true; do
  read -r -p "Digite a tag para deploy: " TAG

  if [ -z "$TAG" ]; then
    if [ -n "$LATEST_TAG" ]; then
      TAG="$LATEST_TAG"
      echo "Usando: $TAG"
      break
    fi
    echo "Tag vazia."
    continue
  fi

  if git rev-parse "refs/tags/$TAG" >/dev/null 2>&1; then
    break
  fi

  echo "Tag «$TAG» não encontrada localmente. Buscando no GitHub..."
  if git fetch origin "refs/tags/${TAG}:refs/tags/${TAG}" 2>&1 || git fetch origin --tags 2>&1; then
    if git rev-parse "refs/tags/$TAG" >/dev/null 2>&1; then
      echo "Tag $TAG obtida com sucesso."
      break
    fi
  fi

  echo "Tag inválida: $TAG (verifique git remote e permissões de fetch)"
done

########################################
# DEPLOY
########################################

echo ""
echo "Iniciando deploy: $TAG"

git checkout "tags/${TAG}" -f

# restaurar script após checkout
cp "$DEPLOY_SCRIPT_BACKUP" "$SCRIPT_DIR/deploy.sh"
chmod +x "$SCRIPT_DIR/deploy.sh"

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado"
  exit 1
fi

mkdir -p Logs uploads
chmod 755 Logs uploads 2>/dev/null || true

INICIO=$(date +%s)
export GIT_TAG="${TAG}"

echo ""
echo "Deploy porta ${APP_PORT}"
echo ""

subir_wppconnect
subir_app

echo ""
echo "A reiniciar nginx..."
sudo systemctl restart nginx

FIM=$(date +%s)
echo ""
echo "Deploy concluído em $((FIM - INICIO))s"
echo ""
echo "App: https://grupoalvim.com.br/auditoria/"
echo "API: http://127.0.0.1:${APP_PORT}/auditoria/api/health"
echo ""
echo "Containers ativos:"
docker ps --filter "name=vision-check" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "WPP host (21465):"
curl -sf -o /dev/null --max-time 3 http://127.0.0.1:21465/ && echo "  no ar" || echo "  fora do ar — veja /var/www/app/wppconnect-server/log/"