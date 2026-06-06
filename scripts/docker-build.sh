#!/usr/bin/env sh
# Build da imagem Docker com a versão da última tag Git (ex.: v1.1.0).
set -eu

IMAGE_NAME="${1:-vision-check}"
TAG="${GIT_TAG:-$(git describe --tags --abbrev=0 2>/dev/null || true)}"

if [ -n "$TAG" ]; then
  echo "[docker] versão da tag Git: $TAG"
  docker build --build-arg "GIT_TAG=$TAG" -t "${IMAGE_NAME}:latest" -t "${IMAGE_NAME}:${TAG}" .
else
  echo "[docker] nenhuma tag Git encontrada — build sem GIT_TAG (rodapé pode mostrar dev)"
  docker build -t "${IMAGE_NAME}:latest" .
fi
