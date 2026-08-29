/**
 * Kit PC gerência: baixa Excel no Chrome local e envia via HTTPS (sem Postgres na loja).
 *
 *   node sync-bkoffice-via-api.mjs --loja=21 --inicio=2026-08-11 --fim=2026-08-11
 *   node sync-bkoffice-via-api.mjs --grupo --inicio=... --fim=...
 *   node sync-bkoffice-via-api.mjs --sessao --inicio=... --fim=...   # 1 login, N lojas
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const getArg = (k, def) => {
  const hit = process.argv.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};

const grupo = process.argv.includes('--grupo') || process.argv.includes('--todas');
const sessao = process.argv.includes('--sessao') || process.argv.includes('--sessao-lojas');
const quiet = process.argv.includes('--quiet') || process.env.BKOFFICE_KIT_QUIET === '1';
const log = (...a) => {
  if (!quiet) console.log(...a);
};
const logErr = (...a) => console.error(...a);

const idLoja = Number(getArg('--loja', process.env.BKOFFICE_SYNC_ID_LOJA || '21'));
const ini = getArg('--inicio', '');
const fim = getArg('--fim', ini);
const termoArg = getArg('--termo', '') || null;

function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const dataInicio = ini || hojeBR();
const dataFim = fim || dataInicio;

const apiBase = String(process.env.API_BASE || process.env.MERIDIAN_API_BASE || '')
  .trim()
  .replace(/\/$/, '');
const kitToken = String(process.env.BKOFFICE_KIT_TOKEN || '').trim();

if (!apiBase) {
  console.error('Defina API_BASE (ex.: https://grupoalvim.com.br/auditoria/api)');
  process.exit(1);
}
if (!kitToken || kitToken.length < 16) {
  console.error('Defina BKOFFICE_KIT_TOKEN (mesmo valor do .env do servidor)');
  process.exit(1);
}
if (!process.env.BKOFFICE_USER || !process.env.BKOFFICE_PASS) {
  console.error('Faltam BKOFFICE_USER / BKOFFICE_PASS');
  process.exit(1);
}

const modo = sessao ? 'kit-https-sessao' : grupo ? 'kit-https-grupo' : 'kit-https';
log({
  modo,
  loja: sessao || grupo ? 'all' : idLoja,
  api: apiBase,
  data_inicio: dataInicio,
  data_fim: dataFim,
});

const downloadDir = path.join(
  os.tmpdir(),
  'vision-check-bkoffice-kit',
  `${sessao ? 'sessao' : grupo ? 'grupo' : idLoja}-${Date.now()}`,
);
fs.mkdirSync(downloadDir, { recursive: true });

const { baixarExcelVendas, baixarExcelVendasVariasLojas } = await import(
  '../src/services/bkoffice/syncVendas.js'
);

async function postForm(url, form) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'X-Meridian-Kit-Token': kitToken },
    body: form,
  });
  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { resp, json };
}

async function uploadArquivo(filePath, idLojaUpload) {
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const form = new FormData();
  form.append('arquivo', blob, path.basename(filePath));
  form.append('data_inicio', dataInicio);
  form.append('data_fim', dataFim);
  form.append('processar', '1');
  form.append('id_loja', String(idLojaUpload));
  return postForm(`${apiBase}/public/kit/estoque/vendas-import`, form);
}

async function listarLojasApi() {
  const lr = await fetch(`${apiBase}/public/kit/estoque/lojas-sync?ids=all`, {
    headers: { 'X-Meridian-Kit-Token': kitToken },
  });
  if (!lr.ok) throw new Error(`lojas-sync HTTP ${lr.status}`);
  const body = await lr.json();
  return Array.isArray(body.lojas) ? body.lojas : [];
}

try {
  if (sessao) {
    const lojas = await listarLojasApi();
    log(`sessão: 1 login → ${lojas.length} loja(s)`);
    const downs = await baixarExcelVendasVariasLojas({
      lojas,
      dataInicio,
      dataFim,
      downloadDir,
      agruparPorDia: true,
    });
    const resultados = [];
    let okCount = 0;
    for (const d of downs) {
      if (!d.ok || !d.filePath || !d.id_loja) {
        resultados.push({
          id_loja: d.id_loja,
          bk_number: d.bk_number,
          ok: false,
          erro: d.erro || 'sem arquivo',
        });
        continue;
      }
      const { resp, json } = await uploadArquivo(d.filePath, d.id_loja);
      if (!resp.ok) {
        resultados.push({
          id_loja: d.id_loja,
          bk_number: d.bk_number,
          ok: false,
          erro: json?.error || `HTTP ${resp.status}`,
        });
        continue;
      }
      okCount += 1;
      resultados.push({
        id_loja: d.id_loja,
        bk_number: d.bk_number,
        ok: true,
        linhas: json.linhas,
        venda_total: json.venda_total,
      });
    }
    const summary = {
      ok: okCount >= Math.min(2, lojas.length),
      modo: 'sessao',
      dia: dataInicio,
      lojas_ok: okCount,
      ids: resultados.filter((r) => r.ok).map((r) => r.id_loja),
      linhas: resultados.reduce((a, r) => a + (Number(r.linhas) || 0), 0),
      venda_total: resultados.reduce((a, r) => a + (Number(r.venda_total) || 0), 0),
      de: dataInicio,
      ate: dataFim,
      gravado_no_banco: true,
      resultados,
    };
    console.log('KIT_RESULT:' + JSON.stringify(summary));
    if (!summary.ok) process.exit(1);
    process.exit(0);
  }

  let termoLoja = null;
  if (!grupo) {
    termoLoja =
      termoArg ||
      process.env.BKOFFICE_TERMO_LOJA ||
      process.env.BKOFFICE_BK_NUMBER ||
      null;
    if (!termoLoja) {
      try {
        const lr = await fetch(`${apiBase}/public/kit/estoque/lojas-sync?ids=${idLoja}`, {
          headers: { 'X-Meridian-Kit-Token': kitToken },
        });
        if (lr.ok) {
          const body = await lr.json();
          const hit = (body.lojas || []).find((l) => Number(l.id_loja) === idLoja);
          if (hit?.bk_number) termoLoja = String(hit.bk_number).trim();
        }
      } catch {
        /* ignore */
      }
    }
    if (!termoLoja) {
      termoLoja = idLoja === 21 ? '30797' : String(idLoja);
    }
  }

  const filePath = await baixarExcelVendas({
    dataInicio,
    dataFim,
    termoLoja,
    downloadDir,
    agruparPorDia: true,
  });
  const buf = fs.readFileSync(filePath);

  function formBase() {
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const form = new FormData();
    form.append('arquivo', blob, path.basename(filePath));
    form.append('data_inicio', dataInicio);
    form.append('data_fim', dataFim);
    form.append('processar', '1');
    return form;
  }

  if (grupo) {
    const urlGrupo = `${apiBase}/public/kit/estoque/vendas-import-grupo`;
    log('upload grupo', urlGrupo, 'bytes', buf.length);
    let { resp, json } = await postForm(urlGrupo, formBase());
    if (resp.status === 404) {
      log('API antiga sem import-grupo — envia loja a loja (mesmo Excel)');
      const lojas = await listarLojasApi();
      const { parseVendasExcelBuffer, agruparItensPorLoja } = await import(
        '../src/services/bkoffice/parseVendasExcel.js'
      );
      const { carregarAliasesBkn } = await import('../src/services/bkoffice/bknAlias.js');
      const aliases = await carregarAliasesBkn().catch(() => new Map());
      const parsed = parseVendasExcelBuffer(buf, { dataPadrao: dataFim });
      const { grupos } = agruparItensPorLoja(parsed, lojas, aliases);
      const resultados = [];
      for (const g of grupos.values()) {
        const form = formBase();
        form.append('id_loja', String(g.loja.id_loja));
        const r = await postForm(`${apiBase}/public/kit/estoque/vendas-import`, form);
        if (!r.resp.ok) {
          throw new Error(r.json?.error || `HTTP ${r.resp.status} loja ${g.loja.id_loja}`);
        }
        resultados.push({
          id_loja: g.loja.id_loja,
          linhas: r.json.linhas,
          venda_total: r.json.venda_total,
        });
      }
      json = {
        ok: true,
        lojas: resultados.length,
        linhas: resultados.reduce((a, x) => a + (x.linhas || 0), 0),
        venda_total: resultados.reduce((a, x) => a + (Number(x.venda_total) || 0), 0),
        resultados,
      };
      resp = { ok: true, status: 201 };
    }
    if (!resp.ok) {
      const msg = json?.error || json?.message || `HTTP ${resp.status}`;
      logErr('KIT_RESULT:' + JSON.stringify({ ok: false, dia: dataInicio, erro: msg }));
      process.exit(1);
    }
    const summary = {
      ok: true,
      modo: 'grupo',
      dia: dataInicio,
      lojas_ok: json.lojas ?? json.resultados?.length ?? 0,
      ids: Array.isArray(json.resultados) ? json.resultados.map((r) => r.id_loja) : [],
      linhas: json.linhas ?? 0,
      venda_total: json.venda_total ?? null,
      de: json.de ?? dataInicio,
      ate: json.ate ?? dataFim,
      gravado_no_banco: true,
    };
    console.log('KIT_RESULT:' + JSON.stringify(summary));
    process.exit(0);
  }

  const form = formBase();
  form.append('id_loja', String(idLoja));
  const { resp, json } = await postForm(`${apiBase}/public/kit/estoque/vendas-import`, form);
  if (!resp.ok) {
    const msg = json?.error || json?.message || `HTTP ${resp.status}`;
    logErr('KIT_RESULT:' + JSON.stringify({ ok: false, dia: dataInicio, erro: msg }));
    process.exit(1);
  }
  console.log(
    'KIT_RESULT:' +
      JSON.stringify({
        ok: true,
        loja: json.loja ?? idLoja,
        dia: dataInicio,
        linhas: json.linhas ?? 0,
        venda_total: json.venda_total ?? null,
        dias: json.dias ?? 1,
        de: json.de ?? dataInicio,
        ate: json.ate ?? dataFim,
        gravado_no_banco: true,
      }),
  );
  process.exit(0);
} catch (e) {
  logErr('KIT_RESULT:' + JSON.stringify({ ok: false, dia: dataInicio, erro: e.message || String(e) }));
  logErr(e.message || e);
  process.exit(1);
} finally {
  try {
    fs.rmSync(downloadDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
