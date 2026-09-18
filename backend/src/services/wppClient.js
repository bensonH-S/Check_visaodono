import { existsSync } from 'fs';

const DEFAULT_SESSION = 'wpp_visao_check';

function resolverWppHost(raw) {
  const host = String(raw || 'http://localhost').replace(/\/$/, '');
  const hostnameDocker = /\/\/wppconnect$/i.test(host);
  if (hostnameDocker && !existsSync('/.dockerenv')) {
    return 'http://localhost';
  }
  return host || 'http://localhost';
}

export function wppEnabled() {
  return String(process.env.WPP_ENABLED || '').toLowerCase() === 'true';
}

export function isErroRedeWpp(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  const cause = String(err.cause?.message || err.cause || '').toLowerCase();
  const texto = `${msg} ${cause}`;
  return (
    (err.name === 'TypeError' && texto.includes('fetch failed')) ||
    err.name === 'AbortError' ||
    texto.includes('abort') ||
    texto.includes('econnrefused') ||
    texto.includes('enotfound') ||
    texto.includes('econnreset') ||
    texto.includes('network') ||
    texto.includes('wppconnect indisponível') ||
    texto.includes('fetch failed') ||
    texto.includes('getaddrinfo')
  );
}

export function erroRedeWppParaStatus(err) {
  const detalhe = err?.cause?.message || err?.message || 'fetch failed';
  return {
    enabled: true,
    conectado: false,
    servicoIndisponivel: true,
    session: wppConfig().session,
    message: `WPPConnect fora do ar na porta 21465. No servidor rode: sudo bash /var/www/app/Check_visaodono/fix-wpp.sh`,
  };
}

export function wppConfig() {
  const host = resolverWppHost(process.env.WPP_HOST);
  const port = process.env.WPP_PORT || '21465';
  const session = process.env.WPP_SESSION || DEFAULT_SESSION;
  const secretKey = process.env.WPP_SECRET_KEY || 'THISISMYSECURETOKEN';
  return { host, port, session, secretKey, base: `${host}:${port}/api/${session}` };
}

async function wppRequest(path, { method = 'GET', token, body, timeoutMs = 20000 } = {}) {
  const { base } = wppConfig();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const rede = new TypeError(`wppconnect indisponível em ${base}${path}`);
      rede.cause = err;
      throw rede;
    }
    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else if (contentType.includes('image/')) {
      const buf = Buffer.from(await res.arrayBuffer());
      data = { _binary: buf.toString('base64'), _contentType: contentType };
    } else {
      data = { _text: await res.text() };
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function gerarTokenWpp() {
  const { session, secretKey, host, port } = wppConfig();
  const url = `${host}:${port}/api/${session}/${secretKey}/generate-token`;
  let res;
  try {
    res = await fetch(url, { method: 'POST' });
  } catch (err) {
    const rede = new TypeError(`wppconnect indisponível em ${url}`);
    rede.cause = err;
    throw rede;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao gerar token WPP (${res.status}): ${text}`);
  }
  const data = await res.json();
  const token = data.token || '';
  if (!token) throw new Error('Token WPP não retornado');
  return token;
}

export async function verificarConexaoWpp(token) {
  try {
    const { data, ok } = await wppRequest('/check-connection-session', { token, timeoutMs: 8000 });
    const conectado = ok && (data?.status === true || data?.message === 'Connected' || data?.connected === true);
    return { conectado, raw: data };
  } catch (err) {
    return { conectado: false, raw: { error: err.message } };
  }
}

export async function fecharSessaoWpp(token) {
  try {
    await wppRequest('/close-session', { method: 'POST', token, timeoutMs: 8000 });
  } catch {
    /* sessão pode já estar fechada */
  }
}

export async function obterEstadoSessaoWpp(token) {
  try {
    const { data, ok } = await wppRequest('/status-session', { token, timeoutMs: 8000 });
    if (!ok) return { status: 'CLOSED', qrcode: null, raw: data };
    const qr = data?.qrcode || data?.urlcode;
    return {
      status: data?.status || 'CLOSED',
      qrcode: qr ? normalizarQrDataUrl(qr) : null,
      raw: data,
    };
  } catch {
    return { status: 'CLOSED', qrcode: null, raw: null };
  }
}

function normalizarQrDataUrl(qr) {
  if (!qr) return null;
  if (String(qr).startsWith('data:')) return qr;
  return `data:image/png;base64,${qr}`;
}

export function extrairQrcodeResposta(data) {
  if (!data || typeof data !== 'object') return null;
  return normalizarQrDataUrl(data.qrcode || data.urlcode);
}

export function webhookAlvimUrl() {
  const explicit = String(process.env.WPP_WEBHOOK_URL || '').trim();
  if (explicit) return explicit;
  const port = process.argv.includes('--production')
    ? Number(process.env.PORT) || 3007
    : 5000;
  return `http://127.0.0.1:${port}/auditoria/api/wpp/webhook`;
}

export async function iniciarSessaoWpp(token) {
  return wppRequest('/start-session', {
    method: 'POST',
    token,
    body: { waitQrCode: false, webhook: webhookAlvimUrl() },
    timeoutMs: 20000,
  });
}

async function aguardar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function obterQrCodeWpp(token, { tentativas = 12, intervaloMs = 2500 } = {}) {
  for (let i = 0; i < tentativas; i += 1) {
    const estado = await obterEstadoSessaoWpp(token);
    if (estado.qrcode) return { qrcode: estado.qrcode, status: estado.status, raw: estado.raw };

    const { data, ok, status } = await wppRequest('/qrcode-session', { token, timeoutMs: 15000 });
    if (ok && data?._binary) {
      return {
        qrcode: `data:${data._contentType};base64,${data._binary}`,
        status,
        raw: data,
      };
    }
    const qrcode = normalizarQrDataUrl(data?.qrcode || data?.urlcode);
    if (qrcode) return { qrcode, status, raw: data };

    if (i < tentativas - 1) await aguardar(intervaloMs);
  }
  return { qrcode: null, status: null, raw: null };
}

export async function resolverTelefoneWpp(token, telefone) {
  const original = String(telefone);
  if (original.includes('@')) return telefone;

  const { data, ok } = await wppRequest(`/check-number-status/${telefone}`, { token, timeoutMs: 10000 });
  if (!ok) return telefone;

  if (data?.response?.numberExists === false) return telefone;

  const resolved = data?.response?.id || data?.id;
  const serialized =
    typeof resolved === 'object' && resolved?._serialized
      ? resolved._serialized
      : typeof resolved === 'string'
        ? resolved
        : null;

  // @lid quebra send-message no wppconnect — enviar com número BR funciona
  if (serialized && (serialized.endsWith('@c.us') || serialized.endsWith('@g.us'))) {
    return serialized;
  }

  return telefone;
}

export async function enviarMensagemWpp(token, telefone, mensagem, opts = {}) {
  const destino = String(telefone || '').trim();
  const isGroup =
    opts.isGroup === true ||
    destino.toLowerCase().includes('@g.us') ||
    /^\d{10,}-\d+/.test(destino);
  const phone = isGroup ? destino : await resolverTelefoneWpp(token, telefone);
  const { ok, status, data } = await wppRequest('/send-message', {
    method: 'POST',
    token,
    body: { phone, message: mensagem, isGroup },
  });
  if (!ok) {
    const err = data?.message || data?._text || JSON.stringify(data);
    throw new Error(`WPP send-message (${status}): ${err}`);
  }
  return data;
}

function idChat(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  if (raw._serialized) return String(raw._serialized).trim();
  if (raw.user && raw.server) return `${raw.user}@${raw.server}`;
  return String(raw.id || raw.chatId || '').trim();
}

function nomeChat(chat) {
  return String(
    chat?.name ||
    chat?.formattedTitle ||
    chat?.contact?.name ||
    chat?.contact?.formattedName ||
    chat?.title ||
    '',
  ).trim();
}

export async function listarGruposWpp(token) {
  const { ok, data } = await wppRequest('/list-chats', {
    method: 'POST',
    token,
    body: { onlyGroups: true, count: 200 },
    timeoutMs: 30000,
  });
  const lista = ok
    ? (Array.isArray(data?.response) ? data.response : Array.isArray(data) ? data : [])
    : [];
  return lista
    .map((chat) => ({
      id: idChat(chat?.id || chat?.chatId || chat),
      nome: nomeChat(chat),
    }))
    .filter((g) => g.id.includes('@g.us') && g.nome);
}

function achatarMsgs(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.flatMap(achatarMsgs);
  if (Array.isArray(raw.messages)) return raw.messages.flatMap(achatarMsgs);
  if (raw.body || raw.content || raw.message) return [raw];
  return [];
}

export async function listarNaoLidasWpp(token) {
  for (const path of ['/unread-messages', '/all-new-messages', '/all-unread-messages']) {
    try {
      const { ok, data } = await wppRequest(path, { token, timeoutMs: 15000 });
      if (!ok) continue;
      const lista = achatarMsgs(data?.response ?? data);
      if (lista.length) return lista;
    } catch {
      /* tenta o próximo */
    }
  }
  return [];
}

export async function listarMensagensChatWpp(token, phone, { count = 8, isGroup = false } = {}) {
  const dest = String(phone || '').trim();
  if (!dest) return [];
  const qs = new URLSearchParams({ count: String(count) });
  const extraChat = isGroup ? '&isGroup=true' : '';
  const caminhos = [
    `/get-messages/${encodeURIComponent(dest)}?${qs}`,
    `/all-messages-in-chat/${encodeURIComponent(dest)}?includeMe=true&includeNotifications=false${extraChat}`,
  ];
  for (const path of caminhos) {
    try {
      const { ok, data } = await wppRequest(path, { token, timeoutMs: 20000 });
      if (!ok) continue;
      const lista = achatarMsgs(data?.response ?? data);
      if (lista.length) return lista;
    } catch {
      /* tenta o próximo */
    }
  }
  return [];
}

export async function marcarLidaWpp(token, phone, isGroup = false) {
  try {
    await wppRequest('/send-seen', {
      method: 'POST',
      token,
      body: { phone, isGroup },
      timeoutMs: 10000,
    });
  } catch {
    /* ignore */
  }
}
