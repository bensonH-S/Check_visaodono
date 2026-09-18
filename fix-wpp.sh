#!/bin/bash
# Instala libs do Chrome (libatk) + sobe WPP na 21465 + recria o app na rede host.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_WPP="${WPP_HOST_DIR:-/var/www/app/wppconnect-server}"
WPP_GIT_REPO="${WPP_GIT_REPO:-https://github.com/bensonH-S/wppconnect-server.git}"
WPP_GIT_BRANCH="${WPP_GIT_BRANCH:-meridian}"
UNIT_SRC="$ROOT/deploy/wppconnect.service"
CFG_SRC="$ROOT/deploy/wppconnect-host-config.js"

wpp_no_ar() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:21465/ || true)"
  [ -n "$code" ] && [ "$code" != "000" ]
}

echo "0) Libs do Chrome (libatk)..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates fonts-liberation \
  libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
  libasound2 libcups2 libgbm1 libgtk-3-0 \
  libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 \
  libxkbcommon0 libxrandr2 libxshmfence1 \
  >/dev/null

echo "1) Para o container Alpine..."
docker update --restart=no vision-check-wpp 2>/dev/null || true
docker stop vision-check-wpp 2>/dev/null || true

echo "1b) Puxa o WPPConnect do GitHub (o mesmo do PC)..."
if [ -d "$HOST_WPP/.git" ]; then
  git -C "$HOST_WPP" remote set-url origin "$WPP_GIT_REPO"
  git -C "$HOST_WPP" fetch origin
  git -C "$HOST_WPP" checkout "$WPP_GIT_BRANCH"
  git -C "$HOST_WPP" reset --hard "origin/$WPP_GIT_BRANCH"
else
  KEEP="$(mktemp -d /tmp/wpp-keep.XXXXXX)"
  if [ -d "$HOST_WPP" ]; then
    for d in userDataDir tokens wppconnect_tokens log; do
      [ -d "$HOST_WPP/$d" ] && mv "$HOST_WPP/$d" "$KEEP/$d"
    done
    rm -rf "$HOST_WPP"
  fi
  git clone --branch "$WPP_GIT_BRANCH" "$WPP_GIT_REPO" "$HOST_WPP"
  for d in userDataDir tokens wppconnect_tokens log; do
    if [ -d "$KEEP/$d" ]; then
      rm -rf "$HOST_WPP/$d"
      mv "$KEEP/$d" "$HOST_WPP/$d"
    fi
  done
  rm -rf "$KEEP"
fi
(
  cd "$HOST_WPP"
  npm install
  npm run build
)

if [ ! -d "$HOST_WPP" ]; then
  echo "ERRO: não achei $HOST_WPP"
  exit 1
fi

if [ -f "$CFG_SRC" ]; then
  cp "$CFG_SRC" "$HOST_WPP/dist/config.js"
  echo "Config copiada."
fi

if [ -f "$UNIT_SRC" ]; then
  sudo cp "$UNIT_SRC" /etc/systemd/system/wppconnect-meridian.service
  sudo systemctl daemon-reload
  sudo systemctl enable wppconnect-meridian
  sudo systemctl restart wppconnect-meridian
  echo "systemd wppconnect-meridian restart."
fi

echo "2) Espera a porta 21465..."
i=0
while [ "$i" -lt 20 ]; do
  if wpp_no_ar; then
    echo "WPP no ar em http://127.0.0.1:21465"
    break
  fi
  sleep 2
  i=$((i + 1))
done
if ! wpp_no_ar; then
  echo "ERRO: 21465 não respondeu. Log:"
  sudo journalctl -u wppconnect-meridian -n 40 --no-pager || true
  exit 1
fi

echo "3) Recria o app na rede do host (127.0.0.1:21465)."
cd "$ROOT"
if docker compose version >/dev/null 2>&1; then
  docker compose up -d --force-recreate --no-build app
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up -d --force-recreate --no-build app
fi

echo "Pronto. Abre Configurações → WhatsApp e gera o QR."
echo "Chrome tem que subir sem libatk. Confere: sudo journalctl -u wppconnect-meridian -n 20 --no-pager"
