# WhatsApp (wppconnect) no servidor — Docker

## Deve rodar no Docker?

**Sim — em container separado**, não dentro do `vision-check`.

| Serviço | Container | Porta | Função |
|---------|-----------|-------|--------|
| **Meridian** (Check_visaodono) | `vision-check` | 3007 | App + API |
| **wppconnect** | `vision-check-wpp` | 21465 (rede interna) | Sessão WhatsApp Web |

Motivos:

- wppconnect usa Chromium (pesado, ~1 GB RAM)
- Sessão WhatsApp precisa de **volume persistente** (tokens / userData)
- Ciclo de vida diferente: atualizar o app **não** deve derrubar o WhatsApp

Estrutura no servidor (`/var/www/app/`):

```
/var/www/app/Check_visaodono/
  docker-compose.yml    ← app + wppconnect
  deploy.sh             ← deploy de tag Git
  reload-env.sh         ← aplicar .env sem novo deploy
  .env                  ← WPP_ENABLED, WPP_SECRET_KEY, etc.
```

Não é obrigatório pasta separada em `/var/www/app/wppconnect/` — os dois serviços ficam no **mesmo** `docker-compose.yml` do projeto.

---

## 1. `.env` na raiz (produção)

```env
WPP_ENABLED=true
WPP_HOST=http://wppconnect
WPP_PORT=21465
WPP_SECRET_KEY=troque_por_uma_chave_forte
WPP_SESSION=wpp_visao_check
PUBLIC_APP_URL=https://grupoalvim.com.br
```

> `WPP_HOST=http://wppconnect` é o **nome do serviço** na rede Docker.  
> O `docker-compose.yml` **força** esse host no container `app` (mesmo que o `.env` tenha `localhost`).

**Não use** `WPP_HOST=http://localhost` no `.env` do servidor — só faz sentido em dev local sem Docker.

---

## 2. Primeira subida no servidor

```bash
cd /var/www/app/Check_visaodono
git pull
# .env já configurado

# Deploy normal (build só do app; wppconnect na 1ª vez demora ~5–10 min)
./deploy.sh

# Forçar rebuild do WhatsApp (raro — mudou docker/wppconnect)
DEPLOY_REBUILD_WPP=1 ./deploy.sh
```

O `deploy.sh` detecta automaticamente:

- **wppconnect já instalado e na porta 21465** → **não reinicia** (preserva sessão WhatsApp)
- **wppconnect fora do ar ou porta errada** → recria o container
- **app** → sempre rebuild + recreate com a tag escolhida
- **Forçar rebuild do WPP:** `DEPLOY_REBUILD_WPP=1 ./deploy.sh` ou `./fix-wpp.sh`
- **`.env` após o deploy** → `./reload-env.sh` (recria app + wpp)

---

## 3. Conectar WhatsApp

1. Acesse **Configurações → WhatsApp** no portal (`/auditoria/configuracoes/whatsapp`)
2. Gere o QR Code e escaneie no celular
3. A sessão fica no volume Docker `wpp_tokens` / `wpp_userdata` — **não some** ao redeploy do app

---

## 4. Comandos úteis

```bash
# Status
docker ps | grep -E 'vision-check|wppconnect'

# Logs WhatsApp
docker logs -f vision-check-wpp

# Reiniciar só o WPP (raro)
docker start vision-check-wpp
# ou: docker restart vision-check-wpp

# Redeploy do app sem mexer no WPP
docker compose build app && docker rm -f vision-check && docker compose up -d --no-recreate app
```

### wppconnect sobe na porta 3007 (errado) / `fetch failed`

O `.env` do projeto costuma ter `PORT=3007` para o app. Se o container **wppconnect** carregar esse `.env`, o WPP sobe na **3007** em vez de **21465** — o app chama `wppconnect:21465` e falha.

Confira nos logs: `Server is running on port: 3007` → esse é o bug.

**Correção:** `docker-compose.yml` atual **não** passa `env_file` para o wppconnect e força `PORT=21465`.

No servidor (use `docker-compose` com hífen se não tiver o plugin):

```bash
cd /var/www/app/Check_visaodono
docker-compose up -d --force-recreate wppconnect
docker logs vision-check-wpp --tail 20   # deve mostrar porta 21465
docker exec vision-check node -e "fetch('http://wppconnect:21465').then(r=>console.log('OK',r.status)).catch(e=>console.error(e.message))"
docker-compose up -d --force-recreate app
```

---

### Erro `fetch failed` no `/wpp/status` após deploy

O app reiniciou mas **não alcança** o wppconnect (`http://wppconnect:21465`). Causa comum: container WPP iniciado com `docker start` **fora** da rede do `docker compose`.

**Correção no servidor:**

```bash
cd /var/www/app/Check_visaodono
docker compose up -d wppconnect app
# ou rode o deploy de novo (script atualizado)
./deploy.sh
```

Confirme:

```bash
docker ps | grep -E 'vision-check|wpp'
docker exec vision-check node -e "fetch('http://wppconnect:21465').then(r=>console.log('OK',r.status)).catch(e=>console.error(e.message))"
```

No `.env` de produção: `WPP_ENABLED=true` e `WPP_HOST=http://wppconnect`.

### Mudou alguma variável no `.env`?

`docker restart` **não** relê o `.env`. Recrie os containers:

```bash
cd /var/www/app/Check_visaodono
./reload-env.sh
# equivalente: ./deploy.sh reload-env
```

Leva poucos segundos (sem build, sem tag Git). Aplica `WPP_ENABLED`, `DB_*`, `VAPID_*`, etc.

---

### Erro `KeyError: ContainerConfig` no deploy

Ocorre com **docker-compose 1.29** ao usar `--force-recreate`.  
Os nomes dos **serviços** no compose são `wppconnect` e `app` (não `vision-check-wpp`).

**Correção imediata no servidor:**

```bash
cd /var/www/app/Check_visaodono

# Limpar containers quebrados / órfãos
docker rm -f vision-check-wpp vision-check 2>/dev/null || true
docker rm -f $(docker ps -a --format '{{.Names}}' | grep -E 'vision-check-wpp|_vision-check-wpp') 2>/dev/null || true

# Rebuild e subir (serviços: wppconnect e app)
docker-compose build wppconnect
docker-compose up -d --no-recreate wppconnect
sleep 20
docker logs vision-check-wpp 2>&1 | grep -i "running on port" | tail -1

docker-compose build app
docker rm -f vision-check 2>/dev/null || true
docker-compose up -d --no-recreate app

docker exec vision-check node -e "fetch('http://wppconnect:21465').then(r=>console.log('OK',r.status)).catch(e=>console.error(e.message))"
```

Ou, com o script do projeto: `./fix-wpp.sh` (após `git pull`).

Recomendado a longo prazo: `sudo apt-get install -y docker-compose-plugin` → `docker compose` (v2).

---

## 5. Segurança

- **Não** exponha a porta `21465` na internet (sem `ports:` público no compose)
- Use `WPP_SECRET_KEY` forte e igual no `.env` e no comando do container
- QR Code só via portal autenticado (admin)

---

## 6. Requisitos de RAM

Reserve ~**1,5 GB** extras no servidor para o container wppconnect (Chromium).

---

## Desenvolvimento local (sem Docker)

Continue com wppconnect-server no PC:

```env
WPP_HOST=http://localhost
WPP_PORT=21465
```

O `docker-compose` de produção **não** afeta o dev local.
