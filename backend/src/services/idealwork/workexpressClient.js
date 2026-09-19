/**
 * Cliente HTTP do Workexpress BK (Ideal Work).
 * Login AJAX + lista de pedidos + XML da NF-e no acompanhamento.
 */
import { chaveDentroDaJanela, dataDentroDaJanela } from '../estoquePersistirNfe.js';

export const WORKEXPRESS_BASE = 'https://loja.workexpress.com.br/bk';
export const WORKEXPRESS_DOMINIO = '59';

function cookieJar() {
  const jar = new Map();
  return {
    save(res) {
      const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
      for (const c of raw) {
        const [nv] = c.split(';');
        const eq = nv.indexOf('=');
        if (eq > 0) jar.set(nv.slice(0, eq).trim(), nv.slice(eq + 1).trim());
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

async function req(jar, url, { method = 'GET', body, accept } = {}) {
  const headers = {
    Cookie: jar.header(),
    Accept: accept || (method === 'POST' ? 'application/json, text/javascript, */*; q=0.01' : '*/*'),
    'X-Requested-With': 'XMLHttpRequest',
    Referer: `${WORKEXPRESS_BASE}/painel/home/pedidos/`,
  };
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? new URLSearchParams(body).toString() : undefined,
    redirect: 'manual',
  });
  jar.save(res);
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, loc: res.headers.get('location'), buf, text: buf.toString('utf8') };
}

export async function loginWorkexpress({ user, pass, onLog = () => {} } = {}) {
  if (!user || !pass) {
    throw Object.assign(new Error('Informe usuário e senha da Ideal Work'), { status: 400 });
  }
  const jar = cookieJar();
  await req(jar, `${WORKEXPRESS_BASE}/`);
  const login = await req(jar, `${WORKEXPRESS_BASE}/painel/ajax/login/`, {
    method: 'POST',
    body: {
      action: 'LOGIN',
      id_dominio: WORKEXPRESS_DOMINIO,
      login: user,
      senha: pass,
    },
  });
  let parsed;
  try {
    parsed = JSON.parse(login.text);
  } catch {
    parsed = {};
  }
  if (parsed.result !== 'logado') {
    throw Object.assign(new Error('Login Ideal Work/Workexpress falhou — confira usuário e senha'), {
      status: 401,
    });
  }
  onLog('login Workexpress BK ok');
  return jar;
}

function parsePedidosHtml(html) {
  const out = [];
  const re = /id_pedido=(\d+)[\s\S]{0,2500}?(\d{2}\/\d{2}\/\d{4})/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({ id_pedido: m[1], data: m[2] });
  }
  const seen = new Set();
  return out.filter((p) => {
    if (seen.has(p.id_pedido)) return false;
    seen.add(p.id_pedido);
    return true;
  });
}

function paginasDoHtml(html) {
  const nums = [...html.matchAll(/[?&]page=(\d+)/gi)].map((m) => Number(m[1])).filter(Boolean);
  return nums.length ? Math.max(...nums) : 1;
}

async function listarPedidos(jar, { dias = 90, onLog = () => {} } = {}) {
  const pedidos = [];
  let maxPage = 1;
  for (let page = 1; page <= maxPage && page <= 20; page += 1) {
    const r = await req(jar, `${WORKEXPRESS_BASE}/painel/home/pedidos/?page=${page}`);
    if (page === 1) maxPage = paginasDoHtml(r.text);
    const lote = parsePedidosHtml(r.text).filter((p) => dataDentroDaJanela(p.data, dias));
    pedidos.push(...lote);
    const todosVelhos = parsePedidosHtml(r.text).every((p) => !dataDentroDaJanela(p.data, dias));
    if (todosVelhos && page > 1) break;
  }
  const seen = new Set();
  const unicos = pedidos.filter((p) => {
    if (seen.has(p.id_pedido)) return false;
    seen.add(p.id_pedido);
    return true;
  });
  onLog(`pedidos Workexpress=${unicos.length}`);
  return unicos;
}

function chavesDoAcompanhamento(html) {
  const chaves = [];
  const re = /xml-nfe\/\?access=(\d{44})/gi;
  let m;
  while ((m = re.exec(html))) chaves.push(m[1]);
  return [...new Set(chaves)];
}

async function baixarXml(jar, chave) {
  const r = await req(jar, `${WORKEXPRESS_BASE}/painel/ajax/xml-nfe/?access=${chave}&importado_ax=0`, {
    accept: 'application/xml,text/xml,*/*',
  });
  const xml = r.text.replace(/^\uFEFF/, '').trim();
  if (!xml.includes('<') || !/infNFe|NFe/i.test(xml)) {
    throw new Error(`XML Ideal Work inválido para chave ${chave}`);
  }
  return xml;
}

/**
 * @returns {Promise<Array<{ chave: string, xml: string, id_pedido: string }>>}
 */
export async function baixarNfesWorkexpress({
  user,
  pass,
  dias = 90,
  meses = 3,
  limit = 80,
  onLog = () => {},
} = {}) {
  const jar = await loginWorkexpress({ user, pass, onLog });
  const pedidos = await listarPedidos(jar, { dias, onLog });
  const alvo = Math.max(1, Number(limit) || 80);
  const downloads = [];
  const vistos = new Set();

  for (const ped of pedidos) {
    if (downloads.length >= alvo) break;
    const ac = await req(
      jar,
      `${WORKEXPRESS_BASE}/painel/pedidos/pedido-acompanhamento/?id_pedido=${ped.id_pedido}`,
    );
    const chaves = chavesDoAcompanhamento(ac.text).filter((c) => chaveDentroDaJanela(c, meses));
    for (const chave of chaves) {
      if (downloads.length >= alvo) break;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      try {
        const xml = await baixarXml(jar, chave);
        downloads.push({ chave, xml, id_pedido: ped.id_pedido });
        onLog(`XML NF ${chave.slice(0, 8)}… pedido ${ped.id_pedido}`);
      } catch (e) {
        onLog(`XML pedido ${ped.id_pedido}: ${e.message}`);
      }
    }
  }
  return downloads;
}
