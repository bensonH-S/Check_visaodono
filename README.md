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

- API: http://localhost:5000
- App: http://localhost:5173

## Estrutura

```
backend/          API Express + migrations PostgreSQL
frontend/         SPA React
estrutura_db.txt  Referência original (MySQL)
```

## Fluxo principal

1. **Novo Checklist** — escolher loja/auditor → iniciar visita → responder perguntas → finalizar.
2. Ao finalizar, triggers atualizam `nota_final`, `lojas.nota_atual` e `historico_notas`.
3. **Dashboard** e **Ranking** leem views `vw_metricas_dashboard` e `vw_ranking_lojas`.
