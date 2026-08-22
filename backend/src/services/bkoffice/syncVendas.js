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

const BASE_URL = process.env.BKOFFICE_URL || 'https://bkoffice-franquia.burgerking.com.br';

let jobRodando = false;
let ultimoStatus = null;
/** @type {{ ativo: boolean, intervalo_ms: number, id_loja: number|null, id_lojas: number[], iniciado_em: string|null }} */
let schedulerInfo = {
  ativo: false,
  intervalo_ms: 0,
  id_loja: 0,
  id_lojas: [],
  iniciado_em: null,
};

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
  // Cron desligado = sync só no PC da gerência; não expor erro antigo de Akamai do servidor
  const ultimo =
    !schedulerInfo.ativo && !serverSync
      ? null
      : ultimoStatus;
  return {
    configurado: Boolean(process.env.BKOFFICE_USER && process.env.BKOFFICE_PASS),
    job_rodando: jobRodando,
    ultimo,
    server_sync: serverSync,
    modo: schedulerInfo.ativo
      ? 'servidor'
      : serverSync
        ? 'manual_servidor'
        : 'pc_gerencia',
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

/**
 * Seleciona item em autocomplete jQuery UI (digitar + clicar na lista).
 */
async function selecionarAutocomplete(page, inputSelector, termo, { obrigatorio = true } = {}) {
  if (!termo) return null;
  const t = String(termo).trim();
  if (!t) return null;

  await page.evaluate(() => {
    document.querySelectorAll('#main-divs [disabled], #radioRel[disabled]').forEach((el) => {
      el.removeAttribute('disabled');
    });
  });

  const combo = page.locator(inputSelector);
  await combo.waitFor({ state: 'attached', timeout: 20000 });
  await combo.evaluate((el) => {
    el.disabled = false;
    el.removeAttribute('disabled');
  });
  await combo.click({ force: true });
  await combo.fill('');
  await combo.type(t, { delay: 55 });

  const menu = page.locator('ul.ui-autocomplete:visible').last();
  await menu.waitFor({ state: 'visible', timeout: 10000 });
  const item = menu.locator('li').filter({ hasText: t }).first();
  if (await item.count()) {
    await item.click({ force: true });
  } else {
    await menu.locator('li').first().click({ force: true });
  }
  await page.waitForTimeout(350);

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

async function selecionarRestaurante(page, termoLoja) {
  if (!termoLoja) return;
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
  await page.waitForTimeout(500);
}

async function aguardarGradeVendas(page) {
  const buscar = page.getByRole('button', { name: /buscar/i });
  if (await buscar.count()) {
    await buscar.click({ force: true }).catch(() => {});
  }
  await page.locator('text=Por favor aguarde').waitFor({ state: 'hidden', timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => {
    const body = document.body?.innerText || '';
    if (/nenhum registro|sem dados/i.test(body)) return false;
    return body.includes('Exportar Excel') || body.includes('Produto Venda') || body.includes('WHOPPER');
  }, { timeout: 45000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('#ui-datepicker-div').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/** Export Excel com retentativas — BK Office às vezes não dispara download na 1ª vez. */
async function exportarExcelComRetry(page, downloadDir) {
  const dlTimeout = Number(process.env.BKOFFICE_DOWNLOAD_TIMEOUT_MS || 180000);
  const exportBtn = page.locator('#salvar').or(page.getByRole('button', { name: /exportar excel/i }));
  await exportBtn.first().waitFor({ state: 'visible', timeout: 30000 });
  await exportBtn.first().scrollIntoViewIfNeeded().catch(() => {});

  const bodyText = ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 2000);
  if (/nenhum registro|sem dados/i.test(bodyText)) {
    throw Object.assign(new Error('BK Office: busca sem dados para o periodo'), { status: 422 });
  }

  let lastErr;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    console.log(`[bkoffice] export Excel tentativa ${tentativa}/3`);
    try {
      await page.keyboard.press('Escape').catch(() => {});
      await page.locator('#ui-datepicker-div').waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);

      const downloadPromise = page.waitForEvent('download', { timeout: dlTimeout });
      await exportBtn.first().click({ force: true });
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
        await page.screenshot({ path: shot, fullPage: true });
        console.warn(`[bkoffice] screenshot: ${shot}`);
      } catch {
        /* ignore */
      }
      if (tentativa < 3) {
        await aguardarGradeVendas(page);
        await marcarRelatorioRestauranteProduto(page);
      }
    }
  }
  throw lastErr || new Error('Falha ao exportar Excel apos 3 tentativas');
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
    const proxyRaw = (process.env.BKOFFICE_PROXY || process.env.HTTPS_PROXY || '').trim();
    const contextOpts = {
      acceptDownloads: true,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      viewport: { width: 1365, height: 900 },
      userAgent:
        process.env.BKOFFICE_USER_AGENT ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };
    if (proxyRaw) {
      // Aceita: http://user:pass@host:port | http://host:port + BKOFFICE_PROXY_USER/PASS
      let server = proxyRaw;
      let username = (process.env.BKOFFICE_PROXY_USER || '').trim() || undefined;
      let password = (process.env.BKOFFICE_PROXY_PASS || '').trim() || undefined;
      try {
        const u = new URL(proxyRaw.includes('://') ? proxyRaw : `http://${proxyRaw}`);
        server = `${u.protocol}//${u.host}`;
        if (u.username) username = decodeURIComponent(u.username);
        if (u.password) password = decodeURIComponent(u.password);
      } catch {
        /* mantém server cru */
      }
      contextOpts.proxy = {
        server,
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
      };
      console.log(
        `[bkoffice] usando proxy ${server}${username ? ` (user=${username.slice(0, 3)}***)` : ''}`,
      );
    }

    const context = await browser.newContext(contextOpts);
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(Number(process.env.BKOFFICE_TIMEOUT_MS || 90000));

    const resp = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    if (resp && resp.status() === 403) {
      throw Object.assign(
        new Error(
          'BK Office bloqueou o acesso (403 Akamai). ' +
            'No servidor fora do Brasil defina BKOFFICE_PROXY com proxy residencial/BR ' +
            '(http://user:pass@host:port). No Windows local: BKOFFICE_USE_CHROME=1.',
        ),
        { status: 503, code: 'AKAMAI_403' },
      );
    }

    // Overlay "Por favor aguarde..." / popup inicial
    await page.waitForSelector('#user', { state: 'visible', timeout: 60000 }).catch(async () => {
      const title = await page.title();
      throw Object.assign(
        new Error(`Campo #user não apareceu (title=${title}). Possível bloqueio do WAF.`),
        { status: 503 },
      );
    });
    const alertaOk = page.getByRole('button', { name: /^ok$/i });
    if (await alertaOk.count()) {
      await alertaOk.first().click().catch(() => {});
    }

    await page.locator('#user').fill(user);
    await page.locator('#pass').fill(pass);
    await page.locator('#button').click();
    await page.waitForURL(/\/home/, { timeout: 60000 }).catch(() => {});

    // CMV → Relatório → Vendas (mesmo fluxo que funciona no probe)
    await page.locator('#btnBKoffice').click();
    await page.waitForTimeout(800);
    await page.locator('#btnreport').click();
    await page.waitForTimeout(800);
    await page.locator('#gRel h5 label').first().click().catch(async () => {
      await page.locator('#gRel').click();
    });
    await page.waitForTimeout(500);
    await page.locator('#reportSales h5').click();
    await page.waitForURL(/RelatorioVendas/i, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('#initialDate', { timeout: 30000 });

    // "Restaurante e Produto Venda" — se cair no relatório só de Restaurante,
    // o Excel vem sem coluna Produto Venda (só totais da loja por dia).
    await marcarRelatorioRestauranteProduto(page);
    await page.waitForSelector('#comboRestauranteGroup-autocomplete', { timeout: 20000 });

    await preencherDatas(page, dataInicio, dataFim);

    // Agrupar por dia (necessário pra baixas diárias; desligar na descoberta de catálogo)
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

    // Setor Grupo Alvim (precisa clicar na lista, não só digitar)
    await selecionarAutocomplete(page, '#comboSectorGroup-autocomplete', '1005196', {
      obrigatorio: false,
    }).catch(() =>
      selecionarAutocomplete(page, '#comboSectorGroup-autocomplete', 'Grupo Alvim', {
        obrigatorio: false,
      }),
    );

    // Restaurante específico (obrigatório pra baixar certo da loja)
    await selecionarRestaurante(page, termoLoja);

    // Reaplica o tipo de relatório — filtros de loja/data às vezes resetam o radio
    await marcarRelatorioRestauranteProduto(page);

    // Buscar e aguardar montar a grade antes de exportar
    await aguardarGradeVendas(page);

    const filePath = await exportarExcelComRetry(page, downloadDir);
    await context.close();
    return filePath;
  } finally {
    await browser.close().catch(() => {});
  }
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
  if (jobRodando) {
    throw Object.assign(new Error('Já existe um sync BK Office em andamento'), { status: 409 });
  }
  jobRodando = true;

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
    // Resolve termo loja (bk_number / nome) se não informado
    let termo = termo_loja;
    let bkNumber = null;
    if (id_loja) {
      const { rows } = await pool.query(
        'SELECT name, bk_number FROM lojas WHERE id_loja = $1',
        [id_loja],
      );
      bkNumber = rows[0]?.bk_number ? String(rows[0].bk_number).trim() : null;
      if (!termo) termo = bkNumber || rows[0]?.name || null;
    }

    const filePath = await baixarExcelVendas({
      dataInicio: data_inicio,
      dataFim: data_fim,
      termoLoja: termo,
      downloadDir,
      agruparPorDia,
    });

    const buffer = fs.readFileSync(filePath);
    let parsed = parseVendasExcelBuffer(buffer, {
      dataPadrao: data_inicio,
      bkNumber,
    });
    // Se filtro por BK Number zerou, tenta sem filtro (evita sync vazio por cadastro desalinhado)
    if (!parsed.length && bkNumber) {
      parsed = parseVendasExcelBuffer(buffer, { dataPadrao: data_inicio });
    }

    // Sem coluna Dia (relatório agregado no período), usa data_fim como balde
    const itens = parsed.map((r) => ({
      ...r,
      data_venda: r.data_venda || data_fim || data_inicio,
    }));

    const validos = itens.filter((r) => r.data_venda && r.codigo && r.qtde > 0);
    if (!validos.length) {
      // Mantém o Excel para debug (parse vazio / período sem linhas)
      try {
        const debugDir = path.join(process.cwd(), 'Logs', 'bkoffice-debug');
        fs.mkdirSync(debugDir, { recursive: true });
        const dest = path.join(
          debugDir,
          `vazio-${id_loja}-${data_inicio}_${data_fim}-${Date.now()}${path.extname(filePath) || '.xlsx'}`,
        );
        fs.copyFileSync(filePath, dest);
        console.warn('[bkoffice] Excel sem linhas parseáveis — cópia em', dest);
      } catch {
        /* ignore */
      }
      throw Object.assign(
        new Error(
          'Excel baixado sem linhas de produto. Confirme o relatório "Restaurante e Produto Venda". Se o período for longo, tente janelas menores (7 dias).',
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

    const msg = `OK: ${validos.length} linhas, ${importResult.dias} dia(s)`;
    await atualizarJob(idJob, {
      status: 'ok',
      mensagem: msg,
      finalizado_em: new Date(),
    });
    ultimoStatus = { id_job: idJob, status: 'ok', mensagem: msg, em: new Date().toISOString() };
    return { id_job: idJob, arquivo: path.basename(filePath), linhas: validos.length, importResult };
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
    jobRodando = false;
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
 * Multi-loja (round-robin): a cada ciclo sincroniza a próxima loja do dia.
 * Boot: backfill 01→hoje na loja atual do ponteiro (uma loja por vez no backfill inicial
 * fica pesado; faz backfill só do dia atual em todas após a 1ª volta, e backfill mensal
 * loja a loja nos ciclos seguintes se necessário).
 *
 * Fora do BR: obrigatório BKOFFICE_PROXY (residencial/BR), senão o Akamai bloqueia.
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
    }
    return null;
  }
  if (!process.env.BKOFFICE_USER || !process.env.BKOFFICE_PASS) {
    console.warn('[bkoffice] Scheduler ignorado: credenciais ausentes');
    schedulerInfo = { ativo: false, intervalo_ms: 0, id_loja: 0, id_lojas: [], iniciado_em: null };
    return null;
  }

  const proxyUrl = (process.env.BKOFFICE_PROXY || process.env.HTTPS_PROXY || '').trim();
  if (!proxyUrl) {
    console.warn(
      '[bkoffice] AVISO: sem BKOFFICE_PROXY — se o IP do servidor for datacenter/fora do BR, ' +
        'o Akamai responde 403. Configure proxy residencial brasileiro.',
    );
  }

  const hojeBR = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const dataInicioMes = () => {
    const fixo = String(process.env.BKOFFICE_SYNC_DATA_INICIO || '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fixo)) return fixo;
    const hoje = hojeBR();
    return `${hoje.slice(0, 8)}01`;
  };

  const addDaysISO = (iso, delta) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + delta);
    return dt.toISOString().slice(0, 10);
  };

  let backoffUntil = 0;
  let backoffMs = 0;
  let rrIndex = 0;
  /** @type {Map<number, string>} id_loja → YYYY-MM já backfillado */
  const backfillFeito = new Map();
  /** @type {Array<{id_loja:number,name:string,bk_number:string}>} */
  let lojasCache = [];
  let lojasCacheEm = 0;

  const registrarFalha = (err) => {
    const msg = err?.message || String(err);
    const akamai = err?.code === 'AKAMAI_403' || /403|Akamai/i.test(msg);
    if (akamai) {
      backoffMs = Math.min(Math.max(backoffMs * 2 || 15 * 60 * 1000, 15 * 60 * 1000), 2 * 60 * 60 * 1000);
      backoffUntil = Date.now() + backoffMs;
      console.error(
        `[bkoffice] 403 Akamai — pausa ${Math.round(backoffMs / 60000)} min. ` +
          'No .env do servidor: BKOFFICE_PROXY=http://user:pass@host:port (IP residencial BR).',
      );
      return;
    }
    console.error('[bkoffice] Sync falhou:', msg);
  };

  const carregarLojas = async () => {
    if (lojasCache.length && Date.now() - lojasCacheEm < 30 * 60 * 1000) return lojasCache;
    lojasCache = await listarLojasBkOfficeSync();
    lojasCacheEm = Date.now();
    schedulerInfo.id_lojas = lojasCache.map((l) => l.id_loja);
    if (!lojasCache.length) {
      console.warn('[bkoffice] Nenhuma loja com BKN para sync');
    } else {
      console.log(
        `[bkoffice] ${lojasCache.length} loja(s) no rodízio: ${lojasCache
          .map((l) => `${l.bk_number || l.id_loja}`)
          .join(', ')}`,
      );
    }
    return lojasCache;
  };

  const syncDiaLoja = async (loja, dia, motivo) => {
    console.log(
      `[bkoffice] Sync ${motivo}: ${dia} · loja ${loja.id_loja} (${loja.bk_number} ${loja.name})`,
    );
    await syncVendasBkOffice({
      id_loja: loja.id_loja,
      data_inicio: dia,
      data_fim: dia,
      termo_loja: loja.bk_number,
      processar: true,
    });
  };

  const rodarCiclo = async (motivo) => {
    if (jobRodando) {
      console.log(`[bkoffice] Sync ${motivo} pulado — já tem job em andamento`);
      return;
    }
    if (Date.now() < backoffUntil) {
      const min = Math.ceil((backoffUntil - Date.now()) / 60000);
      console.log(`[bkoffice] Sync ${motivo} pulado — backoff Akamai (~${min} min)`);
      return;
    }

    const lojas = await carregarLojas();
    if (!lojas.length) return;

    const loja = lojas[rrIndex % lojas.length];
    rrIndex = (rrIndex + 1) % lojas.length;
    schedulerInfo.id_loja = loja.id_loja;

    const hoje = hojeBR();
    const mes = hoje.slice(0, 7);
    try {
      if (backfillFeito.get(loja.id_loja) !== mes) {
        const ini = dataInicioMes();
        console.log(
          `[bkoffice] Backfill ${ini}→${hoje} loja ${loja.id_loja} (${loja.bk_number})`,
        );
        for (let d = ini; d <= hoje; d = addDaysISO(d, 1)) {
          if (Date.now() < backoffUntil) break;
          await syncDiaLoja(loja, d, 'backfill');
        }
        backfillFeito.set(loja.id_loja, mes);
        backoffMs = 0;
        return;
      }
      await syncDiaLoja(loja, hoje, motivo);
      backoffMs = 0;
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
    `[bkoffice] Scheduler multi-loja a cada ${Math.round(ms / 1000)}s (round-robin)` +
      (proxyUrl ? ' — com proxy' : ' — SEM proxy'),
  );

  setTimeout(() => {
    void rodarCiclo('inicial');
  }, 15000);

  return setInterval(() => {
    void rodarCiclo('agendado');
  }, ms);
}
