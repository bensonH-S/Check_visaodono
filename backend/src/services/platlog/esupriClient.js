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

const TEXTO_CONFIRMA_PEDIDO = /finaliz|confirm|enviar|gravar|salvar|transmit|fechar\s*pedido/i;

async function instalarTravaConfirmacao(page) {
  await page.evaluate((fonte) => {
    if (window.__meridianTravaPedido) return;
    window.__meridianTravaPedido = true;
    document.addEventListener(
      'click',
      (ev) => {
        const el = ev.target && ev.target.closest
          ? ev.target.closest('button, a, input[type="submit"], input[type="button"]')
          : null;
        if (!el) return;
        const texto = `${el.innerText || ''} ${el.value || ''} ${el.getAttribute('title') || ''}`;
        const re = new RegExp(fonte, 'i');
        if (!re.test(texto)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
      },
      true,
    );
  }, TEXTO_CONFIRMA_PEDIDO.source);
}

/**
 * Preenche quantidades na tela Pedido e devolve o print.
 * Não confirma, não grava e não envia. Depois zera o que preencheu.
 * @param {{ codigo: string, caixas: number }[]} itens
 */
export async function preencherCarrinhoPedidoEsupri({
  user,
  pass,
  itens = [],
  baseUrl = DEFAULT_BASE,
  headless = true,
  onLog = () => {},
  confirmar = false,
} = {}) {
  if (confirmar) {
    throw Object.assign(new Error('O piloto não confirma pedido no eSupri.'), { status: 422 });
  }
  if (!user || !pass) {
    throw Object.assign(new Error('Informe o login eSupri da loja.'), { status: 422 });
  }
  const linhas = (itens || [])
    .map((i) => ({
      codigo: String(i.codigo || '').replace(/\s/g, ''),
      caixas: Math.max(0, Math.round(Number(i.caixas) || 0)),
      preco: Number.isFinite(Number(i.preco)) ? Number(i.preco) : null,
    }))
    .filter((i) => i.codigo && i.caixas > 0)
    .slice(0, 40);
  if (!linhas.length) {
    throw Object.assign(new Error('Nenhuma caixa para preencher.'), { status: 422 });
  }

  const base = String(baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const browser = await launchBrowser({ headless, onLog });
  const context = await browser.newContext({
    locale: 'pt-BR',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();
  const preenchidos = [];
  const naoEncontrados = [];

  try {
    await loginEsupri(page, { user, pass, base, onLog });
    await instalarTravaConfirmacao(page);

    onLog('pedido');
    const menuPedido = page.locator('#menu_pedido > a, a:has-text("Pedido")').first();
    await menuPedido.click({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await instalarTravaConfirmacao(page);

    const normCod = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '') || '0';

    const selects = page.locator('select');
    const nSel = await selects.count();
    for (let i = 0; i < nSel; i += 1) {
      const labels = (await selects.nth(i).locator('option').allTextContents().catch(() => [])).map((t) => t.trim());
      const maior = labels.find((t) => /^(100|50|todos|all)$/i.test(t));
      if (!maior || !labels.some((t) => t === '10')) continue;
      await selects.nth(i).selectOption({ label: maior }).catch(() => {});
      await page.waitForTimeout(800);
      break;
    }

    async function marcarQtd(codigo) {
      return page.evaluate((alvo) => {
        const norm = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '') || '0';
        document.querySelectorAll('[data-meridian-qtd]').forEach((el) => el.removeAttribute('data-meridian-qtd'));
        const tables = [...document.querySelectorAll('table')];
        for (const t of tables) {
          const headers = [...t.querySelectorAll('thead th, thead td')].map((c) =>
            (c.innerText || '').trim().toUpperCase(),
          );
          const iCod = headers.findIndex((h) => h.includes('CÓDIGO') || h.includes('CODIGO'));
          const iQtd = headers.findIndex((h) => /^QTD/.test(h) || h.includes('QTDE') || h.includes('QUANT'));
          const iPreco = headers.findIndex((h) => h.includes('PREÇO') || h.includes('PRECO'));
          if (iCod < 0) continue;
          for (const tr of t.querySelectorAll('tbody tr')) {
            const cells = [...tr.cells];
            if (norm(cells[iCod]?.innerText) !== alvo) continue;
            const td = iQtd >= 0 ? cells[iQtd] : tr;
            const input = (td || tr).querySelector(
              'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea',
            );
            if (!input) return { ok: false, motivo: 'sem campo de quantidade' };
            input.setAttribute('data-meridian-qtd', '1');
            const precoTxt = iPreco >= 0 ? (cells[iPreco]?.innerText || '').trim() : '';
            return { ok: true, preco: precoTxt };
          }
        }
        return { ok: false, motivo: 'linha' };
      }, normCod(codigo));
    }

    async function digitarQtd(caixas) {
      const input = page.locator('[data-meridian-qtd="1"]');
      await input.click({ timeout: 4000 });
      await input.fill('');
      if (String(caixas) !== '0') {
        await input.pressSequentially(String(caixas), { delay: 40 });
      } else {
        await input.fill('0');
      }
      await input.press('Tab').catch(() => {});
      await page.waitForTimeout(200);
    }

    const pendentes = new Map(linhas.map((linha) => [normCod(linha.codigo), linha]));

    async function avancarPagina() {
      const nextBtn = page
        .locator(
          '.dataTables_paginate .next:not(.disabled), .paginate_button.next:not(.disabled), li.next:not(.disabled) a, a.next:not(.disabled)',
        )
        .first();
      if (!(await nextBtn.count())) return false;
      const travado = await nextBtn
        .evaluate((el) => {
          const li = el.closest('li');
          return (
            el.classList.contains('disabled') ||
            el.getAttribute('aria-disabled') === 'true' ||
            Boolean(li && li.classList.contains('disabled'))
          );
        })
        .catch(() => true);
      if (travado) return false;
      await nextBtn.click();
      await page.waitForTimeout(900);
      return true;
    }

    async function irPrimeiraPagina() {
      const first = page
        .locator('.dataTables_paginate .first:not(.disabled), .paginate_button.first:not(.disabled), a.first')
        .first();
      if (await first.count()) {
        await first.click().catch(() => {});
        await page.waitForTimeout(800);
        return;
      }
      const um = page.locator('.dataTables_paginate a, .paginate_button a, .paginate_button').filter({ hasText: /^1$/ }).first();
      if (await um.count()) {
        await um.click().catch(() => {});
        await page.waitForTimeout(800);
      }
    }

    async function digitarPendentesDaPagina() {
      const codigos = [...pendentes.keys()];
      for (const cod of codigos) {
        const linha = pendentes.get(cod);
        if (!linha) continue;
        const achou = await marcarQtd(linha.codigo);
        if (!achou.ok) continue;
        try {
          await digitarQtd(linha.caixas);
          const precoPortal = parsePrecoBr(achou.preco);
          preenchidos.push({
            codigo: linha.codigo,
            caixas: linha.caixas,
            preco_lista: linha.preco ?? null,
            preco_portal: precoPortal,
          });
          pendentes.delete(cod);
          onLog(`caixa ${linha.codigo}=${linha.caixas} lista=${linha.preco ?? '—'} portal=${precoPortal ?? achou.preco ?? '—'}`);
        } catch (e) {
          pendentes.delete(cod);
          naoEncontrados.push({ codigo: linha.codigo, motivo: 'não digitou a qtd' });
          onLog(`falha qtd ${linha.codigo}: ${e.message}`);
        }
      }
    }

    let pagina = 1;
    while (pendentes.size && pagina <= 40) {
      await digitarPendentesDaPagina();
      if (!pendentes.size) break;
      const avancou = await avancarPagina();
      if (!avancou) break;
      pagina += 1;
    }
    if (pendentes.size) {
      const busca = page.locator('input[placeholder="Buscar"]').first();
      if (await busca.count()) {
        for (const cod of [...pendentes.keys()]) {
          const linha = pendentes.get(cod);
          if (!linha) continue;
          await busca.fill('').catch(() => {});
          await busca.fill(String(linha.codigo).replace(/^0+/, '') || linha.codigo);
          await busca.press('Enter').catch(() => {});
          await page.waitForTimeout(700);
          const achou = await marcarQtd(linha.codigo);
          if (!achou.ok) continue;
          try {
            await digitarQtd(linha.caixas);
            const precoPortal = parsePrecoBr(achou.preco);
            preenchidos.push({
              codigo: linha.codigo,
              caixas: linha.caixas,
              preco_lista: linha.preco ?? null,
              preco_portal: precoPortal,
            });
            pendentes.delete(cod);
            onLog(`busca ${linha.codigo}=${linha.caixas} portal=${precoPortal ?? '—'}`);
          } catch (e) {
            onLog(`falha busca ${linha.codigo}: ${e.message}`);
          }
        }
        await busca.fill('').catch(() => {});
        await page.waitForTimeout(400);
      }
    }
    for (const linha of pendentes.values()) {
      naoEncontrados.push({ codigo: linha.codigo, motivo: 'não está no catálogo desta loja' });
    }

    const resumo = await page.evaluate(() => {
      const texto = (document.body?.innerText || '').replace(/[\u00a0\u202f]/g, '');
      const valores = [...texto.matchAll(/Valor\s+R\$\s*([\d.]+,\d{2})/g)].map((m) => m[1]);
      const qtd = texto.match(/Quantidade de itens\s+(\d+)/);
      return { valor: valores[0] || null, qtd: qtd ? Number(qtd[1]) : null };
    });
    onLog(`portal valor=${resumo.valor || '—'} itens=${resumo.qtd ?? '—'} digitados=${preenchidos.length}`);

    const png = await page.screenshot({ fullPage: false, type: 'png' });

    let limpo = true;
    if (preenchidos.length) {
      await irPrimeiraPagina();
      const zerar = new Map(preenchidos.map((linha) => [normCod(linha.codigo), linha]));
      let volta = 1;
      while (zerar.size && volta <= 40) {
        for (const cod of [...zerar.keys()]) {
          const linha = zerar.get(cod);
          if (!linha) continue;
          const achou = await marcarQtd(linha.codigo);
          if (!achou.ok) continue;
          try {
            await digitarQtd(0);
            zerar.delete(cod);
          } catch {
            limpo = false;
          }
        }
        if (!zerar.size) break;
        const avancou = await avancarPagina();
        if (!avancou) break;
        volta += 1;
      }
      if (zerar.size) limpo = false;
    }

    return {
      confirmado: false,
      limpo,
      preenchidos,
      nao_encontrados: naoEncontrados,
      valor_portal: resumo.valor,
      qtd_itens_portal: resumo.qtd,
      png,
    };
  } finally {
    await browser.close().catch(() => {});
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
  meses = 3,
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

  const { page, context, browser } = await abrirSessaoFinanceiroEsupri({
    user,
    pass,
    baseUrl,
    headless,
    onLog,
  });
  try {
    return await baixarNfesNaPagina(page, context, { lojaCodigo, limit, meses, onLog });
  } finally {
    await browser.close().catch(() => {});
  }
}

async function abrirSessaoFinanceiroEsupri({
  user,
  pass,
  baseUrl = DEFAULT_BASE,
  headless = true,
  onLog = () => {},
}) {
  const base = String(baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const browser = await launchBrowser({ headless, onLog });
  const context = await browser.newContext({
    acceptDownloads: true,
    locale: 'pt-BR',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();
  await loginEsupri(page, { user, pass, base, onLog });
  onLog('financeiro');
  await page.goto(`${base}/esupri.php?Do=financeiro`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await waitLoaderGone(page, 60000);
  return { page, context, browser, base };
}

function chaveDentroDaJanela(chave, meses = 3) {
  const c = String(chave || '').replace(/\D/g, '');
  if (c.length !== 44) return true;
  const yy = Number(c.slice(2, 4));
  const mm = Number(c.slice(4, 6));
  if (!yy || mm < 1 || mm > 12) return true;
  const emis = new Date(2000 + yy, mm - 1, 1);
  const corte = new Date();
  corte.setMonth(corte.getMonth() - Number(meses || 3));
  corte.setDate(1);
  corte.setHours(0, 0, 0, 0);
  return emis >= corte;
}

async function baixarNfesNaPagina(page, context, { lojaCodigo, limit, meses = 3, onLog = () => {} }) {
  const resultados = [];
  onLog(`lista loja ${lojaCodigo}`);
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
    if (!chaveDentroDaJanela(chave, meses)) continue;
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
}

/**
 * Um login VERONICA, várias lojas (cbLojas[]). Evita 20 aberturas de Chrome.
 * @param {{ codigo: string, id_loja?: number, label?: string }[]} lojas
 */
export async function baixarNfesFinanceiroVariasLojasEsupri({
  user,
  pass,
  lojas = [],
  baseUrl = DEFAULT_BASE,
  headless = true,
  limit = 10,
  onLog = () => {},
  onLoja = null,
} = {}) {
  if (!user || !pass) {
    throw Object.assign(new Error('Informe usuário e senha eSupri (ESUPRI_USER / ESUPRI_PASS)'), {
      status: 400,
    });
  }
  const alvos = (lojas || []).filter((l) => String(l.codigo || '').trim());
  if (!alvos.length) return [];

  const { page, context, browser } = await abrirSessaoFinanceiroEsupri({
    user,
    pass,
    baseUrl,
    headless,
    onLog,
  });
  const porLoja = [];
  try {
    for (const loja of alvos) {
      const codigo = String(loja.codigo).trim();
      onLog(`loja ${loja.label || codigo}`);
      const downloads = await baixarNfesNaPagina(page, context, {
        lojaCodigo: codigo,
        limit,
        onLog,
      });
      const item = { ...loja, codigo, downloads };
      porLoja.push(item);
      if (typeof onLoja === 'function') {
        await onLoja(item);
      }
    }
    return porLoja;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Baixa XMLs/ZIPs por chave NF-e (findfile) — útil p/ completar notas antigas sem XML.
 * @param {{ chave: string, label?: string }[]} chaves
 */
export async function baixarXmlsPorChavesEsupri({
  user,
  pass,
  chaves = [],
  baseUrl = DEFAULT_BASE,
  headless = true,
  onLog = () => {},
  pausaMs = 400,
} = {}) {
  if (!user || !pass) {
    throw Object.assign(new Error('Informe usuário e senha eSupri'), { status: 400 });
  }
  const alvos = (chaves || [])
    .map((c) => ({
      chave: String(c.chave || c).replace(/\D/g, ''),
      label: c.label || '',
    }))
    .filter((c) => c.chave.length === 44);
  if (!alvos.length) return [];

  const { page, context, browser } = await abrirSessaoFinanceiroEsupri({
    user,
    pass,
    baseUrl,
    headless,
    onLog,
  });
  const out = [];
  try {
    for (let i = 0; i < alvos.length; i += 1) {
      const item = alvos[i];
      onLog(`chave ${i + 1}/${alvos.length}: ${item.chave.slice(0, 20)}… ${item.label}`);
      try {
        const dl = await baixarZipNfe(page, context, {
          chave: item.chave,
          notaLabel: item.label || item.chave,
          onLog,
        });
        out.push({ ...item, ok: true, zipBuffer: dl.zipBuffer, fileName: dl.fileName });
      } catch (e) {
        out.push({ ...item, ok: false, erro: String(e.message || e).slice(0, 160) });
        onLog(`falha ${item.chave}: ${String(e.message || e).slice(0, 100)}`);
      }
      if (pausaMs > 0) await page.waitForTimeout(pausaMs).catch(() => {});
    }
    return out;
  } finally {
    await browser.close().catch(() => {});
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
