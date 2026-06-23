# Vision Check — Grupo Alvim

Sistema de gestão operacional de lojas BK (checklist, visitas, ranking e não conformidades).

## Stack

- **Frontend:** React 19, Vite 6, TypeScript, MUI, Tailwind, React Router
- **Backend:** Node.js, Express
- **Banco:** PostgreSQL (`vision_check`)

## Configuração

1. Crie `.env` na **raiz** só com `DB_*` (rotas/porta em `server.js`).
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

- API: http://localhost:5000/auditoria/api
- App: http://localhost:5173/auditoria/ (se a 5173 estiver ocupada, o Vite usa 5174)

## Produção — `grupoalvim.com.br/auditoria/`

O app é publicado no **subcaminho** `/auditoria/` (não subdomínio):

| URL | Conteúdo |
|-----|----------|
| `https://grupoalvim.com.br/auditoria/` | Dashboard |
| `https://grupoalvim.com.br/auditoria/ranking` | Ranking |
| `https://grupoalvim.com.br/auditoria/checklist` | Novo checklist |
| `https://grupoalvim.com.br/auditoria/api/health` | Saúde da API |

### 1. `.env` na raiz (produção)

**`.env` na raiz:** apenas banco (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT`, `DB_SSL`).

**Rotas, porta e `/auditoria/`:** editar constantes no topo de `server.js`.

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

API local: `http://localhost:5000/api` (com `PORT=5000` no `.env` da raiz).

### Docker manual (app + WhatsApp)

```bash
docker compose up -d --build
```

WhatsApp (wppconnect) roda em **container separado** na mesma rede Docker. Ver `deploy/WHATSAPP-DOCKER.md`.

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
server.js           .env + rotas /auditoria + API + SPA
deploy.sh           Deploy por tag (porta 3007)
.env                Produção (raiz) — PORT=3007
backend/            Rotas API + migrations PostgreSQL
frontend/           SPA React
deploy/             Exemplo Nginx → porta 3007
Dockerfile          Imagem de produção
```

## Login e perfis

Mesmo modelo do portal de manutenção Grupo Alvim:

| Perfil | Acesso |
|--------|--------|
| **ti** | Vê todo o portal + **Gestão de usuários** (criar, perfil, loja, ativo/senha) |
| **administrador** / **coordenador** | Visão geral, ranking, lojas, NCs, checklist, abrir chamados |
| **gerente** | Checklist e chamados da sua loja |
| **tecnico** | Lista de chamados e assumir atendimento |

```bash
npm run migrate:auth
npm run seed:auth
```

```bash
npm run migrate:ti
npm run seed:auth
```

Usuários de teste (senha `Alvim@2026`): `ti@`, `admin@`, `coordenador@`, `gerente@`, `tecnico@` `@grupoalvim.com.br`

## Portal unificado

Um app (`/auditoria/`) centraliza checklist, chamados e gestão:

| URL (dev) | Função |
|-----------|--------|
| `/auditoria/login` | Entrada |
| `/auditoria/` | Dashboard |
| `/auditoria/checklist` | Visita / checklist (celular) |
| `/auditoria/chamados` | Chamados de manutenção |
| `/auditoria/chamados/novo` | Abrir chamado (celular, fotos) |

```bash
npm run migrate:manutencao
```

Chamados usam **lojas** e **usuários** do `vision_check`. Fotos em `backend/uploads/manut-chamado-{id}/`.

## Fluxo principal

1. **Novo Checklist** — escolher loja/auditor → iniciar visita → responder perguntas → finalizar.
2. Ao finalizar, triggers atualizam `nota_final`, `lojas.nota_atual` e `historico_notas`.
3. **Dashboard** e **Ranking** leem views `vw_metricas_dashboard` e `vw_ranking_lojas`.
4. **Manutenção** — abrir chamado com fotos; técnico pode assumir via API (`PATCH .../assumir`).
