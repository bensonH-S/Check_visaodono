#!/bin/bash
# Corrige wppconnect (porta 21465, rede Docker) — use no servidor após git pull.
# Não faz deploy de tag nem rebuild do app Meridian.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
exec "$SCRIPT_DIR/deploy.sh" fix-wpp
