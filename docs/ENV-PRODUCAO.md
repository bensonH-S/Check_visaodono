# O que levar para o VPS (BK Office)

## Arquivo pronto para colar
Abra e use: `docs/ENV-VPS-BKOFFICE.env`

1. No servidor, edite o `.env` da **raiz** do projeto (o do `docker-compose`).
2. Cole/atualize **só o bloco BK Office + Bright Data** desse arquivo.
3. Preencha `BKOFFICE_PASS` e `BRIGHTDATA_PROXY_PASSWORD` (rotacione a senha de teste).
4. Confirme:
   - `BKOFFICE_SERVER_SYNC=1`
   - `BKOFFICE_USE_CHROME=0` (VPS usa Chromium Playwright)
   - `BKOFFICE_KIT_ENABLED=0`
5. Migration: `backend/migrations/158_bkoffice_bkn_alias.sql`
6. Restart do app/container.
7. Teste:
   ```bash
   node backend/scripts/sync-bkoffice-vendas.mjs --loja=12 --db=prod --dias=0
   ```

## Não precisa recopiar o .env inteiro
DB, JWT, VAPID, WPP, Fulltrack etc. **já devem existir** no VPS.  
Só acrescente/ajuste o bloco BK Office.

## Local (`backend/.env`)
Fica com `BKOFFICE_SERVER_SYNC=0` e `USE_CHROME=1` para CLI neste Windows.  
Produção automática = VPS.
