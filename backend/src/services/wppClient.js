const DEFAULT_SESSION = 'wpp_visao_check';

export function wppEnabled() {
  return String(process.env.WPP_ENABLED || '').toLowerCase() === 'true';
}

export function wppConfig() {
  const host = (process.env.WPP_HOST || 'http://localhost').replace(/\/$/, '');
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
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
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
  const res = await fetch(url, { method: 'POST' });
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
  const { data, ok } = await wppRequest('/check-connection-session', { token, timeoutMs: 10000 });
  const conectado = ok && (data?.status === true || data?.message === 'Connected' || data?.connected === true);
  return { conectado, raw: data };
}

export async function fecharSessaoWpp(token) {
  try {
    await wppRequest('/close-session', { method: 'POST', token, timeoutMs: 10000 });
  } catch {
    /* sessão pode já estar fechada */
  }
}

export async function obterEstadoSessaoWpp(token) {
  const { data, ok } = await wppRequest('/status-session', { token, timeoutMs: 10000 });
  if (!ok) return { status: 'CLOSED', qrcode: null, raw: data };
  const qr = data?.qrcode;
  return {
    status: data?.status || 'CLOSED',
    qrcode: qr ? normalizarQrDataUrl(qr) : null,
    raw: data,
  };
}

function normalizarQrDataUrl(qr) {
  if (!qr) return null;
  if (String(qr).startsWith('data:')) return qr;
  return `data:image/png;base64,${qr}`;
}

export async function iniciarSessaoWpp(token) {
  return wppRequest('/start-session', {
    method: 'POST',
    token,
    body: { waitQrCode: false },
    timeoutMs: 15000,
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
  if (String(telefone).includes('@')) return telefone;
  const { data, ok } = await wppRequest(`/check-number-status/${telefone}`, { token, timeoutMs: 10000 });
  if (!ok) return telefone;
  const resolved = data?.response?.id || data?.id;
  if (typeof resolved === 'object' && resolved?._serialized) return resolved._serialized;
  if (typeof resolved === 'string') return resolved;
  return telefone;
}

export async function enviarMensagemWpp(token, telefone, mensagem) {
  const phone = await resolverTelefoneWpp(token, telefone);
  const { ok, status, data } = await wppRequest('/send-message', {
    method: 'POST',
    token,
    body: { phone, message: mensagem, isGroup: false },
  });
  if (!ok) {
    const err = data?.message || data?._text || JSON.stringify(data);
    throw new Error(`WPP send-message (${status}): ${err}`);
  }
  return data;
}
