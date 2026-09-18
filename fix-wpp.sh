#!/bin/bash
# Instala Chrome + troca o WPP oficial pelo fork meridian + sobe na 21465.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_WPP="${WPP_HOST_DIR:-/var/www/app/wppconnect-server}"
WPP_GIT_REPO="${WPP_GIT_REPO:-git@github.com:bensonH-S/wppconnect-server.git}"
WPP_GIT_HTTPS="${WPP_GIT_HTTPS:-https://github.com/bensonH-S/wppconnect-server.git}"
WPP_GIT_BRANCH="${WPP_GIT_BRANCH:-meridian}"
UNIT_SRC="$ROOT/deploy/wppconnect.service"
CFG_SRC="$ROOT/deploy/wppconnect-host-config.js"

wpp_no_ar() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:21465/ || true)"
  [ -n "$code" ] && [ "$code" != "000" ]
}

preservar_dados_wpp() {
  local dest="$1"
  mkdir -p "$dest"
  for d in userDataDir tokens wppconnect_tokens log; do
    if [ -d "$HOST_WPP/$d" ]; then
      mv "$HOST_WPP/$d" "$dest/$d"
    fi
  done
}

restaurar_dados_wpp() {
  local src="$1"
  for d in userDataDir tokens wppconnect_tokens log; do
    if [ -d "$src/$d" ]; then
      rm -rf "$HOST_WPP/$d"
      mv "$src/$d" "$HOST_WPP/$d"
    fi
  done
}

wpp_eh_fork_meridian() {
  [ -f "$HOST_WPP/src/util/createSessionUtil.ts" ] || return 1
  grep -q 'resolverChromePath' "$HOST_WPP/src/util/createSessionUtil.ts" || return 1
  git -C "$HOST_WPP" remote get-url origin 2>/dev/null | grep -q 'bensonH-S/wppconnect-server' || return 1
}

clonar_wpp_meridian() {
  KEEP="$(mktemp -d /tmp/wpp-keep.XXXXXX)"
  if [ -d "$HOST_WPP" ]; then
    preservar_dados_wpp "$KEEP"
    rm -rf "$HOST_WPP"
  fi
  if ! git clone --branch "$WPP_GIT_BRANCH" "$WPP_GIT_REPO" "$HOST_WPP"; then
    echo "SSH falhou, tenta HTTPS..."
    git clone --branch "$WPP_GIT_BRANCH" "$WPP_GIT_HTTPS" "$HOST_WPP"
  fi
  restaurar_dados_wpp "$KEEP"
  rm -rf "$KEEP"
}

achar_chrome() {
  for c in /usr/bin/google-chrome-stable /usr/bin/google-chrome; do
    if [ -x "$c" ]; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

echo "0) Para o WPP antigo (evita EADDRINUSE na 21465)..."
sudo systemctl stop wppconnect-meridian 2>/dev/null || true
sudo fuser -k 21465/tcp 2>/dev/null || true
docker update --restart=no vision-check-wpp 2>/dev/null || true
docker stop vision-check-wpp 2>/dev/null || true

echo "0b) Libs + Google Chrome (Chromium/Snap o WhatsApp recusa no emparelhamento)..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates fonts-liberation wget \
  libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
  libgbm1 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 \
  libxkbcommon0 libxrandr2 libxshmfence1 \
  >/dev/null || true
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y libasound2t64 libcups2t64 >/dev/null 2>&1 \
  || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y libasound2 libcups2 >/dev/null 2>&1 \
  || true

CHROME_BIN="$(achar_chrome || true)"
if [ -z "$CHROME_BIN" ]; then
  echo "Instala Google Chrome..."
  wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/chrome.deb
  CHROME_BIN="$(achar_chrome || true)"
fi
if [ -z "$CHROME_BIN" ]; then
  echo "ERRO: Google Chrome não instalou. Chromium do Ubuntu não emparelha o WhatsApp."
  exit 1
fi
echo "Chrome: $CHROME_BIN"
export PUPPETEER_EXECUTABLE_PATH="$CHROME_BIN"
export CHROME_PATH="$CHROME_BIN"

echo "1) Fonte do WPPConnect (fork meridian, não o oficial)..."
if wpp_eh_fork_meridian; then
  git -C "$HOST_WPP" fetch origin
  git -C "$HOST_WPP" checkout "$WPP_GIT_BRANCH"
  git -C "$HOST_WPP" reset --hard "origin/$WPP_GIT_BRANCH"
else
  echo "Pasta atual NÃO é o fork do PC. Reclonando $WPP_GIT_BRANCH..."
  clonar_wpp_meridian
fi
echo "HEAD: $(git -C "$HOST_WPP" log -1 --oneline)"

WPP_OWNER="${SUDO_USER:-alvim}"
git config --global --add safe.directory "$HOST_WPP" 2>/dev/null || true
sudo git config --global --add safe.directory "$HOST_WPP" 2>/dev/null || true
sudo chown -R "$WPP_OWNER:$WPP_OWNER" "$HOST_WPP"
echo "Dono da pasta: $WPP_OWNER"

echo "1b) npm install + build..."
sudo -u "$WPP_OWNER" bash -lc "cd '$HOST_WPP' && npm install && npm run build"

if [ -f "$CFG_SRC" ]; then
  cp "$CFG_SRC" "$HOST_WPP/dist/config.js"
  echo "Config host copiada."
fi

if [ -f "$UNIT_SRC" ]; then
  sudo cp "$UNIT_SRC" /etc/systemd/system/wppconnect-meridian.service
  sudo mkdir -p /etc/systemd/system/wppconnect-meridian.service.d
  printf '[Service]\nEnvironment=PUPPETEER_EXECUTABLE_PATH=%s\nEnvironment=CHROME_PATH=%s\n' \
    "$CHROME_BIN" "$CHROME_BIN" | sudo tee /etc/systemd/system/wppconnect-meridian.service.d/chrome.conf >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable wppconnect-meridian >/dev/null 2>&1 || true
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

echo "Pronto. HEAD WPP: $(git -C "$HOST_WPP" log -1 --oneline)"
echo "Chrome: $CHROME_BIN"
echo "Abre Configurações → WhatsApp e clica em Gerar QR Code."
echo "Confere: sudo journalctl -u wppconnect-meridian -n 30 --no-pager | grep -iE 'Chrome:|qrcode|error|libatk'"
