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
git fetch --tags --quiet

LATEST_TAG=$(git tag --sort=v:refname | tail -n 1)

echo ""
echo "Última versão disponível: ${LATEST_TAG}"
echo ""
echo "Tags disponíveis:"
git tag --sort=v:refname -n

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
  git tag --sort=v:refname -n
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
echo "Construindo imagem Docker (build único, com cache)..."
docker build --build-arg "GIT_TAG=${TAG}" -t "${IMAGE_NAME}" .

echo ""
echo "Substituindo container (porta ${APP_PORT})..."

docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

docker run -d \
  -p "${APP_PORT}:${APP_PORT}" \
  --env-file .env \
  -v "${SCRIPT_DIR}/Logs:/app/Logs" \
  -v "${SCRIPT_DIR}/uploads:/app/uploads" \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  "${IMAGE_NAME}"

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
