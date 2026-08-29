/**
 * Automação BK Office → export Excel de vendas → import no estoque.
 * Credenciais: BKOFFICE_USER / BKOFFICE_PASS (nunca hardcoded).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pool } from '../../db.js';
import { importarVendasLoja } from '../estoqueMotor.js';
import { parseVendasExcelBuffer } from './parseVendasExcel.js';
import { resolveBkOfficePlaywrightProxy, logProxyBkOffice } from './bkofficeProxy.js';
import { bknParaDownloadNoBkOffice, carregarAliasesBkn, aplicarAliasBknItem } from './bknAlias.js';

const BASE_URL = process.env.BKOFFICE_URL || 'https://bkoffice-franquia.burgerking.com.br';

let jobRodando = false;
/** Lojas com sync em andamento (anti-concorrência por loja). */
const lojasEmSync = new Set();
let ultimoStatus = null;
/** @type {{ ativo: boolean, intervalo_ms: number, id_loja: number|null, id_lojas: number[], iniciado_em: string|null }} */
let schedulerInfo = {
  ativo: false,
  intervalo_ms: 0,
  id_loja: 0,
  id_lojas: [],
  iniciado_em: null,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableBkError(err) {
  if (err?.status === 422 || err?.status === 409) return false;
  const code = err?.code;
  const msg = String(err?.message || err || '');
  if (code === 'AKAMAI_403' || code === 'GRADE_TIMEOUT' || code === 'EXPORT_BTN_TIMEOUT') return true;
  return /timeout|Timeout|proxy|ECONN|ENOTFOUND|net::|403|Akamai|navegador|browser|closed|Target page|download|NS_ERROR|Navigation/i.test(
    msg,
  );
}

async function withBkRetry(fn, { label = 'operação', tentativas = null } = {}) {
  const max = Math.max(1, Number(tentativas ?? (process.env.BKOFFICE_SYNC_RETRIES || 3)));
  let last;
  for (let i = 1; i <= max; i++) {
    try {
      return await fn(i);
    } catch (e) {
      last = e;
      if (!isRetryableBkError(e) || i >= max) throw e;
      const wait = Math.min(15000, 2000 * i);
      console.warn(
        `[bkoffice] ${label} falhou (${i}/${max}): ${e.message || e} — retry em ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw last;
}

function adquirirLocksSync({ id_loja = null, global = true } = {}) {
  if (global && jobRodando) {
    throw Object.assign(new Error('Já existe um sync BK Office em andamento'), { status: 409 });
  }
  if (id_loja != null && lojasEmSync.has(Number(id_loja))) {
    throw Object.assign(
      new Error(`Já existe sync BK Office em andamento para a loja ${id_loja}`),
      { status: 409 },
    );
  }
  if (global) jobRodando = true;
  if (id_loja != null) lojasEmSync.add(Number(id_loja));
}

function liberarLocksSync({ id_loja = null, global = true } = {}) {
  if (id_loja != null) lojasEmSync.delete(Number(id_loja));
  if (global) jobRodando = false;
}

/**
 * Resolve quais lojas entram no sync automático.
 * - BKOFFICE_SYNC_ID_LOJAS=all|*  → todas operacionais com BKN
 * - BKOFFICE_SYNC_ID_LOJAS=21,15  → lista
 * - BKOFFICE_SYNC_ID_LOJA=21      → uma (legado)
 * - sem nada                     → all
 */
export function parseIdsLojasBkOfficeEnv(env = process.env) {
  const multi = String(env.BKOFFICE_SYNC_ID_LOJAS || '').trim();
  if (multi === 'all' || multi === '*') return 'all';
  if (multi) {
    const ids = multi
      .split(/[,;\s]+/)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length) return ids;
  }
  const single = Number(env.BKOFFICE_SYNC_ID_LOJA || 0);
  if (single > 0) return [single];
  return 'all';
}

/** Lojas operacionais com código BKN (podem ser filtradas no portal). */
export async function listarLojasBkOfficeSync({ ids = null } = {}) {
  const parsed = ids != null ? ids : parseIdsLojasBkOfficeEnv();
  const params = [];
  let filtro = `is_active = TRUE AND bk_number IS NOT NULL AND TRIM(bk_number) <> ''`;
  if (Array.isArray(parsed) && parsed.length) {
    params.push(parsed);
    filtro += ` AND id_loja = ANY($1::int[])`;
  }
  const { rows } = await pool.query(
    `SELECT id_loja, name, bk_number
     FROM lojas
     WHERE ${filtro}
     ORDER BY NULLIF(TRIM(bk_number), '')::bigint NULLS LAST, name`,
    params,
  );
  return rows.map((r) => ({
    id_loja: r.id_loja,
    name: r.name,
    bk_number: String(r.bk_number).trim(),
  }));
}

export function getBkOfficeStatus() {
  const cronMs = Number(process.env.BKOFFICE_SYNC_CRON_MS || 0);
  const idLojaEnv = Number(process.env.BKOFFICE_SYNC_ID_LOJA || 0);
  const serverSync =
    process.env.BKOFFICE_SERVER_SYNC === '1' ||
    process.env.BKOFFICE_SERVER_SYNC === 'true';
  let proxyHint = null;
  try {
    const p = resolveBkOfficePlaywrightProxy();
    proxyHint = p ? p.provider : null;
  } catch {
    proxyHint = 'erro_config';
  }
  const ultimo =
    !schedulerInfo.ativo && !serverSync
      ? null
      : ultimoStatus;
  return {
    configurado: Boolean(process.env.BKOFFICE_USER && process.env.BKOFFICE_PASS),
    job_rodando: jobRodando,
    lojas_em_sync: [...lojasEmSync],
    ultimo,
    server_sync: serverSync,
    proxy: proxyHint,
    modo: schedulerInfo.ativo
      ? 'servidor'
      : serverSync
        ? 'manual_servidor'
        : 'legado_kit_opcional',
    lojas_env: parseIdsLojasBkOfficeEnv(),
    scheduler: {
      ativo: schedulerInfo.ativo,
      intervalo_ms: schedulerInfo.intervalo_ms || (cronMs >= 60000 ? cronMs : 0),
      id_loja: schedulerInfo.id_loja || idLojaEnv || null,
      id_lojas: schedulerInfo.id_lojas || [],
      iniciado_em: schedulerInfo.iniciado_em,
    },
  };
}

function fmtDateBR(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

async function atualizarJob(idJob, fields) {
  if (!idJob) return;
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    vals.push(v);
    sets.push(`${k} = $${vals.length}`);
  }
  vals.push(idJob);
  await pool.query(
    `UPDATE estoque_sync_jobs SET ${sets.join(', ')} WHERE id_job = $${vals.length}`,
    vals,
  );
}

/**
 * Preenche datas no formulário de relatório (inputs #initialDate / #endDate).
 */
async function preencherDatas(page, dataInicio, dataFim) {
  const ini = fmtDateBR(dataInicio);
  const fim = fmtDateBR(dataFim);
  // Evita abrir o datepicker jQuery (ele intercepta cliques depois)
  await page.locator('#initialDate').evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, ini);
  await page.locator('#endDate').evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, fim);
  await page.keyboard.press('Escape').catch(() => {});
  const dp = page.locator('#ui-datepicker-div');
  if (await dp.isVisible().catch(() => false)) {
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await dp.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
}

/** Fecha modal/overlay que bloqueia clique (alertPops, blockUI, datepicker). */
async function dismissBloqueios(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.blockUI').forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });
    const alert = document.querySelector('#alertPops');
    if (alert) {
      alert.classList.remove('in');
      alert.style.display = 'none';
      alert.setAttribute('aria-hidden', 'true');
    }
    document.querySelectorAll('.modal.in').forEach((m) => {
      m.classList.remove('in');
      m.style.display = 'none';
    });
    const dp = document.querySelector('#ui-datepicker-div');
    if (dp) dp.style.display = 'none';
  }).catch(() => {});
  // NÃO usar click() sem timeout curto — Playwright espera defaultTimeout (~120s) se o botão não existir.
  const okBtn = page.getByRole('button', { name: /^(ok|sim|fechar|close)$/i }).first();
  if (await okBtn.isVisible({ timeout: 400 }).catch(() => false)) {
    await okBtn.click({ force: true, timeout: 1500 }).catch(() => {});
  }
}

/**
 * Seleciona item em autocomplete jQuery UI (digitar + clicar na lista).
 */
async function selecionarAutocomplete(page, inputSelector, termo, { obrigatorio = true } = {}) {
  if (!termo) return null;
  const t = String(termo).trim();
  if (!t) return null;

  await dismissBloqueios(page);
  await page.evaluate(() => {
    document.querySelectorAll('#main-divs [disabled], #radioRel[disabled]').forEach((el) => {
      el.removeAttribute('disabled');
    });
  });

  const combo = page.locator(inputSelector);
  await combo.waitFor({ state: 'attached', timeout: 15000 });
  await combo.evaluate((el) => {
    el.disabled = false;
    el.removeAttribute('disabled');
  });
  await combo.click({ force: true, timeout: 5000 });
  await combo.fill('');
  // delay baixo: proxy BR já é lento; 55ms/char era absurdo
  await combo.type(t, { delay: 12 });

  const menu = page.locator('ul.ui-autocomplete:visible').last();
  let menuOk = await menu.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  if (!menuOk) {
    // Fallback: disparar busca jQuery UI de novo
    await combo.press('Control+A').catch(() => {});
    await combo.type(t, { delay: 20 });
    menuOk = await menu.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  }
  if (!menuOk) {
    throw Object.assign(
      new Error(`Autocomplete sem opções para "${t}" em ${inputSelector}`),
      { status: 422 },
    );
  }
  const item = menu.locator('li').filter({ hasText: t }).first();
  if (await item.count()) {
    await item.click({ force: true, timeout: 5000 });
  } else {
    await menu.locator('li').first().click({ force: true, timeout: 5000 });
  }
  await page.waitForTimeout(150);

  const valor = ((await combo.inputValue().catch(() => '')) || '').trim();
  if (obrigatorio && (!valor || (t.match(/^\d+$/) && !valor.includes(t)))) {
    throw Object.assign(
      new Error(`Falha ao selecionar "${t}" em ${inputSelector} (valor: "${valor}")`),
      { status: 422 },
    );
  }
  console.log(`[bkoffice] ${inputSelector} → ${valor}`);
  return valor;
}

async function limparRestaurante(page) {
  await page.evaluate(() => {
    const el = document.querySelector('#comboRestauranteGroup-autocomplete');
    if (el) {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const hid = document.querySelector('#comboRestauranteGroup');
    if (hid) hid.value = '';
  });
  await page.waitForTimeout(150);
}

async function selecionarRestaurante(page, termoLoja) {
  if (!termoLoja) {
    await limparRestaurante(page);
    return;
  }
  await selecionarAutocomplete(page, '#comboRestauranteGroup-autocomplete', termoLoja);
}

async function marcarRelatorioRestauranteProduto(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#main-divs [disabled], #radioRel[disabled]').forEach((el) => {
      el.removeAttribute('disabled');
    });
    const el = document.querySelector('#relRestaurantSku');
    if (el) {
      el.disabled = false;
      el.checked = true;
      el.click();
      el.dispatchEvent(new Event('click', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForTimeout(200);
}

async function aguardarGradeVendas(page, { modoGrupo = false } = {}) {
  await dismissBloqueios(page);
  const overlayMs = modoGrupo
    ? Number(process.env.BKOFFICE_GRUPO_OVERLAY_MS || 420000)
    : Number(process.env.BKOFFICE_OVERLAY_MS || 120000);
  const gradeMs = modoGrupo
    ? Number(process.env.BKOFFICE_GRUPO_GRADE_MS || 120000)
    : Number(process.env.BKOFFICE_GRADE_MS || 45000);

  console.log(`[bkoffice] Buscar grade (overlay≤${Math.round(overlayMs / 1000)}s grade≤${Math.round(gradeMs / 1000)}s)`);
  const buscar = page.getByRole('button', { name: /buscar/i });
  if (await buscar.count()) {
    await buscar.click({ force: true, timeout: 8000 }).catch(() => {});
    console.log('[bkoffice] clicou Buscar');
  } else {
    console.warn('[bkoffice] botão Buscar não encontrado');
  }

  // Espera overlay aparecer (curto) e depois sumir — evita wait longo se nunca existiu
  const overlay = page.locator('text=Por favor aguarde');
  const apareceu = await overlay.first().isVisible({ timeout: 3000 }).catch(() => false);
  let overlayOk = true;
  if (apareceu) {
    overlayOk = await overlay
      .first()
      .waitFor({ state: 'hidden', timeout: overlayMs })
      .then(() => true)
      .catch(() => false);
  }
  console.log(`[bkoffice] overlay sumiu=${overlayOk} (apareceu=${apareceu})`);
  if (modoGrupo && !overlayOk) {
    throw Object.assign(
      new Error(`BK Office: overlay do grupo não sumiu em ${Math.round(overlayMs / 1000)}s`),
      { status: 504, code: 'GRADE_TIMEOUT' },
    );
  }

  await page.waitForTimeout(modoGrupo ? 1500 : 400);
  await dismissBloqueios(page);

  const temGrade = await page
    .waitForFunction(() => {
      const body = document.body?.innerText || '';
      if (/nenhum registro encontrado/i.test(body)) return 'vazio';
      const btn = document.querySelector('#salvar');
      if (btn && !btn.disabled && !btn.classList.contains('disabled')) return 'ok';
      if (body.includes('Exportar Excel') && /WHOPPER|Produto Venda|Qtd/i.test(body) && !/nenhum registro/i.test(body)) {
        return 'ok';
      }
      return false;
    }, { timeout: gradeMs })
    .then((h) => h.jsonValue())
    .catch(() => null);
  console.log(`[bkoffice] grade=${temGrade || 'null'}`);

  if (temGrade === 'vazio') {
    throw Object.assign(new Error('BK Office: busca sem dados para o periodo'), { status: 422 });
  }
  if (modoGrupo && temGrade !== 'ok') {
    const btn = await page
      .locator('#salvar')
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!btn) {
      throw Object.assign(
        new Error('BK Office: botão Exportar Excel não apareceu (grupo)'),
        { status: 504, code: 'EXPORT_BTN_TIMEOUT' },
      );
    }
  }
  await dismissBloqueios(page);
}

/** Export Excel com retentativas — BK Office às vezes não dispara download na 1ª vez. */
async function exportarExcelComRetry(page, downloadDir, { modoGrupo = false } = {}) {
  const dlTimeout = modoGrupo
    ? Number(process.env.BKOFFICE_GRUPO_DOWNLOAD_TIMEOUT_MS || process.env.BKOFFICE_DOWNLOAD_TIMEOUT_MS || 300000)
    : Number(process.env.BKOFFICE_DOWNLOAD_TIMEOUT_MS || 120000);
  await dismissBloqueios(page);
  const exportBtn = page.locator('#salvar').or(page.getByRole('button', { name: /exportar excel/i }));
  await exportBtn.first().waitFor({ state: 'visible', timeout: 20000 });
  await exportBtn.first().scrollIntoViewIfNeeded().catch(() => {});

  // Só trata como vazio se o botão exportar não existir OU mensagem clara de grade vazia.
  const semDados = await page.evaluate(() => {
    if (document.querySelector('#salvar')) return false;
    const t = (document.body?.innerText || '').slice(0, 1200);
    return /nenhum registro encontrado|não há dados|nao ha dados/i.test(t);
  }).catch(() => false);
  if (semDados) {
    throw Object.assign(new Error('BK Office: busca sem dados para o periodo'), { status: 422 });
  }

  let lastErr;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    console.log(`[bkoffice] export Excel tentativa ${tentativa}/3 (timeout ${Math.round(dlTimeout / 1000)}s)`);
    try {
      await dismissBloqueios(page);
      await page.waitForTimeout(200);

      const downloadPromise = page.waitForEvent('download', { timeout: dlTimeout });
      await exportBtn.first().click({ force: true, timeout: 8000 });
      const download = await downloadPromise;

      const suggested = download.suggestedFilename() || `vendas-bk-${Date.now()}.xlsx`;
      const filePath = path.join(downloadDir, suggested);
      await download.saveAs(filePath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 100) {
        throw new Error('Arquivo Excel vazio ou ausente apos download');
      }
      console.log(`[bkoffice] Excel OK ${path.basename(filePath)} (${fs.statSync(filePath).size} bytes)`);
      return filePath;
    } catch (e) {
      lastErr = e;
      console.warn(`[bkoffice] export falhou tentativa ${tentativa}:`, e.message || e);
      try {
        const shot = path.join(downloadDir, `erro-export-${Date.now()}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        console.warn(`[bkoffice] screenshot: ${shot}`);
      } catch {
        /* ignore */
      }
      if (tentativa < 3) {
        await aguardarGradeVendas(page, { modoGrupo });
        await marcarRelatorioRestauranteProduto(page);
      }
    }
  }
  throw lastErr || new Error('Falha ao exportar Excel apos 3 tentativas');
}

/** Preenche filtros + Buscar + Export na página já logada no relatório. */
async function exportarRelatorioNaPagina(
  page,
  { dataInicio, dataFim, termoLoja, agruparPorDia, downloadDir },
) {
  const modoGrupo = !termoLoja;
  await marcarRelatorioRestauranteProduto(page);
  await page.waitForSelector('#comboRestauranteGroup-autocomplete', { timeout: 20000 });
  await preencherDatas(page, dataInicio, dataFim);

  await page.evaluate((on) => {
    const el = document.querySelector('#groupDia');
    if (!el) return;
    el.disabled = false;
    el.removeAttribute('disabled');
    el.checked = Boolean(on);
    el.dispatchEvent(new Event('click', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, agruparPorDia);
  await page.waitForTimeout(200);

  await selecionarAutocomplete(page, '#comboSectorGroup-autocomplete', '1005196', {
    obrigatorio: modoGrupo,
  }).catch(() =>
    selecionarAutocomplete(page, '#comboSectorGroup-autocomplete', 'Grupo Alvim', {
      obrigatorio: modoGrupo,
    }),
  );

  await selecionarRestaurante(page, termoLoja);
  console.log('[bkoffice] filtros OK — iniciando Buscar/export');
  await marcarRelatorioRestauranteProduto(page);
  await aguardarGradeVendas(page, { modoGrupo });
  console.log('[bkoffice] grade pronta — exportando Excel');
  return exportarExcelComRetry(page, downloadDir, { modoGrupo });
}

export async function baixarExcelVendas({
  dataInicio,
  dataFim,
  termoLoja,
  downloadDir,
  /** true = quebra por dia (baixa diária); false = agrega produtos no período (descoberta de catálogo) */
  agruparPorDia = true,
}) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw Object.assign(
      new Error(
        'Playwright não instalado. Rode: npm install playwright && npx playwright install chromium',
      ),
      { status: 503 },
    );
  }

  const user = process.env.BKOFFICE_USER;
  const pass = process.env.BKOFFICE_PASS;
  if (!user || !pass) {
    throw Object.assign(
      new Error('Configure BKOFFICE_USER e BKOFFICE_PASS no .env'),
      { status: 503 },
    );
  }

  fs.mkdirSync(downloadDir, { recursive: true });

  // HEADLESS=0 → janela; qualquer outro valor (incl. 1) → invisível
  const headless = process.env.BKOFFICE_HEADLESS !== '0';
  // Opt-in: canal Chrome do Windows fecha o navegador do usuário no browser.close().
  const useChrome = process.env.BKOFFICE_USE_CHROME === '1';
  const { buildChromiumLaunchOptions } = await import('../playwrightBrowser.js');
  const launchOpts = buildChromiumLaunchOptions({
    headless,
    preferChromeChannel: useChrome,
    downloadsPath: downloadDir,
    extraArgs: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  launchOpts.ignoreDefaultArgs = ['--enable-automation'];

  const proxy = resolveBkOfficePlaywrightProxy();
  if (proxy) {
    launchOpts.proxy = {
      server: proxy.server,
      ...(proxy.username ? { username: proxy.username } : {}),
      ...(proxy.password ? { password: proxy.password } : {}),
    };
  }
  logProxyBkOffice(proxy);
  console.log(
    `[bkoffice] launch headless=${headless} exec=${launchOpts.executablePath || launchOpts.channel || 'playwright-chromium'}`,
  );

  let browser;
  try {
    browser = await playwright.chromium.launch(launchOpts);
  } catch (e) {
    const msg = String(e.message || e);
    // Só tenta canal Chrome → Chromium do Playwright se estivermos no Windows
    if (launchOpts.channel && process.platform === 'win32') {
      console.warn('[bkoffice] Chrome canal falhou, tentando Chromium Playwright:', msg);
      delete launchOpts.channel;
      browser = await playwright.chromium.launch(launchOpts);
    } else {
      throw Object.assign(
        new Error(
          `Falha ao abrir browser BK Office: ${msg}. ` +
            'No servidor use imagem v1.7.7+ (Playwright Chromium) e BKOFFICE_USE_CHROME=0.',
        ),
        { status: 503 },
      );
    }
  }

  try {
    const contextOpts = {
      acceptDownloads: true,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      viewport: { width: 1365, height: 900 },
      userAgent:
        process.env.BKOFFICE_USER_AGENT ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    const context = await browser.newContext(contextOpts);
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(Number(process.env.BKOFFICE_TIMEOUT_MS || 60000));

    const t0 = Date.now();
    const resp = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    if (resp && resp.status() === 403) {
      throw Object.assign(
        new Error(
          'BK Office bloqueou o acesso (403 Akamai). ' +
            'No servidor fora do Brasil use Bright Data: BKOFFICE_BRIGHTDATA=1 e BRIGHTDATA_PROXY_PASSWORD. ' +
            'Ou BKOFFICE_PROXY=http://user:pass@host:port (IP residencial BR).',
        ),
        { status: 503, code: 'AKAMAI_403' },
      );
    }

    await page.waitForSelector('#user', { state: 'visible', timeout: 45000 }).catch(async () => {
      const title = await page.title();
      throw Object.assign(
        new Error(`Campo #user não apareceu (title=${title}). Possível bloqueio do WAF.`),
        { status: 503 },
      );
    });
    await dismissBloqueios(page);
    const alertaOk = page.getByRole('button', { name: /^ok$/i });
    if (await alertaOk.first().isVisible({ timeout: 500 }).catch(() => false)) {
      await alertaOk.first().click({ force: true, timeout: 2000 }).catch(() => {});
    }

    await page.locator('#user').fill(user);
    await page.locator('#pass').fill(pass);
    await page.locator('#button').click({ timeout: 8000 });
    await page.waitForURL(/\/home/, { timeout: 45000 }).catch(() => {});
    console.log(`[bkoffice] login OK (+${Date.now() - t0}ms)`);

    await page.locator('#btnBKoffice').click({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.locator('#btnreport').click({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.locator('#gRel h5 label').first().click({ timeout: 5000 }).catch(async () => {
      await page.locator('#gRel').click({ timeout: 5000 });
    });
    await page.waitForTimeout(200);
    await page.locator('#reportSales h5').click({ timeout: 8000 });
    await page.waitForURL(/RelatorioVendas/i, { timeout: 25000 }).catch(() => {});
    await page.waitForSelector('#initialDate', { timeout: 25000 });
    console.log(`[bkoffice] relatório aberto (+${Date.now() - t0}ms)`);

    const filePath = await exportarRelatorioNaPagina(page, {
      dataInicio,
      dataFim,
      termoLoja,
      agruparPorDia,
      downloadDir,
    });
    await context.close();
    return filePath;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Login 1x → exporta Excel de várias lojas (troca só o restaurante).
 * @param {{ bk_number: string, id_loja?: number, name?: string }[]} lojas
 * @returns {Promise<{ id_loja?: number, bk_number: string, name?: string, filePath: string, ok: boolean, erro?: string }[]>}
 */
export async function baixarExcelVendasVariasLojas({
  lojas,
  dataInicio,
  dataFim,
  downloadDir,
  agruparPorDia = true,
}) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw Object.assign(
      new Error(
        'Playwright não instalado. Rode: npm install playwright && npx playwright install chromium',
      ),
      { status: 503 },
    );
  }

  const user = process.env.BKOFFICE_USER;
  const pass = process.env.BKOFFICE_PASS;
  if (!user || !pass) {
    throw Object.assign(
      new Error('Configure BKOFFICE_USER e BKOFFICE_PASS no .env'),
      { status: 503 },
    );
  }

  const lista = (lojas || []).filter((l) => String(l.bk_number || '').replace(/\D/g, ''));
  if (!lista.length) {
    throw Object.assign(new Error('Nenhuma loja com BKN para sessão'), { status: 400 });
  }

  fs.mkdirSync(downloadDir, { recursive: true });
  const headless = process.env.BKOFFICE_HEADLESS !== '0';
  const useChrome = process.env.BKOFFICE_USE_CHROME === '1';
  const { buildChromiumLaunchOptions } = await import('../playwrightBrowser.js');
  const launchOpts = buildChromiumLaunchOptions({
    headless,
    preferChromeChannel: useChrome,
    downloadsPath: downloadDir,
    extraArgs: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  launchOpts.ignoreDefaultArgs = ['--enable-automation'];

  const proxy = resolveBkOfficePlaywrightProxy();
  if (proxy) {
    launchOpts.proxy = {
      server: proxy.server,
      ...(proxy.username ? { username: proxy.username } : {}),
      ...(proxy.password ? { password: proxy.password } : {}),
    };
  }
  logProxyBkOffice(proxy);

  let browser;
  try {
    browser = await playwright.chromium.launch(launchOpts);
  } catch (e) {
    if (launchOpts.channel && process.platform === 'win32') {
      delete launchOpts.channel;
      browser = await playwright.chromium.launch(launchOpts);
    } else {
      throw e;
    }
  }

  const resultados = [];
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      viewport: { width: 1365, height: 900 },
      userAgent:
        process.env.BKOFFICE_USER_AGENT ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(Number(process.env.BKOFFICE_TIMEOUT_MS || 60000));

    const resp = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    if (resp && resp.status() === 403) {
      throw Object.assign(
        new Error(
          'BK Office bloqueou o acesso (403 Akamai). Configure Bright Data (BKOFFICE_BRIGHTDATA=1 + BRIGHTDATA_PROXY_PASSWORD).',
        ),
        { status: 503, code: 'AKAMAI_403' },
      );
    }
    await page.waitForSelector('#user', { state: 'visible', timeout: 45000 });
    await dismissBloqueios(page);
    await page.locator('#user').fill(user);
    await page.locator('#pass').fill(pass);
    await page.locator('#button').click({ timeout: 8000 });
    await page.waitForURL(/\/home/, { timeout: 45000 }).catch(() => {});

    await page.locator('#btnBKoffice').click({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.locator('#btnreport').click({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.locator('#gRel h5 label').first().click({ timeout: 5000 }).catch(async () => {
      await page.locator('#gRel').click({ timeout: 5000 });
    });
    await page.waitForTimeout(200);
    await page.locator('#reportSales h5').click({ timeout: 8000 });
    await page.waitForURL(/RelatorioVendas/i, { timeout: 25000 }).catch(() => {});
    await page.waitForSelector('#initialDate', { timeout: 25000 });
    console.log(`[bkoffice] sessão aberta — ${lista.length} loja(s) sem re-login`);

    for (const loja of lista) {
      const bknCadastro = String(loja.bk_number).replace(/\D/g, '');
      const bknDownload = (await bknParaDownloadNoBkOffice(bknCadastro)) || bknCadastro;
      const idLoja = loja.id_loja != null ? Number(loja.id_loja) : null;
      if (idLoja != null && lojasEmSync.has(idLoja)) {
        resultados.push({
          id_loja: idLoja,
          bk_number: bknCadastro,
          name: loja.name,
          filePath: null,
          ok: false,
          erro: `Sync já em andamento para loja ${idLoja}`,
        });
        continue;
      }
      if (idLoja != null) lojasEmSync.add(idLoja);
      const subDir = path.join(downloadDir, `bkn-${bknCadastro}`);
      fs.mkdirSync(subDir, { recursive: true });
      const tLoja = Date.now();
      try {
        if (bknDownload !== bknCadastro) {
          console.log(
            `[bkoffice] sessão → BKN download ${bknDownload} → cadastro ${bknCadastro} ${loja.name || ''}`,
          );
        } else {
          console.log(`[bkoffice] sessão → BKN ${bknCadastro} ${loja.name || ''}`);
        }
        const filePath = await withBkRetry(
          () =>
            exportarRelatorioNaPagina(page, {
              dataInicio,
              dataFim,
              termoLoja: bknDownload,
              agruparPorDia,
              downloadDir: subDir,
            }),
          { label: `export BKN ${bknDownload}` },
        );
        resultados.push({
          id_loja: loja.id_loja,
          bk_number: bknCadastro,
          bkn_download: bknDownload,
          name: loja.name,
          filePath,
          ok: true,
          duracao_ms: Date.now() - tLoja,
        });
      } catch (e) {
        console.warn(`[bkoffice] sessão BKN ${bknDownload} falhou:`, e.message || e);
        resultados.push({
          id_loja: loja.id_loja,
          bk_number: bknCadastro,
          bkn_download: bknDownload,
          name: loja.name,
          filePath: null,
          ok: false,
          erro: e.message || String(e),
          duracao_ms: Date.now() - tLoja,
        });
      } finally {
        if (idLoja != null) lojasEmSync.delete(idLoja);
      }
    }

    await context.close();
    return resultados;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Parse + upsert a partir de Excel já baixado (uma loja).
 */
async function importarExcelBkOfficeLoja({
  id_loja,
  filePath,
  data_inicio,
  data_fim,
  bkNumber = null,
  bkNumberExcel = null,
  criado_por = null,
  processar = true,
}) {
  const buffer = fs.readFileSync(filePath);
  const aliases = await carregarAliasesBkn();
  const filtroParse = bkNumberExcel || bkNumber;
  let parsed = parseVendasExcelBuffer(buffer, {
    dataPadrao: data_inicio,
    bkNumber: filtroParse,
  });
  if (!parsed.length && filtroParse) {
    parsed = parseVendasExcelBuffer(buffer, { dataPadrao: data_inicio });
  }
  parsed = parsed.map((r) => aplicarAliasBknItem(r, aliases));
  const itens = parsed.map((r) => ({
    ...r,
    data_venda: r.data_venda || data_fim || data_inicio,
  }));
  const validos = itens.filter((r) => r.data_venda && r.codigo && r.qtde > 0);
  if (!validos.length) {
    throw Object.assign(
      new Error(
        'Excel baixado sem linhas de produto. Confirme o relatório "Restaurante e Produto Venda".',
      ),
      { status: 422 },
    );
  }
  const importResult = await importarVendasLoja({
    id_loja,
    itens: validos,
    origem: 'bkoffice',
    arquivo_nome: path.basename(filePath),
    criado_por,
    processar,
  });
  return { linhas: validos.length, importResult };
}

/**
 * Sync completo: Playwright → parse → import → processar baixas.
 */
export async function syncVendasBkOffice({
  id_loja,
  data_inicio,
  data_fim,
  termo_loja = null,
  criado_por = null,
  processar = true,
  agruparPorDia = true,
}) {
  adquirirLocksSync({ id_loja, global: true });
  const t0 = Date.now();

  const { rows: jobRows } = await pool.query(
    `INSERT INTO estoque_sync_jobs
       (id_loja, data_inicio, data_fim, status, criado_por, iniciado_em)
     VALUES ($1, $2::date, $3::date, 'rodando', $4, NOW())
     RETURNING id_job`,
    [id_loja, data_inicio, data_fim, criado_por],
  );
  const idJob = jobRows[0].id_job;

  const downloadDir = path.join(os.tmpdir(), 'vision-check-bkoffice', String(idJob));

  try {
    let termo = termo_loja;
    let bkNumber = null;
    let bkNumberExcel = null;
    if (id_loja) {
      const { rows } = await pool.query(
        'SELECT name, bk_number FROM lojas WHERE id_loja = $1',
        [id_loja],
      );
      bkNumber = rows[0]?.bk_number ? String(rows[0].bk_number).trim() : null;
      const bknDownload = bkNumber ? await bknParaDownloadNoBkOffice(bkNumber) : null;
      if (!termo) termo = bknDownload || bkNumber || rows[0]?.name || null;
      // Excel do BK vem com o código de download (ex.: 21274), não o cadastro (30784)
      if (bknDownload && bkNumber && bknDownload !== String(bkNumber).replace(/\D/g, '')) {
        bkNumberExcel = bknDownload;
        console.log(
          `[bkoffice] alias download: BK ${bknDownload} → loja ${id_loja} cadastro ${bkNumber}`,
        );
      }
    }

    const filePath = await withBkRetry(
      () =>
        baixarExcelVendas({
          dataInicio: data_inicio,
          dataFim: data_fim,
          termoLoja: termo,
          downloadDir,
          agruparPorDia,
        }),
      { label: `download loja ${id_loja}` },
    );

    const { linhas, importResult } = await importarExcelBkOfficeLoja({
      id_loja,
      filePath,
      data_inicio,
      data_fim,
      bkNumber,
      bkNumberExcel,
      criado_por,
      processar,
    });

    const duracao_ms = Date.now() - t0;
    const msg = `OK: ${linhas} linhas, ${importResult.dias} dia(s), ${duracao_ms}ms`;
    await atualizarJob(idJob, {
      status: 'ok',
      mensagem: msg,
      finalizado_em: new Date(),
    });
    ultimoStatus = {
      id_job: idJob,
      status: 'ok',
      mensagem: msg,
      id_loja,
      linhas,
      duracao_ms,
      em: new Date().toISOString(),
    };
    console.log(`[bkoffice] loja ${id_loja} upsert OK — ${linhas} linhas em ${duracao_ms}ms`);
    return {
      id_job: idJob,
      arquivo: path.basename(filePath),
      linhas,
      duracao_ms,
      importResult,
    };
  } catch (e) {
    const msg = e.message || String(e);
    const duracao_ms = Date.now() - t0;
    await atualizarJob(idJob, {
      status: 'erro',
      mensagem: msg.slice(0, 2000),
      finalizado_em: new Date(),
    }).catch(() => {});
    ultimoStatus = {
      id_job: idJob,
      status: 'erro',
      mensagem: msg,
      id_loja,
      duracao_ms,
      em: new Date().toISOString(),
    };
    console.error(`[bkoffice] loja ${id_loja} ERRO após ${duracao_ms}ms:`, msg);
    throw e;
  } finally {
    liberarLocksSync({ id_loja, global: true });
    try {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Sync de todas as lojas configuradas (isolamento por loja).
 * modo=sessao: 1 login Playwright + troca de restaurante (produção).
 * modo=individual: 1 browser por loja (fallback / debug).
 */
export async function syncVendasBkOfficeTodas({
  data_inicio,
  data_fim,
  ids = null,
  criado_por = null,
  processar = true,
  modo = null,
} = {}) {
  adquirirLocksSync({ global: true });
  const t0 = Date.now();
  const lojas = await listarLojasBkOfficeSync({ ids });
  if (!lojas.length) {
    liberarLocksSync({ global: true });
    throw Object.assign(new Error('Nenhuma loja configurada para sync BK Office'), { status: 400 });
  }

  const modoEfetivo =
    modo ||
    process.env.BKOFFICE_SYNC_MODO ||
    (lojas.length === 1 ? 'individual' : 'sessao');

  const resultados = [];
  const downloadDir = path.join(os.tmpdir(), 'vision-check-bkoffice', `lote-${Date.now()}`);

  try {
    console.log(
      `[bkoffice] lote ${data_inicio}→${data_fim} · ${lojas.length} loja(s) · modo=${modoEfetivo}`,
    );

    if (modoEfetivo === 'sessao' && lojas.length > 1) {
      const baixados = await withBkRetry(
        () =>
          baixarExcelVendasVariasLojas({
            lojas,
            dataInicio: data_inicio,
            dataFim: data_fim,
            downloadDir,
            agruparPorDia: true,
          }),
        { label: 'sessão multi-loja (login/proxy)' },
      );

      for (const item of baixados) {
        const idLoja = item.id_loja;
        const tLoja = Date.now();
        schedulerInfo.id_loja = idLoja || schedulerInfo.id_loja;
        const { rows: jobRows } = await pool.query(
          `INSERT INTO estoque_sync_jobs
             (id_loja, data_inicio, data_fim, status, criado_por, iniciado_em)
           VALUES ($1, $2::date, $3::date, 'rodando', $4, NOW())
           RETURNING id_job`,
          [idLoja, data_inicio, data_fim, criado_por],
        );
        const idJob = jobRows[0].id_job;
        try {
          if (!item.ok || !item.filePath) {
            throw Object.assign(new Error(item.erro || 'Download falhou'), { status: 502 });
          }
          const { linhas, importResult } = await importarExcelBkOfficeLoja({
            id_loja: idLoja,
            filePath: item.filePath,
            data_inicio,
            data_fim,
            bkNumber: item.bk_number,
            bkNumberExcel:
              item.bkn_download && item.bkn_download !== item.bk_number
                ? item.bkn_download
                : null,
            criado_por,
            processar,
          });
          const duracao_ms = Date.now() - tLoja;
          const msg = `OK: ${linhas} linhas, ${importResult.dias} dia(s), ${duracao_ms}ms`;
          await atualizarJob(idJob, { status: 'ok', mensagem: msg, finalizado_em: new Date() });
          console.log(
            `[bkoffice] loja ${idLoja} (${item.bk_number}) OK — ${linhas} linhas · ${duracao_ms}ms`,
          );
          resultados.push({
            id_loja: idLoja,
            bk_number: item.bk_number,
            name: item.name,
            ok: true,
            linhas,
            duracao_ms,
            importResult,
            id_job: idJob,
          });
        } catch (e) {
          const duracao_ms = Date.now() - tLoja;
          const msg = e.message || String(e);
          await atualizarJob(idJob, {
            status: 'erro',
            mensagem: msg.slice(0, 2000),
            finalizado_em: new Date(),
          }).catch(() => {});
          console.error(`[bkoffice] loja ${idLoja} ERRO (${duracao_ms}ms):`, msg);
          resultados.push({
            id_loja: idLoja,
            bk_number: item.bk_number,
            name: item.name,
            ok: false,
            erro: msg,
            duracao_ms,
            id_job: idJob,
          });
        }
      }
    } else {
      // Libera global para syncVendasBkOffice adquirir lock por loja
      liberarLocksSync({ global: true });
      for (const loja of lojas) {
        const tLoja = Date.now();
        schedulerInfo.id_loja = loja.id_loja;
        try {
          const r = await syncVendasBkOffice({
            id_loja: loja.id_loja,
            data_inicio,
            data_fim,
            termo_loja: loja.bk_number,
            criado_por,
            processar,
          });
          resultados.push({
            id_loja: loja.id_loja,
            bk_number: loja.bk_number,
            name: loja.name,
            ok: true,
            linhas: r.linhas,
            duracao_ms: r.duracao_ms || Date.now() - tLoja,
            importResult: r.importResult,
            id_job: r.id_job,
          });
        } catch (e) {
          resultados.push({
            id_loja: loja.id_loja,
            bk_number: loja.bk_number,
            name: loja.name,
            ok: false,
            erro: e.message || String(e),
            duracao_ms: Date.now() - tLoja,
          });
        }
      }
    }

    const ok = resultados.filter((r) => r.ok).length;
    const falhas = resultados.length - ok;
    const duracao_ms = Date.now() - t0;
    const msg = `Lote: ${ok} ok, ${falhas} erro(s), ${lojas.length} loja(s), ${duracao_ms}ms`;
    ultimoStatus = {
      status: falhas && !ok ? 'erro' : falhas ? 'parcial' : 'ok',
      mensagem: msg,
      em: new Date().toISOString(),
      resultados,
    };
    console.log(`[bkoffice] ${msg}`);
    return { ok, falhas, duracao_ms, resultados };
  } finally {
    liberarLocksSync({ global: true });
    try {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Um login + um Excel do setor (todas as lojas) no período.
 * Usado no PC da gerência (loop.mjs) para venda quase ao vivo.
 */
export async function syncVendasBkOfficeGrupo({
  data_inicio,
  data_fim,
  criado_por = null,
  processar = true,
} = {}) {
  adquirirLocksSync({ global: true });
  const { rows: jobRows } = await pool.query(
    `INSERT INTO estoque_sync_jobs
       (id_loja, data_inicio, data_fim, status, criado_por, iniciado_em)
     VALUES (NULL, $1::date, $2::date, 'rodando', $3, NOW())
     RETURNING id_job`,
    [data_inicio, data_fim, criado_por],
  );
  const idJob = jobRows[0].id_job;
  const downloadDir = path.join(os.tmpdir(), 'vision-check-bkoffice', `grupo-${idJob}`);

  try {
    const filePath = await baixarExcelVendas({
      dataInicio: data_inicio,
      dataFim: data_fim,
      termoLoja: null,
      downloadDir,
      agruparPorDia: true,
    });
    const { importarVendasGrupoExcel } = await import('./importVendasGrupo.js');
    const imported = await importarVendasGrupoExcel({
      buffer: fs.readFileSync(filePath),
      dataPadrao: data_fim || data_inicio,
      processar,
      arquivo_nome: path.basename(filePath),
    });
    const msg = `OK grupo: ${imported.lojas} lojas, ${imported.linhas} linhas`;
    await atualizarJob(idJob, {
      status: 'ok',
      mensagem: msg,
      finalizado_em: new Date(),
    });
    ultimoStatus = { id_job: idJob, status: 'ok', mensagem: msg, em: new Date().toISOString() };
    return { id_job: idJob, arquivo: path.basename(filePath), ...imported };
  } catch (e) {
    const msg = e.message || String(e);
    await atualizarJob(idJob, {
      status: 'erro',
      mensagem: msg.slice(0, 2000),
      finalizado_em: new Date(),
    }).catch(() => {});
    ultimoStatus = { id_job: idJob, status: 'erro', mensagem: msg, em: new Date().toISOString() };
    throw e;
  } finally {
    liberarLocksSync({ global: true });
    try {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Agenda sync periódico no SERVIDOR (BKOFFICE_SERVER_SYNC=1).
 *
 * Cada ciclo: todas as lojas do dia (hoje BR), isolamento por loja, 1 sessão Playwright.
 * Proxy: Bright Data (BKOFFICE_BRIGHTDATA + BRIGHTDATA_PROXY_PASSWORD) ou BKOFFICE_PROXY legado.
 * Kit PC gerência permanece opcional (código legado), não é mais o fluxo principal.
 */
export function iniciarSchedulerBkOffice() {
  const serverSync =
    process.env.BKOFFICE_SERVER_SYNC === '1' ||
    process.env.BKOFFICE_SERVER_SYNC === 'true';
  const ms = Number(process.env.BKOFFICE_SYNC_CRON_MS || 0);
  if (!serverSync) {
    schedulerInfo = { ativo: false, intervalo_ms: 0, id_loja: 0, id_lojas: [], iniciado_em: null };
    console.log(
      '[bkoffice] Scheduler no servidor DESLIGADO (BKOFFICE_SERVER_SYNC≠1).',
    );
    return null;
  }
  if (!ms || ms < 60000) {
    schedulerInfo = { ativo: false, intervalo_ms: 0, id_loja: 0, id_lojas: [], iniciado_em: null };
    if (ms > 0 && ms < 60000) {
      console.warn('[bkoffice] Scheduler ignorado: BKOFFICE_SYNC_CRON_MS mínimo é 60000 (1 min)');
    } else {
      console.log(
        '[bkoffice] SERVER_SYNC=1 mas CRON=0 — sync só manual/CLI (npm run estoque:sync-bkoffice).',
      );
    }
    return null;
  }
  if (!process.env.BKOFFICE_USER || !process.env.BKOFFICE_PASS) {
    console.warn('[bkoffice] Scheduler ignorado: credenciais ausentes');
    schedulerInfo = { ativo: false, intervalo_ms: 0, id_loja: 0, id_lojas: [], iniciado_em: null };
    return null;
  }

  let proxyCfg = null;
  try {
    proxyCfg = resolveBkOfficePlaywrightProxy();
  } catch (e) {
    console.error('[bkoffice] Scheduler abortado — proxy:', e.message);
    schedulerInfo = { ativo: false, intervalo_ms: 0, id_loja: 0, id_lojas: [], iniciado_em: null };
    return null;
  }
  if (!proxyCfg) {
    console.warn(
      '[bkoffice] AVISO: sem Bright Data / BKOFFICE_PROXY — se o VPS estiver fora do BR, Akamai responde 403. ' +
        'Defina BKOFFICE_BRIGHTDATA=1 e BRIGHTDATA_PROXY_PASSWORD.',
    );
  } else {
    logProxyBkOffice(proxyCfg);
  }

  const hojeBR = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  let backoffUntil = 0;
  let backoffMs = 0;

  const registrarFalha = (err) => {
    const msg = err?.message || String(err);
    const akamai = err?.code === 'AKAMAI_403' || /403|Akamai/i.test(msg);
    if (akamai) {
      backoffMs = Math.min(Math.max(backoffMs * 2 || 15 * 60 * 1000, 15 * 60 * 1000), 2 * 60 * 60 * 1000);
      backoffUntil = Date.now() + backoffMs;
      console.error(
        `[bkoffice] 403 Akamai — pausa ${Math.round(backoffMs / 60000)} min. ` +
          'Confira Bright Data (BRIGHTDATA_PROXY_PASSWORD) / zona BR.',
      );
      return;
    }
    console.error('[bkoffice] Sync lote falhou:', msg);
  };

  const rodarCiclo = async (motivo) => {
    if (jobRodando) {
      console.log(`[bkoffice] Sync ${motivo} pulado — já tem job em andamento`);
      return;
    }
    if (Date.now() < backoffUntil) {
      const min = Math.ceil((backoffUntil - Date.now()) / 60000);
      console.log(`[bkoffice] Sync ${motivo} pulado — backoff (~${min} min)`);
      return;
    }

    const hoje = hojeBR();
    try {
      const lojas = await listarLojasBkOfficeSync();
      schedulerInfo.id_lojas = lojas.map((l) => l.id_loja);
      console.log(
        `[bkoffice] Sync ${motivo}: ${hoje} · ${lojas.length} loja(s)`,
      );
      const r = await syncVendasBkOfficeTodas({
        data_inicio: hoje,
        data_fim: hoje,
        processar: true,
      });
      if (r.ok > 0) backoffMs = 0;
      if (r.falhas && !r.ok) {
        registrarFalha(new Error(r.resultados.find((x) => !x.ok)?.erro || 'lote sem sucesso'));
      }
    } catch (err) {
      registrarFalha(err);
    }
  };

  schedulerInfo = {
    ativo: true,
    intervalo_ms: ms,
    id_loja: null,
    id_lojas: [],
    iniciado_em: new Date().toISOString(),
  };
  console.log(
    `[bkoffice] Scheduler produção a cada ${Math.round(ms / 1000)}s — todas as lojas · proxy=${proxyCfg?.provider || 'nenhum'}`,
  );

  setTimeout(() => {
    void rodarCiclo('inicial');
  }, 15000);

  return setInterval(() => {
    void rodarCiclo('agendado');
  }, ms);
}
