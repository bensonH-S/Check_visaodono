#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CONTAINER_NAME="${CONTAINER_NAME:-vision-check}"
WPP_CONTAINER_NAME="${WPP_CONTAINER_NAME:-vision-check-wpp}"
APP_PORT="3007"

if [ -f .env ] && grep -qE '^PORT=' .env; then
  APP_PORT="$(grep -E '^PORT=' .env | head -1 | cut -d= -f2- | tr -d '[:space:]"')"
fi

compose_cmd() {
  # Servidores OVH costumam ter só docker-compose (v1); «docker compose» falha com «unknown shorthand flag: -d»
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  elif docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    echo ""
    echo "ERRO: Docker Compose não está instalado neste servidor."
    echo "O deploy v1.2+ usa compose (app + wppconnect). Instale um dos pacotes:"
    echo "  sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
    echo "  # ou (legado): sudo apt-get install -y docker-compose"
    echo ""
    echo "Depois confira: docker compose version   # ou: docker-compose --version"
    exit 1
  fi
}

compose_suporta_no_build() {
  compose_cmd up -d --help 2>&1 | grep -q '\-\-no-build'
}

compose_e_legado_v1() {
  if ! command -v docker-compose >/dev/null 2>&1; then
    return 1
  fi
  local ver
  ver="$(docker-compose version --short 2>/dev/null || echo "1.0")"
  case "$ver" in
    1.*) return 0 ;;
    *) return 1 ;;
  esac
}

# Remove containers pelos nomes fixos + órfãos «abc123_vision-check-wpp»
remover_containers_servicos() {
  for servico in "$@"; do
    case "$servico" in
      wppconnect) docker rm -f "$WPP_CONTAINER_NAME" 2>/dev/null || true ;;
      app) docker rm -f "$CONTAINER_NAME" 2>/dev/null || true ;;
    esac
  done
  limpar_containers_residuals 'vision-check-wpp'
  limpar_containers_residuals '(^|_)vision-check$'
}

# Recria container(s) para ler .env / environment do compose (restart simples não basta).
compose_up_recreate() {
  if compose_e_legado_v1; then
    # docker-compose 1.29 + --force-recreate → KeyError: ContainerConfig
    echo "(compose v1: removendo container e «up --no-recreate»)"
    remover_containers_servicos "$@"
    compose_cmd up -d --no-recreate "$@"
    return
  fi
  if compose_suporta_no_build; then
    compose_cmd up -d --force-recreate --no-build "$@"
  else
    compose_cmd up -d --force-recreate "$@"
  fi
}

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
  echo ""
  echo "Removendo container legado «${name}» (deploy antigo com docker run)..."
  docker stop "$name" 2>/dev/null || true
  docker rm "$name" 2>/dev/null || true
}

# docker-compose 1.29 deixa containers «396f02d1b082_vision-check-wpp» após recreate falho
limpar_containers_residuals() {
  local padrao="$1"
  local name
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    echo "Removendo container residual «${name}»..."
    docker rm -f "$name" 2>/dev/null || true
  done < <(docker ps -a --format '{{.Names}}' | grep -E "$padrao" || true)
}

compose_build_up() {
  local servico="$1"
  compose_cmd build "$servico"
  compose_up_recreate "$servico"
}

wppconnect_porta_ok() {
  container_rodando "$WPP_CONTAINER_NAME" && docker exec "$WPP_CONTAINER_NAME" node -e \
    "require('http').get('http://127.0.0.1:21465',(r)=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))" \
    2>/dev/null
}

garantir_wppconnect_rodando() {
  if container_rodando "$WPP_CONTAINER_NAME" && ! container_gerido_pelo_compose "$WPP_CONTAINER_NAME"; then
    echo "wppconnect rodando fora do compose — recriando na rede correta..."
    docker stop "$WPP_CONTAINER_NAME" 2>/dev/null || true
    docker rm "$WPP_CONTAINER_NAME" 2>/dev/null || true
  fi

  if container_rodando "$WPP_CONTAINER_NAME" && container_gerido_pelo_compose "$WPP_CONTAINER_NAME"; then
    if wppconnect_porta_ok; then
      echo "wppconnect OK (porta 21465) — mantido sem reiniciar (sessão WhatsApp preservada)."
      return 0
    fi
    echo "wppconnect não responde na 21465 — recriando..."
    compose_up_recreate wppconnect
    return 0
  fi

  if container_existe "$WPP_CONTAINER_NAME"; then
    echo "Iniciando wppconnect via compose..."
    compose_up_recreate wppconnect
    return 0
  fi

  if docker ps -a --format '{{.Names}}' | grep -q 'vision-check-wpp'; then
    echo "Limpando containers wpp residuais de deploy anterior..."
    limpar_containers_residuals 'vision-check-wpp'
  fi

  echo "Instalando wppconnect (build usa cache se já existir)..."
  compose_build_up wppconnect
}

verificar_rede_wpp() {
  if ! container_rodando "$CONTAINER_NAME"; then
    return 0
  fi
  echo "Variáveis WPP no app:"
  docker exec "$CONTAINER_NAME" sh -c 'printenv | grep -E "^WPP_" | sort' 2>/dev/null || true
  echo "Verificando app → wppconnect na rede Docker..."
  if docker exec "$CONTAINER_NAME" node -e "
    fetch('http://wppconnect:21465', { signal: AbortSignal.timeout(5000) })
      .then((r) => { console.log('OK', r.status); process.exit(0); })
      .catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
  " 2>/dev/null; then
    echo "Conectividade wppconnect OK."
    return 0
  fi
  echo ""
  echo "AVISO: o app não alcançou wppconnect:21465."
  echo "  docker ps | grep -E 'vision-check|wpp'"
  echo "  ./reload-env.sh"
  echo ""
}

aguardar_wppconnect() {
  echo "Aguardando wppconnect responder na porta 21465..."
  local i=0
  while [ $i -lt 45 ]; do
    if container_rodando "$WPP_CONTAINER_NAME"; then
      if docker exec "$WPP_CONTAINER_NAME" node -e \
        "require('http').get('http://127.0.0.1:21465',(r)=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))" \
        2>/dev/null; then
        echo "wppconnect pronto."
        return 0
      fi
    fi
    i=$((i + 1))
    sleep 3
  done
  echo "AVISO: wppconnect não respondeu em ~135s — veja: docker logs vision-check-wpp"
}

garantir_rede_compartilhada() {
  # Containers antigos podem estar fora da rede vision-check-net
  if container_rodando "$WPP_CONTAINER_NAME"; then
    if ! docker network inspect vision-check-net >/dev/null 2>&1; then
      compose_cmd up -d --no-recreate wppconnect 2>/dev/null || true
    fi
    if ! docker network inspect vision-check-net -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | grep -q "$WPP_CONTAINER_NAME"; then
      echo "Conectando $WPP_CONTAINER_NAME à rede vision-check-net..."
      docker network connect vision-check-net "$WPP_CONTAINER_NAME" 2>/dev/null || true
    fi
  fi
  if container_rodando "$CONTAINER_NAME"; then
    if ! docker network inspect vision-check-net -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | grep -q "$CONTAINER_NAME"; then
      echo "Conectando $CONTAINER_NAME à rede vision-check-net..."
      docker network connect vision-check-net "$CONTAINER_NAME" 2>/dev/null || true
    fi
  fi
}

reload_env() {
  if [ ! -f .env ]; then
    echo "ERRO: .env não encontrado em ${SCRIPT_DIR}"
    exit 1
  fi

  mkdir -p Logs uploads
  chmod 755 Logs uploads 2>/dev/null || true

  remover_container_legado "$CONTAINER_NAME"
  limpar_containers_residuals '(^|_)vision-check$'
  limpar_containers_residuals 'vision-check-wpp'

  echo ""
  echo "Aplicando .env nos containers (sem build, sem nova tag Git)..."
  echo "  WPP_ENABLED, DB_*, VAPID_*, etc. serão relidos do arquivo .env"
  echo ""

  compose_up_recreate wppconnect app
  aguardar_wppconnect
  garantir_rede_compartilhada
  verificar_rede_wpp

  echo ""
  echo "Variáveis do .env aplicadas com sucesso."
  docker ps --filter "name=vision-check" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "API health: http://127.0.0.1:${APP_PORT}/auditoria/api/health"
}

mostrar_ajuda() {
  echo "Uso:"
  echo "  ./deploy.sh              Deploy de uma tag Git (build + nova versão)"
  echo "  ./deploy.sh reload-env   Aplica mudanças do .env (sem build/deploy)"
  echo "  ./reload-env.sh          Atalho para reload-env"
  echo ""
  echo "Alterou WPP_ENABLED, DB_* ou outra variável no .env?"
  echo "  ./reload-env.sh   (não precisa rodar deploy de novo)"
  echo "  ./fix-wpp.sh      Corrige wppconnect (porta 21465 + rede)"
}

diagnostico_wpp_porta() {
  if ! container_rodando "$WPP_CONTAINER_NAME"; then
    echo "vision-check-wpp não está rodando."
    return 1
  fi
  local linha
  linha="$(docker logs "$WPP_CONTAINER_NAME" 2>&1 | grep -i "running on port" | tail -1 || true)"
  if [ -n "$linha" ]; then
    echo "$linha"
    if echo "$linha" | grep -q "port: 3007"; then
      echo "ERRO: wppconnect na porta 3007 (deveria ser 21465). Rode ./fix-wpp.sh"
      return 1
    fi
  fi
  return 0
}

fix_wpp() {
  if [ ! -f .env ]; then
    echo "ERRO: .env não encontrado em ${SCRIPT_DIR}"
    exit 1
  fi

  echo ""
  echo "=== Corrigir WhatsApp (wppconnect) ==="
  docker ps --filter "name=vision-check" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
  echo ""
  echo "Diagnóstico (porta no log):"
  diagnostico_wpp_porta || true
  echo ""

  limpar_containers_residuals 'vision-check-wpp'

  echo "Rebuild wppconnect (entrypoint força PORT=21465)..."
  compose_cmd build wppconnect
  compose_up_recreate wppconnect

  aguardar_wppconnect
  echo ""
  echo "Após correção:"
  diagnostico_wpp_porta || true

  garantir_rede_compartilhada
  if container_rodando "$CONTAINER_NAME"; then
    echo "Recriando app na mesma rede..."
    compose_up_recreate app
  fi

  verificar_rede_wpp
  echo ""
  echo "Pronto. Abra Configurações → WhatsApp no portal."
}

case "${1:-}" in
  reload-env|env|--reload-env|-e)
    reload_env
    exit 0
    ;;
  fix-wpp|wpp)
    fix_wpp
    exit 0
    ;;
  help|-h|--help)
    mostrar_ajuda
    exit 0
    ;;
esac

# --- Deploy completo (tag Git) ---

DEPLOY_SCRIPT_BACKUP="${TMPDIR:-/tmp}/meridian-deploy-backup.sh"
cp "${BASH_SOURCE[0]}" "$DEPLOY_SCRIPT_BACKUP"

subir_wppconnect() {
  if [ "${DEPLOY_REBUILD_WPP:-}" = "1" ]; then
    echo "Reconstruindo wppconnect (DEPLOY_REBUILD_WPP=1)..."
    limpar_containers_residuals 'vision-check-wpp'
    compose_build_up wppconnect
    return
  fi

  garantir_wppconnect_rodando
}

subir_app() {
  remover_container_legado "$CONTAINER_NAME"
  limpar_containers_residuals '(^|_)vision-check$'

  echo "Construindo imagem do app (Meridian)..."
  compose_build_up app
}

echo "Atualizando tags..."
if ! git fetch origin --tags 2>&1; then
  echo ""
  echo "AVISO: não foi possível buscar tags do remoto (continuando com tags locais)."
  echo "       Se precisar da tag nova: git fetch origin --tags"
  echo ""
fi

listar_tags() {
  if git tag --sort=v:refname "$@" 2>/dev/null; then
    return 0
  fi
  git tag "$@" 2>/dev/null | sort -V
}

listar_tags_com_mensagem() {
  if git tag --sort=v:refname -n 2>/dev/null; then
    return 0
  fi
  while IFS= read -r tag; do
    [ -n "$tag" ] || continue
    git tag -l -n "$tag" "$tag"
  done < <(git tag 2>/dev/null | sort -V)
}

LATEST_TAG="$(listar_tags | tail -n 1)"

echo ""
echo "Última versão disponível: ${LATEST_TAG:-nenhuma}"
echo ""
echo "Tags disponíveis:"
listar_tags_com_mensagem

echo ""

while true; do
  read -r -p "Digite a tag para deploy (ex: ${LATEST_TAG}): " TAG

  if [ -z "$TAG" ]; then
    echo "Nenhuma tag informada!"
    echo ""
    continue
  fi

  if git rev-parse "refs/tags/$TAG" >/dev/null 2>&1; then
    break
  fi

  echo ""
  echo "A versão ${TAG} não existe!"
  echo ""
  echo "Tags disponíveis:"
  listar_tags_com_mensagem
  echo ""
done

echo ""
echo "Iniciando deploy da versão: ${TAG}"

git checkout "tags/${TAG}" -f
cp "$DEPLOY_SCRIPT_BACKUP" "$SCRIPT_DIR/deploy.sh"
chmod +x "$SCRIPT_DIR/deploy.sh"
chmod +x "$SCRIPT_DIR/reload-env.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/fix-wpp.sh" 2>/dev/null || true

if [ ! -f .env ]; then
  echo "ERRO: .env não encontrado em ${SCRIPT_DIR}"
  echo "Crie o arquivo .env na raiz só com DB_* (rotas/porta em server.js)"
  exit 1
fi

mkdir -p Logs uploads
chmod 755 Logs uploads 2>/dev/null || true

INICIO=$(date +%s)

export GIT_TAG="${TAG}"

echo ""
echo "Deploy porta ${APP_PORT} — wppconnect + app Meridian"
echo "(Para forçar rebuild do WhatsApp: DEPLOY_REBUILD_WPP=1 ./deploy.sh)"
echo "(Só mudou .env? Use ./reload-env.sh — sem novo deploy)"
if ! docker compose version >/dev/null 2>&1; then
  echo "AVISO: usando docker-compose legado (1.x). Recomendado: apt install docker-compose-plugin"
fi
echo ""

subir_wppconnect
aguardar_wppconnect
subir_app
garantir_rede_compartilhada
verificar_rede_wpp

echo ""
echo "Limpando notificações antigas de chamados no banco..."
if npm run migrate:notif-chamados-cleanup --prefix backend 2>/dev/null; then
  echo "  Notificações antigas removidas (anexo, novo_chamado, etc.)."
else
  echo "  AVISO: não foi possível rodar migration 057 (rode manualmente: npm run migrate:notif-chamados-cleanup)"
fi

echo ""
echo "Reiniciando nginx..."
sudo systemctl restart nginx

FIM=$(date +%s)
DURACAO=$((FIM - INICIO))

echo ""
echo "Deploy da ${TAG} concluído com sucesso! (${DURACAO}s)"
echo "App: https://grupoalvim.com.br/auditoria/"
echo "API health: http://127.0.0.1:${APP_PORT}/auditoria/api/health"
echo "Logs do projeto: ${SCRIPT_DIR}/Logs/"
echo ""
echo "Alterou o .env depois?  ./reload-env.sh"
echo ""
echo "Containers:"
docker ps --filter "name=vision-check" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
