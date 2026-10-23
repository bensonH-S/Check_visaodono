/**
 * Leitura dos pedidos do eSupri (Consultas › Pedidos). Só consulta: lista + recibo CSV.
 * Nunca abre carrinho nem confirma nada.
 */
import { chromium } from 'playwright';

const BASE = 'https://www.esupri.com.br';

export function numBr(raw) {
  const s = String(raw ?? '')
    .replace(/[R$\s]/gi, '')
    .replace(/kg$/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function dataBrIso(raw) {
  const m = String(raw || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function fmtBr(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Recibo CSV (latin1): cabeçalho chave;valor e depois a grade de itens. */
export function parseReciboCsv(texto) {
  const linhas = String(texto || '').split(/\r?\n/);
  const cab = {};
  const itens = [];
  let naGrade = false;
  for (const linha of linhas) {
    const cols = linha.split(';');
    if (!naGrade) {
      if (/^codigo$/i.test(String(cols[0]).trim()) && /descri/i.test(cols[1] || '')) {
        naGrade = true;
        continue;
      }
      const k = String(cols[0] || '').trim();
      if (k) cab[k] = cols.slice(1).map((c) => c.trim());
      continue;
    }
    const codigo = String(cols[0] || '').trim();
    if (!/^\d+$/.test(codigo)) continue;
    itens.push({
      codigo,
      descricao: String(cols[1] || '').trim(),
      quantidade: numBr(cols[2]),
      unidade: String(cols[3] || '').trim(),
      valor_unitario: numBr(cols[4]),
      valor_total: numBr(cols[5]),
    });
  }
  return {
    pedido: cab.PEDIDO?.[0] || null,
    cliente_codigo: cab.Cliente?.[0] || null,
    cliente_fantasia: cab.Cliente?.[1] || null,
    entrega_prevista: dataBrIso(cab['Entrega Prevista']?.[0]),
    itens,
  };
}

function mapPedido(p) {
  return {
    codigo: String(p.VE_CODIGO || '').trim(),
    fantasia: String(p.CL_FANTA || '').trim(),
    data_pedido: dataBrIso(p.FMT_DTVENDA),
    hora_pedido: p.VE_HOVEND || null,
    valor_total: numBr(p.FMT_VLLIQU),
    qtd_itens: numBr(p.FMT_ITENS),
    peso_bruto: numBr(p.FMT_PESOB),
    data_entrega: dataBrIso(p.FMT_DTEXPE),
    status: p.FMT_STATUS || null,
    flag_status: p.FLAG_STATUS || null,
    observacao: String(p.Observacao || '').trim() || null,
    portal_inserido_em: p.DateTimeInsert || null,
    portal_atualizado_em: p.DateTimeUpdate || null,
  };
}

/**
 * @param {object} o
 * @param {string} o.user
 * @param {string} o.pass
 * @param {number} [o.dias]
 * @param {(p: object) => boolean} [o.precisaItens] — decide se baixa o recibo do pedido
 * @returns {Promise<Array<object>>} pedidos com `itens` (array) ou `itens: null` quando não baixou
 */
export async function lerPedidosEsupri({
  user,
  pass,
  dias = 60,
  precisaItens = () => true,
  headless = true,
  onLog = () => {},
}) {
  if (!user || !pass) throw Object.assign(new Error('Login eSupri ausente'), { status: 422 });
  const { buildChromiumLaunchOptions } = await import('../playwrightBrowser.js');
  const browser = await chromium.launch(
    buildChromiumLaunchOptions({ headless, preferChromeChannel: process.env.ESUPRI_USE_CHROME !== '0' }),
  );
  try {
    const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1400, height: 900 } });
    const page = await ctx.newPage();
    onLog('login');
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.fill('input[name="login"]', user);
    await page.fill('input[name="senha"]', pass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
      page.locator('button[type="submit"], input[type="submit"]').first().click(),
    ]);
    await page.goto(`${BASE}/esupri.php?Do=consulta.venda`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const temFiltro = await page
      .waitForSelector('#frmFiltro', { state: 'attached', timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    if (!temFiltro) {
      const corpo = await page.locator('body').innerText().catch(() => '');
      if (/index\.html/i.test(page.url()) || /senha|login/i.test(corpo.slice(0, 600))) {
        throw Object.assign(new Error('Login eSupri recusado para esta loja'), { status: 401 });
      }
      throw Object.assign(new Error(`Tela de pedidos do eSupri não abriu (${page.url()})`), { status: 502 });
    }

    const fim = new Date();
    const ini = new Date(Date.now() - Math.max(1, Number(dias) || 60) * 864e5);
    const resp = await page.evaluate(
      async ({ dtIni, dtFim }) => {
        const f = document.querySelector('#frmFiltro');
        f.querySelector('input[name=dtInicio]').value = dtIni;
        f.querySelector('input[name=dtFinal]').value = dtFim;
        const body = new URLSearchParams(new FormData(f)).toString();
        const r = await fetch('/ajax/consulta.venda.lista.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        return r.text();
      },
      { dtIni: fmtBr(ini), dtFim: fmtBr(fim) },
    );
    let brutos;
    try {
      brutos = JSON.parse(resp);
    } catch {
      throw Object.assign(new Error(`Lista de pedidos do eSupri veio inválida: ${String(resp).slice(0, 160)}`), {
        status: 502,
      });
    }
    if (!Array.isArray(brutos)) brutos = [];
    const pedidos = brutos.map(mapPedido).filter((p) => p.codigo);
    onLog(`${pedidos.length} pedidos no portal`);

    for (const p of pedidos) {
      p.itens = null;
      if (!precisaItens(p)) continue;
      const caminho = await page.evaluate(async (cod) => {
        const r = await fetch('/ajax/consulta.venda.recibocsv.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `VE_CODIGO=${encodeURIComponent(cod)}`,
        });
        return r.text();
      }, p.codigo);
      let rel = null;
      try {
        rel = JSON.parse(caminho);
      } catch {
        rel = null;
      }
      if (typeof rel !== 'string' || !rel) {
        onLog(`${p.codigo}: recibo indisponível`);
        continue;
      }
      const url = /^https?:/i.test(rel) ? rel : `${BASE}/${rel.replace(/^\/+/, '')}`;
      const r = await ctx.request.get(url);
      if (!r.ok()) {
        onLog(`${p.codigo}: recibo HTTP ${r.status()}`);
        continue;
      }
      const recibo = parseReciboCsv((await r.body()).toString('latin1'));
      p.itens = recibo.itens;
      if (!p.data_entrega && recibo.entrega_prevista) p.data_entrega = recibo.entrega_prevista;
      onLog(`${p.codigo}: ${recibo.itens.length} itens`);
    }
    return pedidos;
  } finally {
    await browser.close().catch(() => {});
  }
}
