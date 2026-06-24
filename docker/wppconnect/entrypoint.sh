#!/bin/sh
set -eu

CFG=/usr/src/wpp-server/dist/config.js
SECRET="${WPP_SECRET_KEY:-THISISMYSECURETOKEN}"

if [ -f "$CFG" ]; then
  sed -i "s|__WPP_SECRET_KEY__|${SECRET}|g" "$CFG"
fi

# O .env do projeto define PORT=3007 para o app Meridian — não pode vazar para o wppconnect
export PORT=21465
export NODE_ENV=production

exec node dist/server.js
