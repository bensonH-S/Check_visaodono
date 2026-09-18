#!/bin/bash
# Sobe o WPPConnect do HOST na 21465 e faz o app alcançar 127.0.0.1 (rede host).
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_WPP="${WPP_HOST_DIR:-/var/www/app/wppconnect-server}"
UNIT_SRC="$ROOT/deploy/wppconnect.service"
CFG_SRC="$ROOT/deploy/wppconnect-host-config.js"

echo "1) Para o container Alpine..."
docker update --restart=no vision-check-wpp 2>/dev/null || true
docker stop vision-check-wpp 2>/dev/null || true

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
else
  mkdir -p "$HOST_WPP/log"
  cd "$HOST_WPP"
  nohup npm start >> "$HOST_WPP/log/meridian-host.log" 2>&1 &
fi

echo "2) Espera a porta 21465..."
i=0
while [ "$i" -lt 20 ]; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:21465/; then
    echo "WPP no ar em http://127.0.0.1:21465"
    break
  fi
  sleep 2
  i=$((i + 1))
done
if ! curl -sf -o /dev/null --max-time 2 http://127.0.0.1:21465/; then
  echo "ERRO: 21465 não respondeu. Log:"
  sudo journalctl -u wppconnect-meridian -n 40 --no-pager || true
  tail -40 "$HOST_WPP/log/meridian-host.log" 2>/dev/null || true
  exit 1
fi

echo "3) Recria o app na rede do host (127.0.0.1:21465)."
cd "$ROOT"
if docker compose version >/dev/null 2>&1; then
  docker compose up -d --force-recreate --no-build app
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up -d --force-recreate --no-build app
else
  echo "Suba o app com ./deploy.sh depois."
fi

echo "Pronto. Abre Configurações → WhatsApp e gera o QR."
