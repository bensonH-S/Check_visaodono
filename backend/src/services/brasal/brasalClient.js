/**
 * Cliente REST Conecta Brasal (Coca-Cola).
 * Login JWT → pedidos com nota (chave + itens/preço).
 * O PDF do portal (my-order-nf) vem vazio; usamos a API de pedidos.
 */

const DEFAULT_API = 'https://api-users.conectabrasal.com.br';

function numBr(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  // CMPRE vem como "12,96" sem milhar — se falhar, tenta só trocar vírgula
  if (Number.isFinite(n)) return n;
  const n2 = Number(String(v).replace(',', '.'));
  return Number.isFinite(n2) ? n2 : fallback;
}

function asArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function stripMatnr(cod) {
  const s = String(cod || '').trim();
  if (!s) return '';
  // 000000000000000329 → 329 (mantém se não for só zeros)
  const stripped = s.replace(/^0+/, '');
  return stripped || s;
}

function cnpjDaChave(chave) {
  const c = String(chave || '').replace(/\D/g, '');
  return c.length === 44 ? c.slice(6, 20) : '';
}

function numeroDaChave(chave) {
  const c = String(chave || '').replace(/\D/g, '');
  if (c.length !== 44) return '';
  return String(Number(c.slice(25, 34)) || '').trim();
}

function serieDaChave(chave) {
  const c = String(chave || '').replace(/\D/g, '');
  if (c.length !== 44) return '';
  return String(Number(c.slice(22, 25)) || '').trim();
}

/**
 * @param {{ user: string, pass: string, apiBase?: string }} opts
 */
export async function loginBrasal({ user, pass, apiBase = DEFAULT_API } = {}) {
  if (!user || !pass) {
    throw Object.assign(new Error('Informe BRASAL_USER / BRASAL_PASS'), { status: 400 });
  }
  const base = String(apiBase || DEFAULT_API).replace(/\/$/, '');
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw Object.assign(new Error(`Login Brasal: resposta inválida (${res.status})`), {
      status: 502,
    });
  }
  if (!res.ok || !data.access_token) {
    throw Object.assign(new Error(data.message || `Login Brasal falhou (${res.status})`), {
      status: res.status || 401,
    });
  }
  return {
    token: data.access_token,
    clientCode: data.user?.clientCode || data.user?.current_client?.clientCode || '',
    clientName: data.user?.current_client?.name || '',
  };
}

/**
 * Lista pedidos recentes (com itens e notas quando existirem).
 * @param {{ token: string, dias?: number, apiBase?: string }} opts
 */
export async function listarPedidosBrasal({
  token,
  dias = 30,
  apiBase = DEFAULT_API,
  type = 'all',
  status = 'all',
} = {}) {
  const base = String(apiBase || DEFAULT_API).replace(/\/$/, '');
  const qs = new URLSearchParams({
    dias_pedido: String(Math.max(1, Number(dias) || 30)),
    type,
    status,
  });
  const res = await fetch(`${base}/api/v1/client/my-updated-orders?${qs}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Pedidos Brasal falhou (${res.status})`), { status: res.status });
  }
  const data = await res.json();
  return asArray(data.statusPedidos || data);
}

/**
 * Normaliza um pedido da API → estrutura de NF para o sync.
 * Retorna null se não houver chave de NF.
 */
export function pedidoParaNfe(pedido) {
  const status = pedido?.Status || {};
  const notasRaw = pedido?.Notas;
  const notas =
    !notasRaw || notasRaw === [] || (Array.isArray(notasRaw) && !notasRaw.length)
      ? []
      : asArray(notasRaw.Nota ?? notasRaw);

  const nota = notas.find((n) => n && (n.CHAVE_NF || n.chave_nf)) || null;
  const chave = String(nota?.CHAVE_NF || nota?.chave_nf || '').replace(/\D/g, '');
  if (chave.length !== 44) return null;

  const itensRaw = asArray(pedido?.Itens?.Item ?? pedido?.Itens ?? []);
  const itens = [];
  let idx = 0;
  for (const it of itensRaw) {
    // Ruptura / recusado: ainda assim o preço unitário é válido para custo;
    // mas só entram na NF os que foram remetidos (REMESSA) ou sem ABGRU.
    const abgru = String(it.ABGRU ?? '').trim();
    const remessa = String(it.REMESSA ?? '').trim();
    if (abgru && !remessa) continue;

    idx += 1;
    const vUn = numBr(it.CMPRE);
    const q = numBr(it.KWMENG);
    const codigo = stripMatnr(it.MATNR);
    itens.push({
      nItem: idx,
      codigo,
      codigo_raw: String(it.MATNR || '').trim(),
      ean: '',
      descricao: String(it.ARKTX || '').trim(),
      uCom: String(it.MEINS || 'CX').trim(),
      qCom: q,
      vUnCom: vUn,
      vProd: Math.round(vUn * q * 100) / 100,
    });
  }

  if (!itens.length) return null;

  const nfenum = String(nota.NFENUM || '').trim();
  const numero = nfenum.split('-')[0]?.replace(/^0+/, '') || numeroDaChave(chave);
  const serie = (nfenum.includes('-') ? nfenum.split('-')[1] : '') || serieDaChave(chave);
  const emissao = String(nota.DOCDAT || status.ERDAT || '').slice(0, 10) || null;
  const valor_total = itens.reduce((s, it) => s + (it.vProd || 0), 0);

  return {
    pedido: String(status.VBELN || '').trim(),
    status_pedido: String(status.STATUS || '').trim(),
    chave,
    numero,
    serie,
    emissao,
    valor_total: Math.round(valor_total * 100) / 100,
    emitente: {
      cnpj: cnpjDaChave(chave),
      nome: 'BRASAL REFRIGERANTES S A',
    },
    itens,
    nfenum,
  };
}

/**
 * Baixa NFs (via API de pedidos) com limite.
 * @returns {Promise<Array<ReturnType<typeof pedidoParaNfe>>>}
 */
export async function baixarNfesBrasal({
  user,
  pass,
  apiBase = process.env.BRASAL_API_URL || DEFAULT_API,
  dias = 45,
  limit = 10,
  onLog = () => {},
} = {}) {
  onLog('login API Brasal');
  const { token, clientCode, clientName } = await loginBrasal({ user, pass, apiBase });
  onLog(`cliente ${clientCode} ${clientName}`);

  onLog(`pedidos dias=${dias}`);
  const pedidos = await listarPedidosBrasal({ token, dias, apiBase });
  onLog(`pedidos=${pedidos.length}`);

  const nfs = [];
  for (const p of pedidos) {
    if (nfs.length >= Math.max(1, Number(limit) || 10)) break;
    const nfe = pedidoParaNfe(p);
    if (!nfe) continue;
    onLog(`NF ${nfe.nfenum || nfe.numero} pedido ${nfe.pedido} itens=${nfe.itens.length}`);
    nfs.push(nfe);
  }
  return nfs;
}
