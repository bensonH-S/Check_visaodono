#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CONTAINER_NAME="${CONTAINER_NAME:-vision-check}"
IMAGE_NAME="${IMAGE_NAME:-vision-check}"
APP_PORT="3007"

if [ -f .env ] && grep -qE '^PORT=' .env; then
  APP_PORT="$(grep -E '^PORT=' .env | head -1 | cut -d= -f2- | tr -d '[:space:]"')"
fi

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

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado em ${SCRIPT_DIR}"
  echo "Crie o arquivo .env na raiz só com DB_* (rotas/porta em server.js)"
  exit 1
fi

mkdir -p Logs uploads
chmod 755 Logs uploads 2>/dev/null || true

INICIO=$(date +%s)

echo ""
echo "Construindo e subindo containers (app + wppconnect, porta ${APP_PORT})..."

export GIT_TAG="${TAG}"

docker compose up -d --build

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
