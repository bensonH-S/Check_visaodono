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

# Só o WhatsApp (mantém sessão ao redeploy do app)
docker compose up -d wppconnect

# App completo (deploy normal)
./deploy.sh
# ou: docker compose up -d --build
```

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
docker logs -f wppconnect-meridian

# Reiniciar só o WPP (raro)
docker compose restart wppconnect

# Redeploy do app sem mexer no WPP
docker compose up -d --build app
```

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
