#!/bin/sh
set -eu

CFG=/usr/src/wpp-server/dist/config.js
SECRET="${WPP_SECRET_KEY:-THISISMYSECURETOKEN}"

if [ -f "$CFG" ]; then
  sed -i "s|__WPP_SECRET_KEY__|${SECRET}|g" "$CFG"
fi

exec node dist/server.js
