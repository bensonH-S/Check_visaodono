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

export function getBkOfficeStatus() {
  return {
    configurado: Boolean(process.env.BKOFFICE_USER && process.env.BKOFFICE_PASS),
    job_rodando: jobRodando,
    ultimo: ultimoStatus,
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

async function baixarExcelVendas({ dataInicio, dataFim, termoLoja, downloadDir }) {
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

  const headless = process.env.BKOFFICE_HEADLESS !== '0';
  const useChrome = process.env.BKOFFICE_USE_CHROME !== '0';
  const launchOpts = {
    headless,
    downloadsPath: downloadDir,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  };
  // Chrome instalado no Windows costuma passar melhor no WAF (Akamai) do que Chromium puro
  if (useChrome) {
    launchOpts.channel = 'chrome';
  }

  let browser;
  try {
    browser = await playwright.chromium.launch(launchOpts);
  } catch (e) {
    if (useChrome) {
      console.warn('[bkoffice] Chrome canal falhou, tentando Chromium:', e.message);
      delete launchOpts.channel;
      browser = await playwright.chromium.launch(launchOpts);
    } else {
      throw e;
    }
  }

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
    page.setDefaultTimeout(Number(process.env.BKOFFICE_TIMEOUT_MS || 90000));

    const resp = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    if (resp && resp.status() === 403) {
      throw Object.assign(
        new Error(
          'BK Office bloqueou o acesso (403 Akamai). Tente BKOFFICE_HEADLESS=0 e BKOFFICE_USE_CHROME=1 no .env',
        ),
        { status: 503 },
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

    // Libera filtros e marca "Restaurante e Produto Venda"
    // (só "Produto Venda" + Todos deixa BK Number / Restaurante vazios no Excel)
    await page.evaluate(() => {
      document.querySelectorAll('#main-divs [disabled], #radioRel[disabled]').forEach((el) => {
        el.removeAttribute('disabled');
      });
      const el = document.querySelector('#relRestaurantSku') || document.querySelector('#relSku');
      if (el) {
        el.checked = true;
        el.dispatchEvent(new Event('click', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(800);
    await page.waitForSelector('#comboRestauranteGroup-autocomplete', { timeout: 20000 });

    await preencherDatas(page, dataInicio, dataFim);

    // Agrupar por dia
    await page.evaluate(() => {
      const el = document.querySelector('#groupDia');
      if (!el) return;
      el.disabled = false;
      el.removeAttribute('disabled');
      el.checked = true;
      el.dispatchEvent(new Event('click', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
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

    // Buscar e aguardar montar a grade antes de exportar
    const buscar = page.getByRole('button', { name: /buscar/i });
    if (await buscar.count()) {
      await buscar.click({ force: true }).catch(() => {});
    }
    await page.locator('text=Por favor aguarde').waitFor({ state: 'hidden', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // Confirma que há linhas (ou pelo menos sumiu "nenhum registro" após busca)
    await page.waitForFunction(() => {
      const body = document.body?.innerText || '';
      return body.includes('Exportar Excel') || body.includes('Produto Venda') || body.includes('WHOPPER');
    }, { timeout: 30000 }).catch(() => {});

    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('#ui-datepicker-div').waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});

    const exportBtn = page.locator('#salvar').or(page.getByRole('button', { name: /exportar excel/i }));
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      exportBtn.first().click({ force: true }),
    ]);

    const suggested = download.suggestedFilename() || `vendas-bk-${Date.now()}.xlsx`;
    const filePath = path.join(downloadDir, suggested);
    await download.saveAs(filePath);
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

    const itens = parsed.map((r) => ({
      ...r,
      data_venda: r.data_venda || (data_inicio === data_fim ? data_inicio : r.data_venda),
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
 * Agenda sync periódico (se BKOFFICE_SYNC_CRON_MS > 0).
 * Mínimo 60s. Ex.: 60000 = 1 min.
 * Obs.: cada sync abre o BK Office via Playwright; se demorar > intervalo,
 * o próximo ciclo é pulado (jobRodando).
 */
export function iniciarSchedulerBkOffice() {
  const ms = Number(process.env.BKOFFICE_SYNC_CRON_MS || 0);
  if (!ms || ms < 60000) return null;
  if (!process.env.BKOFFICE_USER || !process.env.BKOFFICE_PASS) {
    console.warn('[bkoffice] Scheduler ignorado: credenciais ausentes');
    return null;
  }
  const idLoja = Number(process.env.BKOFFICE_SYNC_ID_LOJA || 0);
  if (!idLoja) {
    console.warn('[bkoffice] Scheduler ignorado: defina BKOFFICE_SYNC_ID_LOJA');
    return null;
  }

  const hojeBR = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  console.log(`[bkoffice] Scheduler ativo a cada ${Math.round(ms / 1000)}s (loja ${idLoja})`);
  // Primeiro sync após 15s (dá tempo da API subir)
  setTimeout(() => {
    const iso = hojeBR();
    void syncVendasBkOffice({
      id_loja: idLoja,
      data_inicio: iso,
      data_fim: iso,
      processar: true,
    }).catch((err) => {
      console.error('[bkoffice] Sync inicial falhou:', err.message);
    });
  }, 15000);

  return setInterval(() => {
    const iso = hojeBR();
    void syncVendasBkOffice({
      id_loja: idLoja,
      data_inicio: iso,
      data_fim: iso,
      processar: true,
    }).catch((err) => {
      console.error('[bkoffice] Sync agendado falhou:', err.message);
    });
  }, ms);
}
