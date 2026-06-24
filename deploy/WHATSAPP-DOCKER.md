# WhatsApp (wppconnect) no servidor — Docker

## Deve rodar no Docker?

**Sim — em container separado**, não dentro do `vision-check`.

| Serviço | Container | Porta | Função |
|---------|-----------|-------|--------|
| **Meridian** (Check_visaodono) | `vision-check` | 3007 | App + API |
| **wppconnect** | `wppconnect-meridian` | 21465 (rede interna) | Sessão WhatsApp Web |

Motivos:

- wppconnect usa Chromium (pesado, ~1 GB RAM)
- Sessão WhatsApp precisa de **volume persistente** (tokens / userData)
- Ciclo de vida diferente: atualizar o app **não** deve derrubar o WhatsApp

Estrutura no servidor (`/var/www/app/`):

```
/var/www/app/Check_visaodono/
  docker-compose.yml    ← app + wppconnect
  .env                  ← WPP_ENABLED, WPP_SECRET_KEY, etc.
  deploy.sh
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
> O `docker-compose.yml` também força isso no container `app`.

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

- **wppconnect já instalado** → não reconstrói a imagem (só garante que está rodando)
- **container legado `vision-check`** (deploy antigo `docker run`) → remove antes de subir o compose
- **app** → sempre rebuild com a tag escolhida

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

### Erro `KeyError: ContainerConfig` no deploy

Ocorre com **docker-compose 1.29** ao *recriar* containers (ex.: `396f02d1b082_vision-check-wpp`).

**Correção imediata no servidor:**

```bash
docker rm -f $(docker ps -a --format '{{.Names}}' | grep vision-check-wpp) 2>/dev/null || true
docker rm -f vision-check 2>/dev/null || true
./deploy.sh
```

O `deploy.sh` atual remove órfãos antes de subir e usa `build` + `up --no-recreate`.

Recomendado: `sudo apt-get install -y docker-compose-plugin` → `docker compose` (v2).

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
