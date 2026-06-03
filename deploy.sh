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
git fetch --tags

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
  echo "Copie .env.example para .env e preencha DB_* e PORT=3007"
  exit 1
fi

echo ""
echo "Instalando dependências..."
npm run install:all

echo ""
echo "Build do frontend (produção /auditoria/)..."
npm run build:web

if [ ! -f frontend/dist/index.html ]; then
  echo "ERRO: frontend/dist/index.html não existe. Build do frontend falhou."
  exit 1
fi

mkdir -p Logs uploads
chmod 755 Logs uploads 2>/dev/null || true

echo ""
echo "Reiniciando container (porta ${APP_PORT})..."

docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true

docker build --no-cache -t "${IMAGE_NAME}" .

docker run -d \
  -p "${APP_PORT}:${APP_PORT}" \
  -e "PORT=${APP_PORT}" \
  -e "NODE_ENV=production" \
  --env-file .env \
  -e "TZ=America/Sao_Paulo" \
  -e "APP_TIMEZONE=America/Sao_Paulo" \
  -v "${SCRIPT_DIR}/Logs:/app/Logs" \
  -v "${SCRIPT_DIR}/uploads:/app/uploads" \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  "${IMAGE_NAME}"

echo ""
echo "Reiniciando nginx..."
sudo systemctl restart nginx

echo ""
echo "Deploy da ${TAG} concluído com sucesso!"
echo "App: https://grupoalvim.com.br/auditoria/"
echo "API health: http://127.0.0.1:${APP_PORT}/auditoria/api/health"
echo "Logs: ${SCRIPT_DIR}/Logs/"
