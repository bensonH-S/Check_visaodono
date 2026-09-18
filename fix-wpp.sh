#!/bin/bash
# Sobe o WPPConnect do HOST (igual o PC). Para o container Alpine que não gera QR.
set -e
HOST_WPP="${WPP_HOST_DIR:-/var/www/app/wppconnect-server}"
CFG_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy/wppconnect-host-config.js"

echo "Parando wppconnect Docker..."
docker update --restart=no vision-check-wpp 2>/dev/null || true
docker stop vision-check-wpp 2>/dev/null || true

if [ ! -d "$HOST_WPP" ]; then
  echo "ERRO: não achei $HOST_WPP"
  exit 1
fi

if [ -f "$CFG_SRC" ]; then
  cp "$CFG_SRC" "$HOST_WPP/dist/config.js"
  echo "Config do Meridian copiada para dist/config.js"
fi

if curl -sf -o /dev/null --max-time 3 http://127.0.0.1:21465/; then
  echo "Já está na porta 21465."
  exit 0
fi

mkdir -p "$HOST_WPP/log"
echo "Iniciando npm start em $HOST_WPP"
cd "$HOST_WPP"
nohup npm start >> "$HOST_WPP/log/meridian-host.log" 2>&1 &
echo "PID $!"
echo "Log: $HOST_WPP/log/meridian-host.log"
echo "Espere ~20s e abra Configurações → WhatsApp."
