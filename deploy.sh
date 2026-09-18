#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

########################################
# BACKUP SEGURO DO SCRIPT (FIX PRINCIPAL)
########################################

# NÃO usar nome fixo em /tmp (evita conflitos de permissões)
DEPLOY_SCRIPT_BACKUP="$(mktemp /tmp/meridian-deploy-backup.XXXXXX.sh)"
cp "${BASH_SOURCE[0]}" "$DEPLOY_SCRIPT_BACKUP"

# Garante limpeza automática no final do script
trap 'rm -f "$DEPLOY_SCRIPT_BACKUP"' EXIT

########################################
# CONFIGURAÇÕES
########################################

CONTAINER_NAME="${CONTAINER_NAME:-vision-check}"
WPP_CONTAINER_NAME="${WPP_CONTAINER_NAME:-vision-check-wpp}"
HOST_WPP="${WPP_HOST_DIR:-/var/www/app/wppconnect-server}"
WPP_GIT_REPO="${WPP_GIT_REPO:-git@github.com:bensonH-S/wppconnect-server.git}"
WPP_GIT_HTTPS="${WPP_GIT_HTTPS:-https://github.com/bensonH-S/wppconnect-server.git}"
WPP_GIT_BRANCH="${WPP_GIT_BRANCH:-meridian}"
APP_PORT="3007"

if [ -f .env ] && grep -qE '^PORT=' .env; then
  APP_PORT="$(grep -E '^PORT=' .env | head -1 | cut -d= -f2- | tr -d '[:space:]"')"
fi

########################################
# DOCKER COMPOSE WRAPPER
########################################

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo ""
    echo "ERRO: Docker Compose não está instalado neste servidor."
    echo "Instale com:"
    echo "  sudo apt-get install -y docker-compose-plugin"
    echo "  ou: sudo apt-get install -y docker-compose"
    exit 1
  fi
}

########################################
# HELPERS
########################################

container_existe() {
  docker ps -a --format '{{.Names}}' | grep -qx "$1"
}

container_rodando() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

container_gerido_pelo_compose() {
  local project
  project="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$1" 2>/dev/null || true)"
  [ -n "$project" ]
}

remover_container_legado() {
  local name="$1"

  if ! container_existe "$name"; then
    return 0
  fi

  if container_gerido_pelo_compose "$name"; then
    return 0
  fi

  echo "Removendo container legado «${name}»..."
  docker stop "$name" 2>/dev/null || true
  docker rm "$name" 2>/dev/null || true
}

limpar_containers_residuals() {
  local padrao="$1"

  docker ps -a --format '{{.Names}}' | grep -E "$padrao" | while read -r name; do
    [ -z "$name" ] && continue
    echo "Removendo container residual «${name}»..."
    docker rm -f "$name" 2>/dev/null || true
  done
}

compose_build_up() {
  local servico="$1"
  # App precisa recriar para aplicar imagem nova após tag.
  # WPP mantém container se já estiver saudável (start sem rebuild).
  if [ "$servico" = "app" ]; then
    # Força rebuild da imagem (Playwright/Chromium muda entre tags)
    compose_cmd build --pull --no-cache "$servico"
    compose_cmd up -d --force-recreate --remove-orphans "$servico"
  else
    compose_cmd build "$servico"
    compose_cmd up -d --no-recreate "$servico"
  fi
}

########################################
# WPPCONNECT (host — igual o PC)
########################################

parar_wpp_docker() {
  if container_existe "$WPP_CONTAINER_NAME"; then
    echo "Parando wppconnect Docker (Alpine não gera QR)..."
    docker update --restart=no "$WPP_CONTAINER_NAME" 2>/dev/null || true
    docker stop "$WPP_CONTAINER_NAME" 2>/dev/null || true
  fi
}

wpp_host_no_ar() {
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
    git clone --branch "$WPP_GIT_BRANCH" "$WPP_GIT_HTTPS" "$HOST_WPP"
  fi
  restaurar_dados_wpp "$KEEP"
  rm -rf "$KEEP"
}

sync_wpp_fonte() {
  echo "Sincronizando WPPConnect de $WPP_GIT_REPO ($WPP_GIT_BRANCH) → $HOST_WPP"
  sudo systemctl stop wppconnect-meridian 2>/dev/null || true
  sudo fuser -k 21465/tcp 2>/dev/null || true

  if wpp_eh_fork_meridian; then
    git -C "$HOST_WPP" fetch origin
    git -C "$HOST_WPP" checkout "$WPP_GIT_BRANCH"
    git -C "$HOST_WPP" reset --hard "origin/$WPP_GIT_BRANCH"
  else
    echo "Pasta atual é o WPP oficial (não o fork do PC). Reclonando..."
    clonar_wpp_meridian
  fi
  echo "HEAD: $(git -C "$HOST_WPP" log -1 --oneline)"

  echo "Instalando e compilando WPPConnect no host..."
  (
    cd "$HOST_WPP"
    if command -v yarn >/dev/null 2>&1 && [ -f yarn.lock ]; then
      yarn install
      yarn build
    else
      npm install
      npm run build
    fi
  )
}

subir_wppconnect() {
  parar_wpp_docker
  sync_wpp_fonte

  if [ ! -d "$HOST_WPP" ]; then
    echo "ERRO: $HOST_WPP não existe após o clone."
    exit 1
  fi

  if [ -f "$SCRIPT_DIR/deploy/wppconnect-host-config.js" ]; then
    cp "$SCRIPT_DIR/deploy/wppconnect-host-config.js" "$HOST_WPP/dist/config.js"
    echo "Config host copiada para $HOST_WPP/dist/config.js"
  fi

  if [ -f "$SCRIPT_DIR/deploy/wppconnect.service" ]; then
    sudo cp "$SCRIPT_DIR/deploy/wppconnect.service" /etc/systemd/system/wppconnect-meridian.service
    CHROME_BIN=""
    for c in /usr/bin/google-chrome-stable /usr/bin/google-chrome /usr/bin/chromium-browser /usr/bin/chromium; do
      [ -x "$c" ] && CHROME_BIN="$c" && break
    done
    if [ -n "$CHROME_BIN" ]; then
      sudo mkdir -p /etc/systemd/system/wppconnect-meridian.service.d
      printf '[Service]\nEnvironment=PUPPETEER_EXECUTABLE_PATH=%s\nEnvironment=CHROME_PATH=%s\n' \
        "$CHROME_BIN" "$CHROME_BIN" | sudo tee /etc/systemd/system/wppconnect-meridian.service.d/chrome.conf >/dev/null
    fi
    sudo systemctl daemon-reload
    sudo systemctl enable wppconnect-meridian >/dev/null 2>&1 || true
    sudo systemctl restart wppconnect-meridian
    echo "systemd wppconnect-meridian"
  fi

  i=0
  while [ "$i" -lt 20 ]; do
    sleep 2
    if wpp_host_no_ar; then
      echo "wppconnect host no ar."
      return 0
    fi
    i=$((i + 1))
  done

  echo "AVISO: wppconnect host não respondeu na 21465."
  echo "       journalctl -u wppconnect-meridian -n 40 --no-pager"
  echo "       ou $HOST_WPP/log/meridian-host.log"
}

########################################
# APP
########################################

subir_app() {
  remover_container_legado "$CONTAINER_NAME"
  limpar_containers_residuals 'vision-check'

  echo "Construindo app..."
  compose_build_up app
}

########################################
# GIT TAGS
########################################

# Evita abrir o pager (less) e travar o terminal com "END" na tela.
export GIT_PAGER=cat
export PAGER=cat

verificar_git_repo() {
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "ERRO: este diretório não é um repositório Git."
    exit 1
  fi

  if ! git status >/dev/null 2>&1; then
    echo "ERRO: o Git bloqueou este repositório (dubious ownership)."
    echo "Execute no servidor:"
    echo "  git config --global --add safe.directory $(pwd)"
    echo "ou ajuste o dono da pasta com chown."
    exit 1
  fi
}

verificar_git_repo

echo "Atualizando tags..."
if ! git fetch origin --tags 2>&1; then
  echo "AVISO: não foi possível atualizar todas as tags remotas."
  echo "      Se a tag não aparecer, rode: git fetch origin --tags"
fi

TAGS_RECENTES_QTD="${TAGS_RECENTES_QTD:-10}"

listar_tags() {
  git --no-pager tag --sort=v:refname 2>/dev/null || git --no-pager tag | sort -V
}

TOTAL_TAGS="$(listar_tags | wc -l | tr -d '[:space:]')"
LATEST_TAG="$(listar_tags | tail -n 1)"
mapfile -t TAGS_LIST < <(listar_tags | tail -n "$TAGS_RECENTES_QTD")

echo ""
echo "Deploy — mostrando até ${TAGS_RECENTES_QTD} versões recentes (total no repo: ${TOTAL_TAGS})"
echo "Última versão: ${LATEST_TAG:-nenhuma}"

if [ "$TOTAL_TAGS" -eq 0 ] || [ "${#TAGS_LIST[@]}" -eq 0 ]; then
  echo "Nenhuma tag encontrada. Crie tags no repositório antes do deploy."
  exit 1
fi

echo ""
if [ "$TOTAL_TAGS" -gt "$TAGS_RECENTES_QTD" ]; then
  echo "Versões recentes:"
else
  echo "Versões disponíveis:"
fi

for tag in "${TAGS_LIST[@]}"; do
  [ -z "$tag" ] && continue
  msg="$(git --no-pager tag -l --format='%(contents:subject)' "$tag" 2>/dev/null | head -n 1)"
  if [ -n "$msg" ]; then
    if [ "$tag" = "$LATEST_TAG" ]; then
      printf '  * %s  %s  (mais recente)\n' "$tag" "$msg"
    else
      printf '    %s  %s\n' "$tag" "$msg"
    fi
  else
    if [ "$tag" = "$LATEST_TAG" ]; then
      printf '  * %s  (mais recente)\n' "$tag"
    else
      printf '    %s\n' "$tag"
    fi
  fi
done

if [ "$TOTAL_TAGS" -gt "$TAGS_RECENTES_QTD" ]; then
  echo ""
  echo "Tags mais antigas omitidas. Ver todas: git --no-pager tag --sort=v:refname"
fi

echo ""
echo "────────────────────────────────────────"
if [ -n "$LATEST_TAG" ]; then
  echo "Enter = usar a última versão (${LATEST_TAG})"
fi
echo "Ctrl+C = cancelar o deploy"

########################################
# SELEÇÃO DE TAG
########################################

while true; do
  read -r -p "Digite a tag para deploy: " TAG

  if [ -z "$TAG" ]; then
    if [ -n "$LATEST_TAG" ]; then
      TAG="$LATEST_TAG"
      echo "Usando: $TAG"
      break
    fi
    echo "Tag vazia."
    continue
  fi

  if git rev-parse "refs/tags/$TAG" >/dev/null 2>&1; then
    break
  fi

  echo "Tag «$TAG» não encontrada localmente. Buscando no GitHub..."
  if git fetch origin "refs/tags/${TAG}:refs/tags/${TAG}" 2>&1 || git fetch origin --tags 2>&1; then
    if git rev-parse "refs/tags/$TAG" >/dev/null 2>&1; then
      echo "Tag $TAG obtida com sucesso."
      break
    fi
  fi

  echo "Tag inválida: $TAG (verifique git remote e permissões de fetch)"
done

########################################
# DEPLOY
########################################

echo ""
echo "Iniciando deploy: $TAG"

git checkout "tags/${TAG}" -f

# restaurar script após checkout
cp "$DEPLOY_SCRIPT_BACKUP" "$SCRIPT_DIR/deploy.sh"
chmod +x "$SCRIPT_DIR/deploy.sh"

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado"
  exit 1
fi

if ! grep -qE '^ESUPRI_USER=.+' .env; then
  echo ""
  echo "AVISO: ESUPRI_USER ausente no .env da RAIZ (é este arquivo que o Docker lê)."
  echo "       Sem isso as lojas não baixam NF Platlog. Acrescente:"
  echo "         ESUPRI_USER=VERONICA"
  echo "         ESUPRI_PASS=..."
  echo "         ESUPRI_USE_CHROME=0"
  echo "         ESUPRI_SYNC_NFE=1"
  echo "       e recrie o container (docker compose up -d --force-recreate app)."
  echo ""
fi

mkdir -p Logs uploads backend/config
chmod 755 Logs uploads 2>/dev/null || true

INICIO=$(date +%s)
export GIT_TAG="${TAG}"

echo ""
echo "Deploy porta ${APP_PORT}"
echo ""

subir_wppconnect
subir_app

echo ""
echo "Migration sync NF (183)..."
docker exec "$CONTAINER_NAME" node backend/scripts/run-sql.js \
  migrations/183_estoque_sync_fornecedor_todas_lojas.sql --db=prod --yes \
  || echo "AVISO: migration 183 não aplicada — rode no container se o painel de sync estiver vazio."

echo ""
echo "A reiniciar nginx..."
sudo systemctl restart nginx

FIM=$(date +%s)
echo ""
echo "Deploy concluído em $((FIM - INICIO))s"
echo ""
echo "App: https://grupoalvim.com.br/auditoria/"
echo "API: http://127.0.0.1:${APP_PORT}/auditoria/api/health"
echo ""
echo "Containers ativos:"
docker ps --filter "name=vision-check" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "WPP host (21465):"
curl -sf -o /dev/null --max-time 3 http://127.0.0.1:21465/ && echo "  no ar" || echo "  fora do ar — veja /var/www/app/wppconnect-server/log/"