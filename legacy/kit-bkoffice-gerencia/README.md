# Kit BK Office — PC Gerência (LEGADO)

**Status:** fora do fluxo de produção.  
**Produção atual:** VPS → Playwright → Bright Data BR → BK Office → Postgres.

O sync automático no servidor (`BKOFFICE_SERVER_SYNC=1` + Bright Data) substitui este kit.

## O que tem nesta pasta

| Caminho | Conteúdo |
|---------|----------|
| `windows/kit-templates/` | Worker Windows, instalador, cofre |
| `windows/GERAR-KIT-GERENCIA.bat` | Empacota o kit para o PC da gerência |
| `GERAR-KIT-PC-GERENCIA.bat` | Atalho da raiz (histórico) |
| `backend/kitBkOffice.route.js` | Cópia da rota `/public/kit/*` |
| `backend/kitSyncLease.js` | Cópia do lease ativo/passivo + heartbeat |
| `backend/sync-bkoffice-via-api.mjs` | Upload Excel do kit → API |

Os módulos **vivos** no app (ainda no tree, desligados por padrão):

- `backend/src/routes/kitBkOffice.js`
- `backend/src/services/bkoffice/kitSyncLease.js`

## Como reativar (se precisar um dia)

1. No `.env` do VPS:
   ```env
   BKOFFICE_KIT_ENABLED=1
   BKOFFICE_KIT_TOKEN=<mesmo token do cofre do kit>
   ```
2. Reiniciar o backend — a rota `/auditoria/api/public/kit/*` volta a montar.
3. Gerar o pacote Windows a partir desta pasta:
   ```bat
   legacy\kit-bkoffice-gerencia\windows\GERAR-KIT-GERENCIA.bat
   ```
4. Instalar no PC BR e apontar `API_BASE` + token.

## Produção (não use o kit)

```env
BKOFFICE_SERVER_SYNC=1
BKOFFICE_SYNC_CRON_MS=600000
BKOFFICE_SYNC_ID_LOJAS=all
BKOFFICE_BRIGHTDATA=1
BRIGHTDATA_PROXY_PASSWORD=...
BKOFFICE_KIT_ENABLED=0
```

Teste manual no VPS:

```bash
node backend/scripts/sync-bkoffice-vendas.mjs --loja=12 --db=prod --dias=0
node backend/scripts/sync-bkoffice-vendas.mjs --todas --db=prod --dias=0
```
