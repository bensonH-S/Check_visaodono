#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Preserva deploy.sh atual: git checkout da tag não deve reverter este script no disco
DEPLOY_SCRIPT_BACKUP="${TMPDIR:-/tmp}/meridian-deploy-backup.sh"
cp "${BASH_SOURCE[0]}" "$DEPLOY_SCRIPT_BACKUP"

CONTAINER_NAME="${CONTAINER_NAME:-vision-check}"
WPP_CONTAINER_NAME="${WPP_CONTAINER_NAME:-vision-check-wpp}"
APP_PORT="3007"

if [ -f .env ] && grep -qE '^PORT=' .env; then
  APP_PORT="$(grep -E '^PORT=' .env | head -1 | cut -d= -f2- | tr -d '[:space:]"')"
fi

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo ""
    echo "ERRO: Docker Compose não está instalado neste servidor."
    echo "O deploy v1.2+ usa compose (app + wppconnect). Instale um dos pacotes:"
    echo "  sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
    echo "  # ou (legado): sudo apt-get install -y docker-compose"
    echo ""
    echo "Depois confira: docker compose version   # ou: docker-compose --version"
    exit 1
  fi
}

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
  echo ""
  echo "Removendo container legado «${name}» (deploy antigo com docker run)..."
  docker stop "$name" 2>/dev/null || true
  docker rm "$name" 2>/dev/null || true
}

remover_container() {
  local name="$1"
  if ! container_existe "$name"; then
    return 0
  fi
  docker stop "$name" 2>/dev/null || true
  docker rm "$name" 2>/dev/null || true
}

# docker-compose 1.29 deixa containers «396f02d1b082_vision-check-wpp» após recreate falho
limpar_containers_residuals() {
  local padrao="$1"
  local name
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    echo "Removendo container residual «${name}»..."
    docker rm -f "$name" 2>/dev/null || true
  done < <(docker ps -a --format '{{.Names}}' | grep -E "$padrao" || true)
}

compose_build_up() {
  local servico="$1"
  compose_cmd build "$servico"
  # Nunca «up --build» no compose v1 — recria container antigo e quebra (ContainerConfig)
  compose_cmd up -d --no-recreate "$servico"
}

garantir_wppconnect_rodando() {
  if container_rodando "$WPP_CONTAINER_NAME"; then
    echo "wppconnect já em execução — nenhuma alteração."
    return 0
  fi

  if container_existe "$WPP_CONTAINER_NAME"; then
    echo "Iniciando wppconnect (container existente)..."
    docker start "$WPP_CONTAINER_NAME"
    return 0
  fi

  # Órfãos de deploy falho impedem detecção do nome correto
  if docker ps -a --format '{{.Names}}' | grep -q 'vision-check-wpp'; then
    echo "Limpando containers wpp residuais de deploy anterior..."
    limpar_containers_residuals 'vision-check-wpp'
  fi

  echo "Instalando wppconnect (build usa cache se já existir)..."
  compose_build_up wppconnect
}

subir_wppconnect() {
  if [ "${DEPLOY_REBUILD_WPP:-}" = "1" ]; then
    echo "Reconstruindo wppconnect (DEPLOY_REBUILD_WPP=1)..."
    limpar_containers_residuals 'vision-check-wpp'
    compose_build_up wppconnect
    return
  fi

  garantir_wppconnect_rodando
}

subir_app() {
  remover_container_legado "$CONTAINER_NAME"
  limpar_containers_residuals '(^|_)vision-check$'

  echo "Construindo imagem do app (Meridian)..."
  compose_build_up app
}

echo "Atualizando tags..."
if ! git fetch origin --tags 2>&1; then
  echo ""
  echo "AVISO: não foi possível buscar tags do remoto (continuando com tags locais)."
  echo "       Se precisar da tag nova: git fetch origin --tags"
  echo ""
fi

listar_tags() {
  if git tag --sort=v:refname "$@" 2>/dev/null; then
    return 0
  fi
  git tag "$@" 2>/dev/null | sort -V
}

listar_tags_com_mensagem() {
  if git tag --sort=v:refname -n 2>/dev/null; then
    return 0
  fi
  while IFS= read -r tag; do
    [ -n "$tag" ] || continue
    git tag -l -n "$tag" "$tag"
  done < <(git tag 2>/dev/null | sort -V)
}

LATEST_TAG="$(listar_tags | tail -n 1)"

echo ""
echo "Última versão disponível: ${LATEST_TAG:-nenhuma}"
echo ""
echo "Tags disponíveis:"
listar_tags_com_mensagem

echo ""

while true; do
  read -r -p "Digite a tag para deploy (ex: ${LATEST_TAG}): " TAG

  if [ -z "$TAG" ]; then
    echo "Nenhuma tag informada!"
    echo ""
    continue
  fi

  if git rev-parse "refs/tags/$TAG" >/dev/null 2>&1; then
    break
  fi

  echo ""
  echo "A versão ${TAG} não existe!"
  echo ""
  echo "Tags disponíveis:"
  listar_tags_com_mensagem
  echo ""
done

echo ""
echo "Iniciando deploy da versão: ${TAG}"

git checkout "tags/${TAG}" -f
cp "$DEPLOY_SCRIPT_BACKUP" "$SCRIPT_DIR/deploy.sh"
chmod +x "$SCRIPT_DIR/deploy.sh"

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado em ${SCRIPT_DIR}"
  echo "Crie o arquivo .env na raiz só com DB_* (rotas/porta em server.js)"
  exit 1
fi

mkdir -p Logs uploads
chmod 755 Logs uploads 2>/dev/null || true

INICIO=$(date +%s)

export GIT_TAG="${TAG}"

echo ""
echo "Deploy porta ${APP_PORT} — wppconnect + app Meridian"
echo "(Para forçar rebuild do WhatsApp: DEPLOY_REBUILD_WPP=1 ./deploy.sh)"
if ! docker compose version >/dev/null 2>&1; then
  echo "AVISO: usando docker-compose legado (1.x). Recomendado: apt install docker-compose-plugin"
fi
echo ""

subir_wppconnect
subir_app

echo ""
echo "Reiniciando nginx..."
sudo systemctl restart nginx

FIM=$(date +%s)
DURACAO=$((FIM - INICIO))

echo ""
echo "Deploy da ${TAG} concluído com sucesso! (${DURACAO}s)"
echo "App: https://grupoalvim.com.br/auditoria/"
echo "API health: http://127.0.0.1:${APP_PORT}/auditoria/api/health"
echo "Logs do projeto: ${SCRIPT_DIR}/Logs/"
echo ""
echo "Containers:"
docker ps --filter "name=vision-check" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
