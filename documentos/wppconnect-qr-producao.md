# WhatsApp / WPPConnect em produção — o que quebrou e o que resolveu

**Quando:** 17–18 set 2026  
**Sintoma inicial:** em produção o QR Code não gerava (ou gerava e o celular recusava). No PC gerava na hora.  
**Desfecho:** sessão `wpp_visao_check` emparelhada no VPS. Teste no portal: *“Teste Vision Check — notificações WhatsApp ativas.”*

Este texto é o mapa do buraco. Não é o WPPConnect “atualizando sozinho” no Docker. Sem rebuild, clone do fork e **Google Chrome** no host, o QR não existe.

---

## Como tem que ficar (estado certo)

| Peça | Onde | Como |
|------|------|------|
| App Meridian | `/var/www/app/Check_visaodono` | Docker `vision-check`, `network_mode: host`, tag Git (ex.: v3.0.25+) |
| WPPConnect | `/var/www/app/wppconnect-server` | **Host**, não o container Alpine |
| Serviço | `wppconnect-meridian` (systemd) | `node dist/server.js`, porta **21465** |
| Código WPP | fork `bensonH-S/wppconnect-server` branch **`meridian`** | Não é o repo oficial `wppconnect-team` |
| Navegador | `/usr/bin/google-chrome-stable` | **Não** usar `chromium-browser` (Snap) |
| App → WPP | `WPP_HOST=http://127.0.0.1` `WPP_PORT=21465` | Rede do host, não `http://wppconnect` |
| Sessão | `wpp_visao_check` | Tokens em `userDataDir/` + `tokens/` |

Repos:

- App: https://github.com/bensonH-S/Check_visaodono (`Meridian-v3`)
- WPP: https://github.com/bensonH-S/wppconnect-server (`meridian`)

No PC de homolog: `F:\Users\BENSONn\wppconnect-server` + Chrome do Windows. Foi isso que funcionou primeiro.

---

## A sequência do erro (por que apanhamos)

### 1) Docker Alpine (`vision-check-wpp`) não gera QR

O compose antigo subia WPP no Alpine com Chromium do container. Esse Chromium **não emparelha** WhatsApp Web (libs, sandbox, versão).  
Rebuild do container **não** puxa o WPPConnect do PC. Imagem só muda com `DEPLOY_REBUILD_WPP=1` / `fix-wpp.sh` e, mesmo assim, Alpine continua ruim.

**Saída:** parar o container (`restart=no`) e rodar WPP **no host**, igual o PC. App em `network_mode: host` falando com `127.0.0.1:21465`.

### 2) A página matava o Chrome no poll

O front pedia QR a cada 5s e cada pedido chamava `start-session` / `conectar` com `reiniciar`. O Chromium era morto e religado. Nginx dava **504**. API de `/status` e `/qrcode` chegava a **500/502**.

**Saída (app v3.0.22+):** poll só lê **status**. Quem liga o Chrome é **um** clique em Gerar QR Code. Status/QR nunca devem 500 por causa de Chromium.

### 3) O WPP do servidor não era o do PC

O app foi para v3.0.24. A pasta `/var/www/app/wppconnect-server` continuou o **oficial** `v2.8.6` em detached HEAD (`23fa0e0`). Sem os patches (logout, QR, Chrome do sistema, wppconnect 2.2).

O `deploy.sh` antigo via `.git` e fazia fetch no origin oficial. **Não trocava** para o fork.

**Saída:** fork no GitHub (`meridian`) e `fix-wpp.sh` / `deploy.sh` **reclonam** se a pasta não for `bensonH-S/wppconnect-server` com `resolverChromePath`.

### 4) Não tinha Chrome de verdade no VPS

`ls /usr/bin/google-chrome*` vazio. O script chegou a instalar `chromium-browser` (Snap). O QR **aparecia**, o celular mostrava *“Não foi possível conectar o dispositivo”*.

No PC: Google Chrome. WhatsApp Web recusa Chromium/Snap no handshake.

**Saída:** `.deb` do **Google Chrome Stable**. systemd:

`PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`

Código ignora path que contenha `chromium`.

### 5) `sudo bash fix-wpp.sh` bagunçou dono da pasta

Clone/build como root. `alvim` tomava:

- `fatal: detected dubious ownership`
- `EACCES` no `dist/`
- `tsc` não gravava
- `cp dist/config.js` negado
- systemd: `Cannot find module dist/server.js` → porta 21465 **000**

**Saída:** `chown -R alvim:alvim` na pasta, `git config --global --add safe.directory`, build **como alvim**, só então `systemctl restart`.

### 6) Build TypeScript do fork

Patches usam `qrcode`, `pupBrowser`, `phoneCode` fora do tipo oficial. `tsc` quebrava no VPS.

**Saída:** tipos no fork + `client as any` no close/status. HEAD que compilou: `e4927e4` (depois `1a8788a` para não usar Chromium).

### 7) `EADDRINUSE :::21465`

systemd já escutava e um `npm start` extra tentava a mesma porta.  
**Saída:** um processo só — `wppconnect-meridian`. Sem `nohup npm start` por cima.

### 8) `sendText is not a function`

Sessão no ar **sem** cliente WhatsApp (Chrome nunca emparelhou). O Alvim/teste chamava send. Some quando a sessão está *Connected*.

---

## O que **não** era o problema

- Banco de produção (`DB_USE_PROD`) — o QR é só WPP + Chrome.
- “Docker atualiza o wppconnect sozinho” — **não atualiza**.
- Só dar `git pull` no Check_visaodono — o WPP é **outro** repositório, outra pasta.
- Só rebuild do app — não instala Chrome nem troca o fork.

---

## Como conferir se está saudável

No VPS:

```bash
git -C /var/www/app/Check_visaodono describe --tags --always
git -C /var/www/app/wppconnect-server log -1 --oneline
git -C /var/www/app/wppconnect-server remote -v
google-chrome-stable --version
systemctl is-active wppconnect-meridian
curl -s -o /dev/null -w '21465: %{http_code}\n' http://127.0.0.1:21465/
sudo journalctl -u wppconnect-meridian -n 20 --no-pager
```

Esperado:

- WPP HEAD na branch `meridian` do fork (não tag oficial `v2.8.6` detached)
- Chrome: `/usr/bin/google-chrome-stable` (não chromium)
- `21465: 404` na raiz = Express no ar (normal)
- No log, ao gerar QR: `Chrome: /usr/bin/google-chrome-stable` e depois sessão conectada
- Portal: Configurações → WhatsApp → **Conectado** + envio de teste ok

---

## Operação (quando quebrar de novo)

### Emparelhar de novo

1. Portal → Configurações → WhatsApp → **Gerar QR Code**
2. No celular: WhatsApp → Aparelhos conectados → Conectar aparelho
3. Apontar **na hora** (QR do Zap vence ~20s)
4. Limite de 4 aparelhos no WhatsApp; se lotou, desconecta um

### Atualizar o WPP do PC no servidor

```bash
cd /var/www/app/Check_visaodono
git fetch origin --tags
git checkout -f <tag>          # ou Meridian-v3
sudo bash fix-wpp.sh           # reclona fork, Chrome, build como alvim, systemd
```

Não rode `sudo npm run build` na pasta do WPP e depois `npm` como `alvim` — volta o EACCES.

### Logs

```bash
sudo journalctl -u wppconnect-meridian -n 80 --no-pager
tail -n 80 /var/www/app/wppconnect-server/log/app1.logg
```

Procura: `Chrome:`, `qrcode`, `libatk`, `MODULE_NOT_FOUND`, `EADDRINUSE`, `sendText is not a function`.

### Limpar sessão (só se o emparelhamento corromper)

```bash
sudo systemctl stop wppconnect-meridian
sudo rm -rf /var/www/app/wppconnect-server/userDataDir/wpp_visao_check
sudo rm -rf /var/www/app/wppconnect-server/tokens/wpp_visao_check*
sudo systemctl start wppconnect-meridian
```

Gera QR de novo.

---

## Arquivos que importam no Meridian

- `deploy/wppconnect.service` — unit systemd (user `alvim`, Chrome Stable)
- `deploy/wppconnect-host-config.js` — config de produção (webhook `127.0.0.1:3007`, `autoClose: 0`)
- `fix-wpp.sh` — Chrome Stable + fork `meridian` + build + restart
- `deploy.sh` — no deploy da tag, sincroniza o mesmo WPP (reclona se ainda for o oficial)
- `docker-compose.yml` — app `network_mode: host`; serviço `wppconnect` só no profile `wpp-docker` (não usar)

---

## Lição curta

O PC funcionava porque era **fork meridian + Google Chrome**.  
O VPS falhava porque era **oficial + Alpine/Snap Chromium + poll matando o browser + pasta root**.  
Alinhar as três pontas (código, processo no host, Chrome Stable) foi o que fez o teste de notificação passar.
