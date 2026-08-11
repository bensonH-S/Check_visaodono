/**
 * Cliente Playwright do portal eSupri (Platlog).
 * - Catálogo Pedido: códigos + PREÇO R$ (fonte preferida de custo)
 * - Financeiro NF-e: ZIP/XML (módulo legado — ver README.md)
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
 * @param {{ user: string, pass: string, baseUrl?: string, headless?: boolean, limit?: number, onLog?: Function }} opts
 * @returns {Promise<Array<{ notaLabel: string, lojaLabel: string, valorLabel: string, statusLabel: string, zipBuffer: Buffer, fileName: string }>>}
 */
export async function baixarNfesFinanceiroEsupri({
  user,
  pass,
  baseUrl = DEFAULT_BASE,
  headless = true,
  limit = 10,
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
  const resultados = [];

  try {
    await loginEsupri(page, { user, pass, base, onLog });

    onLog('financeiro');
    await page.locator('#menu_financeiro > a').click();
    await page.locator('#tbFinanceiro tbody tr').first().waitFor({ state: 'visible', timeout: 30000 });

    const lengthSelect = page.locator('select[name="tbFinanceiro_length"], #tbFinanceiro_length select').first();
    if (await lengthSelect.count()) {
      await lengthSelect.selectOption({ label: /100|50|25/ }).catch(() =>
        lengthSelect.selectOption('100').catch(() => {}),
      );
      await page.waitForTimeout(800);
    }

    const alvo = Math.max(1, Number(limit) || 10);
    const vistos = new Set();
    let pagina = 1;

    while (resultados.length < alvo) {
      await page.locator('#tbFinanceiro tbody tr').first().waitFor({ state: 'visible', timeout: 30000 });
      const total = await page.locator('#tbFinanceiro tbody tr').count();
      onLog(`página ${pagina} linhas=${total} baixadas=${resultados.length}/${alvo}`);

      for (let i = 0; i < total && resultados.length < alvo; i++) {
        const row = page.locator('#tbFinanceiro tbody tr').nth(i);
        if (!(await row.count())) break;
        const cells = await row.locator('td').allTextContents().catch(() => []);
        const notaLabel = (cells[0] || '').trim();
        const lojaLabel = (cells[1] || '').trim();
        const valorLabel = (cells[4] || '').trim();
        const statusLabel = (cells[5] || '').trim();
        if (!notaLabel || !/NF/i.test(notaLabel)) continue;
        const chave = `${notaLabel}|${valorLabel}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);

        onLog(`pedido ${resultados.length + 1}/${alvo}: ${notaLabel} ${valorLabel}`);
        try {
          await row.click({ timeout: 15000 });
          await page.waitForTimeout(1200);

          const nfeBtn = page.locator('aside button', { hasText: 'NF-e' }).first();
          await nfeBtn.waitFor({ state: 'visible', timeout: 15000 });

          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 45000 }),
            nfeBtn.click(),
          ]);

          const fileName = download.suggestedFilename() || `nfe-${resultados.length + 1}.zip`;
          const tmp = await download.path();
          let zipBuffer;
          if (tmp) {
            const fs = await import('fs');
            zipBuffer = fs.readFileSync(tmp);
          } else {
            zipBuffer = await streamToBuffer(download.createReadStream());
          }

          resultados.push({
            notaLabel,
            lojaLabel,
            valorLabel,
            statusLabel,
            zipBuffer,
            fileName,
          });
        } catch (e) {
          onLog(`falha ${notaLabel}: ${String(e.message || e).slice(0, 120)}`);
        }
        await page.waitForTimeout(600);
      }

      if (resultados.length >= alvo) break;

      const next = page.locator('#tbFinanceiro_next');
      if (!(await next.count())) break;
      const disabled =
        (await next.getAttribute('class').catch(() => ''))?.includes('disabled') ||
        (await next.getAttribute('aria-disabled').catch(() => '')) === 'true';
      if (disabled) {
        onLog('fim da paginação');
        break;
      }
      await next.click();
      await page.waitForTimeout(1200);
      pagina += 1;
      if (pagina > 30) {
        onLog('limite de páginas atingido');
        break;
      }
    }

    return resultados;
  } finally {
    await browser.close();
  }
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
