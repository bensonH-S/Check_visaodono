# Vision Check — Grupo Alvim

Sistema de gestão operacional de lojas BK (checklist, visitas, ranking e não conformidades).

## Stack

- **Frontend:** React 19, Vite 6, TypeScript, MUI, Tailwind, React Router
- **Backend:** Node.js, Express
- **Banco:** PostgreSQL (`vision_check`)

## Configuração

1. Copie `backend/.env.example` para `backend/.env` e preencha as credenciais.
2. Aplique o schema:

```bash
npm run migrate
```

3. Atualize cadastro de lojas (se já rodou migration antes):

```bash
npm run migrate:lojas
```

4. Suba API e frontend juntos:

```bash
npm install
npm run dev
```

Ou separado: `npm run dev:api` e `npm run dev:web`.

- API: http://localhost:5000/api
- App: http://localhost:5173

## Produção — `grupoalvim.com.br/auditoria/`

O app é publicado no **subcaminho** `/auditoria/` (não subdomínio):

| URL | Conteúdo |
|-----|----------|
| `https://grupoalvim.com.br/auditoria/` | Dashboard |
| `https://grupoalvim.com.br/auditoria/ranking` | Ranking |
| `https://grupoalvim.com.br/auditoria/checklist` | Novo checklist |
| `https://grupoalvim.com.br/auditoria/api/health` | Saúde da API |

### 1. `.env` na raiz (produção)

```bash
cp .env.example .env
# PORT=3007, DB_HOST, DB_USER, DB_PASS, ...
```

Desenvolvimento local pode usar `backend/.env` com `PORT=5000`. O `deploy.sh` exige `.env` na **raiz**.

- **Rotas /auditoria/:** `config/server.js`
- **Entrada:** `server.js`

### 2. Deploy no servidor (tag + Docker + Nginx)

```bash
chmod +x deploy.sh
./deploy.sh
```

O script: escolhe tag Git → build do frontend → `docker build` → container na porta **3007** → `systemctl restart nginx`.

Variáveis opcionais: `CONTAINER_NAME`, `IMAGE_NAME` (padrão `vision-check`).

### 3. Desenvolvimento local

```bash
npm run install:all
npm run migrate
npm run dev
```

API local: `http://localhost:5000/api` (se `PORT=5000` no `backend/.env`).

### Docker manual

```bash
docker compose up -d --build
```

Nginx: proxy para `127.0.0.1:3007` — ver `deploy/nginx-grupoalvim-auditoria.conf.example`.

### 3. Nginx (recomendado na frente do Node)

Exemplo em `deploy/nginx-grupoalvim-auditoria.conf.example` — proxy de `/auditoria/` e `/auditoria/api/` para a porta `5000`.

### Desenvolvimento local

Continua em `http://localhost:5173/` (raiz `/`). O build de produção usa base `/auditoria/` automaticamente.

Para testar o caminho de produção no Vite:

```bash
npm run build:web
npm run start
```

## Estrutura

```
server.js           Entrada Node (Nginx/Docker apontam aqui)
config/server.js    Caminho /auditoria e modo produção
deploy.sh           Deploy por tag (porta 3007)
.env                Produção (raiz) — PORT=3007
backend/            Rotas API + migrations PostgreSQL
frontend/           SPA React
deploy/             Exemplo Nginx → porta 3007
Dockerfile          Imagem de produção
```

## Fluxo principal

1. **Novo Checklist** — escolher loja/auditor → iniciar visita → responder perguntas → finalizar.
2. Ao finalizar, triggers atualizam `nota_final`, `lojas.nota_atual` e `historico_notas`.
3. **Dashboard** e **Ranking** leem views `vw_metricas_dashboard` e `vw_ranking_lojas`.
