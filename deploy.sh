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

  compose_cmd build "$servico"
  compose_cmd up -d --no-recreate "$servico"
}

########################################
# WPPCONNECT
########################################

garantir_wppconnect_rodando() {
  if container_rodando "$WPP_CONTAINER_NAME"; then
    echo "wppconnect já em execução."
    return 0
  fi

  if container_existe "$WPP_CONTAINER_NAME"; then
    echo "Iniciando wppconnect existente..."
    docker start "$WPP_CONTAINER_NAME"
    return 0
  fi

  echo "Limpando resíduos antigos..."
  limpar_containers_residuals 'vision-check-wpp'

  echo "A iniciar wppconnect..."
  compose_build_up wppconnect
}

subir_wppconnect() {
  if [ "${DEPLOY_REBUILD_WPP:-}" = "1" ]; then
    echo "Rebuild forçado do wppconnect..."
    limpar_containers_residuals 'vision-check-wpp'
    compose_build_up wppconnect
    return
  fi

  garantir_wppconnect_rodando
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

echo "Atualizando tags..."
git fetch origin --tags 2>/dev/null || {
  echo "AVISO: não foi possível atualizar tags remotas."
}

listar_tags() {
  git tag --sort=v:refname 2>/dev/null || git tag | sort -V
}

listar_tags_com_mensagem() {
  git tag --sort=v:refname -n 2>/dev/null || git tag | sort -V
}

LATEST_TAG="$(listar_tags | tail -n 1)"

echo ""
echo "Última versão: ${LATEST_TAG:-nenhuma}"
echo "Tags disponíveis:"
listar_tags_com_mensagem
echo ""

########################################
# SELEÇÃO DE TAG
########################################

while true; do
  read -r -p "Digite a tag para deploy: " TAG

  if [ -z "$TAG" ]; then
    echo "Tag vazia."
    continue
  fi

  if git rev-parse "refs/tags/$TAG" >/dev/null 2>&1; then
    break
  fi

  echo "Tag inválida: $TAG"
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