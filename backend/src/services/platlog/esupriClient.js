/**
 * Cliente Playwright do portal eSupri (Platlog).
 * - Financeiro NF-e: AJAX por loja (conta VERONICA) + ZIP/XML
 * - Catálogo Pedido: códigos + PREÇO R$
 */
import { chromium } from 'playwright';

const DEFAULT_BASE = 'https://www.esupri.com.br';

async function launchBrowser({ headless = true, onLog = () => {} } = {}) {
  const useChrome = process.env.ESUPRI_USE_CHROME !== '0';
  const { buildChromiumLaunchOptions } = await import('../playwrightBrowser.js');
  const launchOpts = buildChromiumLaunchOptions({
    headless,
    preferChromeChannel: useChrome,
  });

  onLog(
    `browser exec=${launchOpts.executablePath || launchOpts.channel || 'playwright-chromium'}`,
  );

  try {
    return await chromium.launch(launchOpts);
  } catch (e) {
    if (launchOpts.channel && process.platform === 'win32') {
      onLog(`Chrome canal falhou (${e.message}) — tentando Chromium Playwright`);
      delete launchOpts.channel;
      launchOpts.args = (launchOpts.args || []).filter((a) => a !== '--headless=new');
      return chromium.launch(launchOpts);
    }
    throw e;
  }
}

async function waitLoaderGone(page, timeout = 45000) {
  await page.locator('.loader').waitFor({ state: 'hidden', timeout }).catch(() => {});
}

async function loginEsupri(page, { user, pass, base, onLog = () => {} }) {
  onLog('login');
  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.fill('input[name="login"]', user);
  await page.fill('input[name="senha"]', pass);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
    page.locator('button[type="submit"], input[type="submit"]').first().click(),
  ]);

  onLog('home');
  await page.goto(`${base}/esupri.php?Do=home`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await waitLoaderGone(page);
  const body = await page.locator('body').innerText().catch(() => '');
  if (/usu[aá]rio ou senha|inv[aá]lid|acesso negado/i.test(body) && /login/i.test(page.url())) {
    throw Object.assign(new Error('Login eSupri falhou'), { status: 401 });
  }
}

async function postForm(page, url, fields) {
  return page.evaluate(
    async ({ url: u, fields: f }) => {
      const body = new URLSearchParams();
      for (const [k, v] of Object.entries(f || {})) {
        if (v == null || v === '') continue;
        body.append(k, String(v));
      }
      const res = await fetch(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const text = await res.text();
      try {
        return { ok: res.ok, status: res.status, json: JSON.parse(text), text };
      } catch {
        return { ok: res.ok, status: res.status, json: null, text };
      }
    },
    { url, fields },
  );
}

function parsePrecoBr(raw) {
  const s = String(raw || '')
    .replace(/[R$\s]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lista o catálogo da tela Pedido (código, descrição, unidade, preço caixa).
 * @returns {Promise<Array<{ codigo: string, descricao: string, unidade: string, categoria: string, preco_caixa: number }>>}
 */
export async function listarCatalogoPedidoEsupri({
  user,
  pass,
  baseUrl = DEFAULT_BASE,
  headless = true,
  onLog = () => {},
} = {}) {
  if (!user || !pass) {
    throw Object.assign(new Error('Informe usuário e senha eSupri (ESUPRI_USER / ESUPRI_PASS)'), {
      status: 400,
    });
  }

  const base = String(baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const browser = await launchBrowser({ headless, onLog });
  const context = await browser.newContext({
    acceptDownloads: true,
    locale: 'pt-BR',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();
  const itens = [];
  const vistos = new Set();

  try {
    await loginEsupri(page, { user, pass, base, onLog });

    onLog('pedido');
    const menuPedido = page.locator('#menu_pedido > a, a:has-text("Pedido")').first();
    await menuPedido.click({ timeout: 20000 });
    await page.waitForTimeout(1500);

    // Aguarda tabela de produtos (vários IDs possíveis)
    const tabelaSel = await page.evaluate(() => {
      const cands = [
        '#tbProdutos',
        '#tbPedido',
        'table.dataTable',
        'table.table',
        'table',
      ];
      for (const sel of cands) {
        const t = document.querySelector(sel);
        if (!t) continue;
        const th = (t.querySelector('thead')?.innerText || '').toUpperCase();
        if (th.includes('CÓDIGO') || th.includes('CODIGO') || th.includes('PREÇO') || th.includes('PRECO')) {
          return sel === 'table' ? null : sel;
        }
        const rows = t.querySelectorAll('tbody tr');
        if (rows.length >= 3) return sel === 'table' ? null : sel;
      }
      return null;
    });

    // Prefer DataTables length = máximo
    const lengthSelect = page
      .locator(
        'select[name$="_length"], select[name*="length"], .dataTables_length select',
      )
      .first();
    if (await lengthSelect.count()) {
      await lengthSelect
        .selectOption({ label: /100|50|25|Todos|All/i })
        .catch(() => lengthSelect.selectOption('100').catch(() => {}));
      await page.waitForTimeout(900);
    }

    let pagina = 1;
    while (pagina <= 80) {
      const pageItems = await page.evaluate((preferSel) => {
        const pickTable = () => {
          if (preferSel) {
            const t = document.querySelector(preferSel);
            if (t) return t;
          }
          const tables = [...document.querySelectorAll('table')];
          for (const t of tables) {
            const head = (t.tHead?.innerText || t.querySelector('thead')?.innerText || '').toUpperCase();
            if (
              (head.includes('CODIGO') || head.includes('CÓDIGO')) &&
              (head.includes('PRECO') || head.includes('PREÇO') || head.includes('DESCR'))
            ) {
              return t;
            }
          }
          return tables.find((t) => (t.querySelectorAll('tbody tr') || []).length >= 3) || null;
        };

        const table = pickTable();
        if (!table) return { rows: [], nextDisabled: true };

        const headers = [...(table.tHead?.rows?.[0]?.cells || table.querySelectorAll('thead th'))].map(
          (c) => (c.innerText || '').trim().toUpperCase(),
        );
        const idx = (re) => headers.findIndex((h) => re.test(h));
        const iCod = idx(/C[ÓO]DIGO/);
        const iCat = idx(/CATEGORIA/);
        const iDesc = idx(/DESCRI/);
        const iUn = idx(/^UN\.?$|UNIDADE/);
        const iPreco = idx(/PRE[ÇC]O/);

        const out = [];
        for (const tr of table.querySelectorAll('tbody tr')) {
          const tds = [...tr.querySelectorAll('td')];
          if (!tds.length) continue;
          const get = (i) => (i >= 0 && tds[i] ? (tds[i].innerText || '').trim() : '');
          const codigo = get(iCod >= 0 ? iCod : 1);
          const descricao = get(iDesc >= 0 ? iDesc : 3);
          const precoRaw = get(iPreco >= 0 ? iPreco : 6);
          if (!codigo || !/^\d+$/.test(codigo.replace(/\s/g, ''))) continue;
          out.push({
            codigo: codigo.replace(/\s/g, ''),
            descricao,
            categoria: get(iCat),
            unidade: get(iUn),
            precoRaw,
          });
        }

        const next =
          document.querySelector('.dataTables_paginate .next, .paginate_button.next, a.next, li.next a') ||
          [...document.querySelectorAll('a, button')].find((a) =>
            /pr[oó]xim|next|»/i.test((a.innerText || a.getAttribute('aria-label') || '').trim()),
          );
        const nextDisabled =
          !next ||
          next.classList.contains('disabled') ||
          next.getAttribute('aria-disabled') === 'true' ||
          next.closest('.disabled');

        return { rows: out, nextDisabled: !!nextDisabled };
      }, tabelaSel);

      onLog(`pedido pág ${pagina}: ${pageItems.rows.length} linhas (acum ${itens.length})`);

      for (const r of pageItems.rows) {
        const codigo = String(r.codigo || '').trim();
        if (!codigo || vistos.has(codigo)) continue;
        const preco_caixa = parsePrecoBr(r.precoRaw);
        if (preco_caixa == null || preco_caixa < 0) continue;
        vistos.add(codigo);
        itens.push({
          codigo,
          descricao: String(r.descricao || '').trim(),
          categoria: String(r.categoria || '').trim(),
          unidade: String(r.unidade || '').trim(),
          preco_caixa,
        });
      }

      if (pageItems.nextDisabled) break;

      const nextBtn = page
        .locator(
          '.dataTables_paginate .next:not(.disabled), .paginate_button.next:not(.disabled), a.next:not(.disabled)',
        )
        .first();
      if (!(await nextBtn.count())) break;
      await nextBtn.click();
      await page.waitForTimeout(1100);
      pagina += 1;
    }

    onLog(`catálogo: ${itens.length} produtos`);
    return itens;
  } finally {
    await browser.close();
  }
}

/**
 * @param {{
 *   user: string,
 *   pass: string,
 *   baseUrl?: string,
 *   headless?: boolean,
 *   limit?: number,
 *   esupriLojaCodigo?: string,
 *   onLog?: Function
 * }} opts
 * @returns {Promise<Array<{ notaLabel: string, lojaLabel: string, valorLabel: string, statusLabel: string, zipBuffer: Buffer, fileName: string }>>}
 */
export async function baixarNfesFinanceiroEsupri({
  user,
  pass,
  baseUrl = DEFAULT_BASE,
  headless = true,
  limit = 10,
  esupriLojaCodigo = '',
  onLog = () => {},
} = {}) {
  if (!user || !pass) {
    throw Object.assign(new Error('Informe usuário e senha eSupri (ESUPRI_USER / ESUPRI_PASS)'), {
      status: 400,
    });
  }
  const lojaCodigo = String(esupriLojaCodigo || '').trim();
  if (!lojaCodigo) {
    throw Object.assign(
      new Error(
        'Informe esupriLojaCodigo — a conta VERONICA vê todas as lojas; sem filtro as NFs se misturam',
      ),
      { status: 400 },
    );
  }

  const base = String(baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const browser = await launchBrowser({ headless, onLog });
  const context = await browser.newContext({
    acceptDownloads: true,
    locale: 'pt-BR',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();
  const resultados = [];

  try {
    await loginEsupri(page, { user, pass, base, onLog });

    onLog(`financeiro loja ${lojaCodigo}`);
    await page.goto(`${base}/esupri.php?Do=financeiro`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await waitLoaderGone(page, 60000);

    const listaRes = await postForm(page, '/ajax/financeiro.lista.php', {
      'cbLojas[]': lojaCodigo,
    });
    const titulos = Array.isArray(listaRes.json) ? listaRes.json : [];
    onLog(`títulos eSupri=${titulos.length} (filtro ${lojaCodigo})`);

    const alvo = Math.max(1, Number(limit) || 10);
    const vistos = new Set();

    for (const titulo of titulos) {
      if (resultados.length >= alvo) break;
      const notaLabel = String(titulo.MR_DOCUMENTO || '').trim();
      const lojaLabel = String(titulo.CL_FANTA || '').trim();
      const valorLabel = String(titulo.FMT_VALOR || '').trim();
      const statusLabel = String(titulo.MR_SITUACAO || '').trim();
      const chave = String(titulo.CHAVENFE || '').replace(/\D/g, '');
      if (!notaLabel || !/NF/i.test(notaLabel)) continue;
      const uniq = chave || `${notaLabel}|${valorLabel}`;
      if (vistos.has(uniq)) continue;
      vistos.add(uniq);

      onLog(`pedido ${resultados.length + 1}/${alvo}: ${notaLabel} ${lojaLabel} ${valorLabel}`);
      try {
        const dl = await baixarZipNfe(page, context, { chave, notaLabel, onLog });
        resultados.push({
          notaLabel,
          lojaLabel,
          valorLabel,
          statusLabel,
          chave,
          zipBuffer: dl.zipBuffer,
          fileName: dl.fileName,
        });
      } catch (e) {
        onLog(`falha ${notaLabel}: ${String(e.message || e).slice(0, 120)}`);
      }
    }

    return resultados;
  } finally {
    await browser.close();
  }
}

async function baixarZipNfe(page, context, { chave, notaLabel, onLog }) {
  if (chave) {
    const found = await postForm(page, '/ajax/findfile.php', { Tipo: 'NFe', Chave: chave });
    const loc = String(found.text || '').trim();
    if (loc && loc !== 'NOTFOUND' && !/^<!DOCTYPE/i.test(loc) && loc.length < 500) {
      const abs = loc.startsWith('http') ? loc : new URL(loc, page.url()).href;
      const res = await context.request.get(abs);
      if (res.ok()) {
        const body = await res.body();
        const nameFromUrl = abs.split('/').pop()?.split('?')[0];
        return {
          zipBuffer: Buffer.from(body),
          fileName: nameFromUrl || `nfe-${chave}.zip`,
        };
      }
      onLog(`findfile HTTP ${res.status()} ${notaLabel}`);
    } else {
      onLog(`findfile ${notaLabel}: ${(loc || String(found.status)).slice(0, 40)}`);
    }
  }

  if (chave) {
    await page.locator('#txtNFe').fill(chave).catch(() => {});
  }
  const nfeBtn = page.locator('aside button', { hasText: 'NF-e' }).first();
  await nfeBtn.waitFor({ state: 'visible', timeout: 15000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 45000 }),
    nfeBtn.click(),
  ]);
  const fileName = download.suggestedFilename() || `nfe-${notaLabel || chave || 'download'}.zip`;
  const tmp = await download.path();
  if (tmp) {
    const fs = await import('fs');
    return { zipBuffer: fs.readFileSync(tmp), fileName };
  }
  return { zipBuffer: await streamToBuffer(download.createReadStream()), fileName };
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
