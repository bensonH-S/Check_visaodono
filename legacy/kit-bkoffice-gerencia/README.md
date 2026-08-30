# Kit BK Office — PC Gerência (coletor BR)

**Papel:** PC brasileiro = coletor (Chrome → Excel → POST). VPS = cérebro (parse, estoque, Postgres).

Bright Data no VPS ficou como rota secundária; Akamai pode bloquear ASN de proxy mesmo com geo BR.

## O que tem nesta pasta

| Caminho | Conteúdo |
|---------|----------|
| `windows/kit-templates/` | Worker Windows, instalador, cofre |
| `windows/GERAR-KIT-GERENCIA.bat` | Empacota o kit para o PC da gerência |
| `GERAR-KIT-PC-GERENCIA.bat` | Atalho da raiz (histórico) |
| `backend/*` | Espelhos de referência (código vivo está em `backend/src` + `backend/scripts`) |

Módulos vivos no app:

- `backend/src/routes/kitBkOffice.js` — `/auditoria/api/public/kit/*`
- `backend/src/services/bkoffice/kitSyncLease.js`
- `backend/scripts/sync-bkoffice-via-api.mjs` — download local + upload HTTPS

## Reativar (VPS + PC)

### 1) VPS `.env`

```env
BKOFFICE_KIT_ENABLED=1
BKOFFICE_KIT_TOKEN=<hex 64 chars — mesmo do vault do kit>
# Opcional: pausar scheduler VPS enquanto o kit é a rota principal
BKOFFICE_SERVER_SYNC=0
BKOFFICE_SYNC_CRON_MS=0
```

```bash
docker compose up -d --force-recreate app
# log: rotas /public/kit montadas (sem "Kit PC gerência DESLIGADO")
```

### 2) Teste no PC Windows (dev / gerência) — sem Bright Data

```powershell
$env:BKOFFICE_BRIGHTDATA='0'
$env:BKOFFICE_USE_CHROME='1'
# direto no banco (dev):
node backend/scripts/sync-bkoffice-vendas.mjs --loja=21 --db=prod --dias=0
# via API do kit (precisa token + VPS com KIT_ENABLED=1):
node backend/scripts/sync-bkoffice-via-api.mjs --loja=21
```

### 3) Gerar pacote

No `backend/.env` local: `API_BASE`, `BKOFFICE_*`, `BKOFFICE_KIT_TOKEN` (mesmo do VPS).

```bat
legacy\kit-bkoffice-gerencia\windows\GERAR-KIT-GERENCIA.bat
```

Levar a pasta `Desktop\Meridian-BKOffice-Gerencia` → PC gerência → `TESTAR-UMA-VEZ.bat` → `INSTALAR.bat`.

O vault do kit força `BKOFFICE_BRIGHTDATA=0` (IP do PC BR, sem proxy).
