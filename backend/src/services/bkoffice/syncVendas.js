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
  await page.locator('#initialDate').click({ clickCount: 3 });
  await page.locator('#initialDate').fill(ini);
  await page.locator('#endDate').click({ clickCount: 3 });
  await page.locator('#endDate').fill(fim);
}

/**
 * Seleciona restaurante no autocomplete, se informado.
 * @param {string|null} termoLoja — texto parcial (ex.: PLK / nome)
 */
async function selecionarRestaurante(page, termoLoja) {
  if (!termoLoja) return;
  const combo = page.locator('#comboRestauranteGroup-autocomplete');
  await combo.click({ timeout: 15000 });
  await combo.fill('');
  await combo.type(String(termoLoja), { delay: 40 });
  await page.waitForTimeout(800);
  // tenta opção da lista
  const opcao = page.locator('[role="option"]').filter({ hasText: String(termoLoja) }).first();
  if (await opcao.count()) {
    await opcao.click();
  } else {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
  }
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

  const browser = await playwright.chromium.launch({
    headless: process.env.BKOFFICE_HEADLESS !== '0',
    downloadsPath: downloadDir,
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      locale: 'pt-BR',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(Number(process.env.BKOFFICE_TIMEOUT_MS || 60000));

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('#user').fill(user);
    await page.locator('#pass').fill(pass);
    await page.locator('#button').click();
    await page.waitForURL(/\/home/, { timeout: 45000 }).catch(() => {});

    // CMV → Relatório → label Relatório → Vendas
    await page.locator('#btnBKoffice').click();
    await page.waitForTimeout(500);
    await page.locator('#btnreport').click();
    await page.waitForTimeout(500);
    await page.locator('#gRel h5 label').first().click().catch(async () => {
      await page.locator('#gRel').click();
    });
    await page.waitForTimeout(400);
    await page.locator('#reportSales h5').click();
    await page.waitForSelector('#initialDate', { timeout: 30000 });

    await preencherDatas(page, dataInicio, dataFim);

    // Agrupar por dia
    const agrupar = page.locator('#main-divs label').filter({ hasText: /agrupar por dia/i });
    if (await agrupar.count()) {
      const input = agrupar.locator('input[type="checkbox"]');
      if (await input.count()) {
        const checked = await input.isChecked();
        if (!checked) await agrupar.click();
      } else {
        await agrupar.click();
      }
    } else {
      await page.locator('#main-divs > div:first-child label').nth(0).click().catch(() => {});
    }

    await selecionarRestaurante(page, termoLoja);

    // Buscar (opcional) + Exportar Excel
    const buscar = page.getByRole('button', { name: /buscar/i });
    if (await buscar.count()) {
      await buscar.click().catch(() => {});
      await page.waitForTimeout(1500);
    }

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.locator('#salvar').click(),
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
    if (!termo && id_loja) {
      const { rows } = await pool.query(
        'SELECT name, bk_number FROM lojas WHERE id_loja = $1',
        [id_loja],
      );
      termo = rows[0]?.bk_number || rows[0]?.name || null;
    }

    const filePath = await baixarExcelVendas({
      dataInicio: data_inicio,
      dataFim: data_fim,
      termoLoja: termo,
      downloadDir,
    });

    const buffer = fs.readFileSync(filePath);
    const parsed = parseVendasExcelBuffer(buffer, { dataPadrao: data_inicio });

    // Se linhas sem data e período é um único dia, usa data_inicio
    const itens = parsed.map((r) => ({
      ...r,
      data_venda: r.data_venda || (data_inicio === data_fim ? data_inicio : r.data_venda),
    }));

    // Descarta linhas sem data quando período > 1 dia
    const validos = itens.filter((r) => r.data_venda && r.codigo && r.qtde > 0);
    if (!validos.length) {
      throw Object.assign(
        new Error('Excel baixado sem linhas de venda reconhecíveis'),
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
 * Agenda sync diário simples (se BKOFFICE_SYNC_CRON_MS > 0).
 * Default: desligado. Ex.: 86400000 = 24h.
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

  console.log(`[bkoffice] Scheduler ativo a cada ${ms}ms (loja ${idLoja})`);
  return setInterval(() => {
    const hoje = new Date();
    const iso = hoje.toISOString().slice(0, 10);
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
