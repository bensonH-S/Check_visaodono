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

if [ -x /usr/bin/chromium-browser ]; then
  export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
elif [ -x /usr/bin/chromium ]; then
  export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
fi

exec node dist/server.js
