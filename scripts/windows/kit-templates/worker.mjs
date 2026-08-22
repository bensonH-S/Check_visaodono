/**
 * Worker BK Office — cofre criptografado + sync via HTTPS.
 * Rodízio: uma loja por ciclo (BKOFFICE_SYNC_ID_LOJAS=all).
 * Log: um arquivo por loja em Logs/lojas/ — não misturar no mesmo arquivo.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { loadVault } from './vault_tools.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function kitRoot() {
  if (process.pkg) return path.dirname(process.execPath);
  return path.resolve(__dirname);
}

function agoraBR() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function slugNome(name) {
  const s = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/BURGER KING\s*-?\s*/gi, '')
    .replace(/POPYES\s*-?\s*/gi, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 36);
  return s || 'loja';
}

function bknLoja(loja) {
  const n = String(loja?.bk_number || '').replace(/\D/g, '');
  return n || `id${loja?.id_loja || 0}`;
}

function logsRoot() {
  return path.join(kitRoot(), 'Logs');
}

function dirLojas() {
  return path.join(logsRoot(), 'lojas');
}

function arquivoLogLoja(loja) {
  const ym = agoraBR().slice(0, 7);
  return path.join(dirLojas(), `${bknLoja(loja)}-${slugNome(loja?.name)}-${ym}.log`);
}

function appendLinha(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${line}\n`, 'utf8');
}

function garantirCabecalhoLoja(loja) {
  const file = arquivoLogLoja(loja);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  const linhas = [
    `# Meridian BK Office — log exclusivo desta loja`,
    `# BKN ${bknLoja(loja)}  |  ${loja?.name || '?'}  |  id_loja=${loja?.id_loja ?? '?'}`,
    `# ${agoraBR()}  arquivo do mes ${agoraBR().slice(0, 7)}  (outras lojas nao entram aqui)`,
    `# niveis: INFO  OK  ERRO`,
    '',
  ];
  appendLinha(file, linhas.join('\n'));
}

function linhaLog(nivel, msg) {
  return `${agoraBR()}  ${String(nivel).padEnd(4)}  ${msg}`;
}

/** Ciclo de vida do worker (boot, rodízio, fatal). Sem detalhe de venda. */
function logServico(msg) {
  const line = linhaLog('INFO', msg);
  try {
    appendLinha(path.join(logsRoot(), '_servico.log'), line);
  } catch {
    /* ignore */
  }
  try {
    console.log(line);
  } catch {
    /* ignore */
  }
}

/** Tudo que aconteceu nesta loja — só o arquivo dela. */
function logLoja(loja, nivel, msg) {
  const line = linhaLog(nivel, msg);
  try {
    garantirCabecalhoLoja(loja);
    appendLinha(arquivoLogLoja(loja), line);
  } catch {
    /* ignore */
  }
  try {
    console.log(`${line}  [${bknLoja(loja)}]`);
  } catch {
    /* ignore */
  }
}

const statusPath = () => path.join(kitRoot(), 'data', 'status.json');
const statusTxtPath = () => path.join(kitRoot(), 'data', 'STATUS.txt');

function fmtBrl(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function writeStatus(patch, lojaAtual = null) {
  const root = kitRoot();
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(statusPath(), 'utf8'));
  } catch {
    /* ignore */
  }
  const next = {
    ...prev,
    ...patch,
    atualizado_em: new Date().toISOString(),
  };
  if (lojaAtual && patch.ultimo_sync) {
    next.por_loja = { ...(prev.por_loja || {}), ...(next.por_loja || {}) };
    const u = patch.ultimo_sync;
    next.por_loja[String(lojaAtual.id_loja)] = {
      id_loja: lojaAtual.id_loja,
      nome: lojaAtual.name,
      bk_number: lojaAtual.bk_number,
      ok: !!u.ok,
      dia: u.dia || null,
      linhas: u.linhas ?? null,
      venda_total: u.venda_total ?? null,
      erro: u.ok ? null : u.erro || null,
      duracao_s: u.duracao_s ?? null,
      em: new Date().toISOString(),
    };
  }
  fs.writeFileSync(statusPath(), JSON.stringify(next, null, 2), 'utf8');

  const ranking = Object.values(next.por_loja || {}).sort((a, b) =>
    String(a.bk_number || '').localeCompare(String(b.bk_number || ''), 'pt-BR', { numeric: true }),
  );
  const linhasLoja = ranking.length
    ? ranking.map((r) => {
        const res = r.ok
          ? `OK   ${r.linhas ?? '?'} prod   R$ ${fmtBrl(r.venda_total)}   ${r.duracao_s ?? '?'}s`
          : `ERRO ${r.erro || 'falha'}`;
        const nome = String(r.nome || '')
          .replace(/BURGER KING\s*-?\s*/i, '')
          .slice(0, 28)
          .padEnd(28);
        return `${String(r.bk_number || r.id_loja).padEnd(6)}  ${nome}  ${String(r.dia || '—').padEnd(10)}  ${res}`;
      })
    : ['(nenhum sync ainda)'];

  const ult = next.ultimo_sync || {};
  const linhas = [
    '=== MERIDIAN BK OFFICE — STATUS POR LOJA ===',
    `Atualizado: ${agoraBR()}`,
    `Estado: ${next.estado || '?'}   ciclo #${next.ciclo ?? '?'}   lojas no rodizio: ${next.lojas_total ?? '?'}`,
    `Agora: BKN ${next.bk_number ?? '—'}  ${next.loja_nome || next.loja || '—'}`,
    '',
    'BKN     Loja                          Dia         Ultimo resultado',
    '------  ----------------------------  ----------  ----------------',
    ...linhasLoja,
    '',
    '--- Ultimo envio (loja da vez) ---',
    ult.ok
      ? `OK ${ult.dia} — ${ult.linhas ?? '?'} produtos, R$ ${fmtBrl(ult.venda_total)} (${ult.duracao_s ?? '?'}s)`
      : ult.dia
        ? `FALHOU ${ult.dia} — ${ult.erro || 'erro desconhecido'}`
        : '(nenhum envio ainda)',
    next.proximo_ciclo ? `Proximo ciclo: ${next.proximo_ciclo}` : '',
    '',
    'Logs separados: Logs\\lojas\\<BKN>-<loja>-AAAA-MM.log',
    'Servico (boot/rodizio): Logs\\_servico.log',
  ].filter((x) => x !== '');
  fs.writeFileSync(statusTxtPath(), linhas.join('\n'), 'utf8');
}

function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function syncedPath(idLoja) {
  return path.join(kitRoot(), 'data', `synced-days-${idLoja}.json`);
}

function loadSynced(idLoja) {
  try {
    const p = syncedPath(idLoja);
    if (!fs.existsSync(p)) {
      const legacy = path.join(kitRoot(), 'data', 'synced-days.json');
      if (Number(idLoja) === 21 && fs.existsSync(legacy)) {
        const j = JSON.parse(fs.readFileSync(legacy, 'utf8'));
        return { dias: Array.isArray(j.dias) ? j.dias.map(String) : [], novo: false };
      }
      return { dias: [], novo: true };
    }
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { dias: Array.isArray(j.dias) ? j.dias.map(String) : [], novo: false };
  } catch {
    return { dias: [], novo: true };
  }
}

function saveSynced(idLoja, state) {
  const dir = path.join(kitRoot(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const uniq = [...new Set(state.dias)].sort();
  fs.writeFileSync(
    syncedPath(idLoja),
    JSON.stringify({ dias: uniq, atualizado_em: new Date().toISOString() }, null, 2),
  );
}

function markSynced(idLoja, dia) {
  const state = loadSynced(idLoja);
  if (!state.dias.includes(dia)) state.dias.push(dia);
  saveSynced(idLoja, state);
}

function rrPath() {
  return path.join(kitRoot(), 'data', 'bkoffice-rr-index.json');
}

function loadRrIndex() {
  try {
    return Number(JSON.parse(fs.readFileSync(rrPath(), 'utf8')).index) || 0;
  } catch {
    return 0;
  }
}

function saveRrIndex(index) {
  try {
    fs.mkdirSync(path.join(kitRoot(), 'data'), { recursive: true });
    fs.writeFileSync(rrPath(), JSON.stringify({ index, em: new Date().toISOString() }), 'utf8');
  } catch {
    /* ignore */
  }
}

function findNode(root) {
  const bundled = path.join(root, 'runtime', 'node', 'node.exe');
  if (fs.existsSync(bundled)) return bundled;
  return 'node';
}

/** Chromium do kit — nunca o chrome.exe do usuário. */
function chromiumDoKit(root) {
  const base = path.join(root, 'runtime', 'ms-playwright');
  if (!fs.existsSync(base)) return null;
  let dirs = [];
  try {
    dirs = fs.readdirSync(base);
  } catch {
    return null;
  }
  for (const dir of dirs) {
    for (const rel of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe']) {
      const exe = path.join(base, dir, rel);
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

async function fetchLojasSync(env) {
  const apiBase = String(env.API_BASE || '').replace(/\/$/, '');
  const token = env.BKOFFICE_KIT_TOKEN;
  const idsEnv = String(env.BKOFFICE_SYNC_ID_LOJAS || '').trim() || 'all';
  const q =
    idsEnv === 'all' || idsEnv === '*'
      ? 'all'
      : idsEnv
        ? idsEnv
        : String(env.BKOFFICE_SYNC_ID_LOJA || '21');
  const url = `${apiBase}/public/kit/estoque/lojas-sync?ids=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'X-Meridian-Kit-Token': token } });
  if (!res.ok) {
    throw new Error(`lojas-sync HTTP ${res.status}`);
  }
  const body = await res.json();
  const lojas = Array.isArray(body.lojas) ? body.lojas : [];
  if (!lojas.length) throw new Error('API retornou zero lojas para sync');
  return lojas;
}

function parseSyncOutput(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const ln of lines) {
    if (ln.startsWith('KIT_RESULT:')) {
      try {
        return JSON.parse(ln.slice('KIT_RESULT:'.length));
      } catch {
        /* ignore */
      }
    }
  }
  const errLine = lines.find((l) => /=== ERRO|ETIMEDOUT|ECONNREFUSED|FATAL/i.test(l));
  if (errLine) return { ok: false, erro: errLine.replace(/^\[bkoffice\]\s*/, '').trim() };
  if (text.includes('=== OK ===')) return { ok: true, linhas: '?', gravado_no_banco: true };
  return { ok: false, erro: lines.slice(-3).join(' | ') || 'falha sem detalhe' };
}

function runSync(env, loja, ini, fim) {
  const idLoja = loja.id_loja;
  const termoLoja = loja.bk_number || null;
  const root = kitRoot();
  const node = findNode(root);
  const script = path.join(root, 'app', 'backend', 'scripts', 'sync-bkoffice-via-api.mjs');
  if (!fs.existsSync(script)) {
    throw new Error(`Script ausente: ${script}`);
  }
  const chromium = chromiumDoKit(root);
  const childEnv = {
    ...process.env,
    ...env,
    PATH: `${path.join(root, 'runtime', 'node')}${path.delimiter}${process.env.PATH || ''}`,
    PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'runtime', 'ms-playwright'),
    BKOFFICE_USE_CHROME: '0',
    BKOFFICE_HEADLESS: env.BKOFFICE_HEADLESS || '1',
    BKOFFICE_KIT_QUIET: '1',
    BKOFFICE_DOWNLOAD_TIMEOUT_MS: env.BKOFFICE_DOWNLOAD_TIMEOUT_MS || '180000',
    BKOFFICE_SERVER_SYNC: '0',
    BKOFFICE_SYNC_CRON_MS: '0',
    NODE_ENV: 'production',
    DB_HOST: '',
    DB_PASS: '',
  };
  if (chromium) {
    childEnv.BKOFFICE_CHROMIUM_PATH = chromium;
    childEnv.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chromium;
  }
  const timeoutMs = Math.max(360000, Number(env.BKOFFICE_DOWNLOAD_TIMEOUT_MS || 180000) * 3 + 120000);
  logLoja(loja, 'INFO', `dia=${ini}  baixando Excel BK Office  timeout=${Math.round(timeoutMs / 1000)}s`);
  writeStatus({ estado: 'sincronizando', loja: idLoja, ultimo_sync: { dia: ini, ok: null } }, loja);
  const t0 = Date.now();
  const args = [script, `--loja=${idLoja}`, `--inicio=${ini}`, `--fim=${fim}`, '--quiet'];
  if (termoLoja) args.push(`--termo=${termoLoja}`);
  return new Promise((resolve) => {
    const proc = spawn(node, args, {
      cwd: path.join(root, 'app'),
      env: childEnv,
      windowsHide: true,
    });
    let out = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try {
        proc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }, timeoutMs);
    proc.stdout.on('data', (b) => {
      out += b.toString();
    });
    proc.stderr.on('data', (b) => {
      out += b.toString();
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const elapsed = Math.round((Date.now() - t0) / 1000);
      const parsed = parseSyncOutput(out);
      parsed.duracao_s = elapsed;
      parsed.dia = parsed.dia || ini;
      parsed.loja = idLoja;
      if (killed) {
        parsed.ok = false;
        parsed.erro = `timeout apos ${Math.round(timeoutMs / 1000)}s`;
        logLoja(loja, 'ERRO', `dia=${ini}  ${parsed.erro}  duracao=${elapsed}s`);
      } else if (code === 0 && parsed.ok !== false) {
        parsed.ok = true;
        logLoja(
          loja,
          'OK',
          `dia=${ini}  produtos=${parsed.linhas ?? '?'}  venda=R$ ${fmtBrl(parsed.venda_total)}  duracao=${elapsed}s`,
        );
      } else {
        parsed.ok = false;
        parsed.erro = parsed.erro || `exit ${code}`;
        logLoja(loja, 'ERRO', `dia=${ini}  ${parsed.erro}  duracao=${elapsed}s`);
        const trecho = out.trim().split(/\r?\n/).slice(-12).join('\n');
        if (trecho) {
          try {
            appendLinha(arquivoLogLoja(loja), `          ---- saida do sync ----\n${trecho}\n          -------------------`);
          } catch {
            /* ignore */
          }
        }
      }
      resolve(parsed);
    });
  });
}

async function syncIncremental(env, loja, { forceBackfill = false } = {}) {
  const idLoja = loja.id_loja;
  const hoje = hojeBR();
  const iniMes = `${hoje.slice(0, 8)}01`;
  const state = loadSynced(idLoja);
  const pendentes = [];
  if (state.novo && !forceBackfill) {
    logLoja(loja, 'INFO', `primeiro sync desta loja — so o dia de hoje (${hoje}), sem backfill do mes`);
  } else {
    for (let d = iniMes; d < hoje; d = addDays(d, 1)) {
      if (!state.dias.includes(d)) pendentes.push(d);
    }
  }

  writeStatus(
    {
      estado: 'sincronizando',
      loja: idLoja,
      loja_nome: loja.name,
      bk_number: loja.bk_number,
      dias_ok: state.dias.filter((d) => d >= iniMes && d <= hoje),
      pendentes,
    },
    loja,
  );

  if (pendentes.length) {
    logLoja(loja, 'INFO', `faltam ${pendentes.length} dia(s) do mes: ${pendentes.join(', ')}`);
    for (const d of pendentes) {
      const r = await runSync(env, loja, d, d);
      writeStatus({ ultimo_sync: r }, loja);
      if (r.ok) markSynced(idLoja, d);
      else return false;
    }
  } else if (!state.novo) {
    logLoja(loja, 'INFO', `mes OK ate ontem — atualiza so hoje (${hoje})`);
  }

  const rHoje = await runSync(env, loja, hoje, hoje);
  writeStatus({ ultimo_sync: rHoje }, loja);
  if (rHoje.ok) markSynced(idLoja, hoje);
  return rHoje.ok;
}

async function main() {
  const root = kitRoot();
  fs.mkdirSync(dirLojas(), { recursive: true });
  logServico(`iniciando pid=${process.pid} pasta=${root}`);

  let keyParts;
  try {
    const mod = await import('./key_parts.generated.mjs');
    keyParts = mod.KEY_PARTS;
  } catch (e) {
    logServico(`ERRO: chave do cofre ausente (${e.message})`);
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message } });
    process.exit(1);
  }

  let secrets;
  try {
    secrets = loadVault(root, keyParts);
  } catch (e) {
    logServico(`ERRO ao abrir cofre: ${e.message}`);
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message } });
    process.exit(1);
  }

  if (!secrets.BKOFFICE_SYNC_ID_LOJAS) secrets.BKOFFICE_SYNC_ID_LOJAS = 'all';

  const intervalMs = Math.max(60000, Number(secrets.SYNC_INTERVAL_MS || 90000));
  const intervalSec = Math.round(intervalMs / 1000);

  if (!secrets.BKOFFICE_USER || !secrets.BKOFFICE_PASS || !secrets.API_BASE || !secrets.BKOFFICE_KIT_TOKEN) {
    logServico('ERRO: cofre incompleto');
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: 'cofre incompleto' } });
    process.exit(1);
  }

  let lojas;
  try {
    lojas = await fetchLojasSync(secrets);
    logServico(`rodizio ${lojas.length} loja(s)`);
    for (const l of lojas) {
      garantirCabecalhoLoja(l);
      logLoja(l, 'INFO', `entrou no rodizio  arquivo=${path.basename(arquivoLogLoja(l))}`);
    }
    const idx = path.join(dirLojas(), '_indice.txt');
    const idxLinhas = [
      `Meridian BK Office — indice de logs  ${agoraBR()}`,
      `Total: ${lojas.length} lojas  (um arquivo por loja, por mes)`,
      '',
      ...lojas.map((l) => `${bknLoja(l).padEnd(6)}  id=${String(l.id_loja).padEnd(3)}  ${l.name}`),
      '',
      'Pasta: Logs\\lojas\\',
    ];
    fs.writeFileSync(idx, `${idxLinhas.join('\n')}\n`, 'utf8');
  } catch (e) {
    logServico(`ERRO ao listar lojas: ${e.message}`);
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message } });
    process.exit(1);
  }

  const once = process.argv.includes('--once') || process.argv.includes('--uma-vez');
  const forceBackfill = process.argv.includes('--backfill') || secrets.BKOFFICE_FORCE_BACKFILL === '1';
  let rrIndex = loadRrIndex();

  logServico(`ativo multi-loja intervalo=${intervalSec}s lojas=${lojas.length}`);

  let ciclo = 0;
  let syncRodando = false;
  for (;;) {
    ciclo += 1;
    const loja = lojas[rrIndex % lojas.length];
    rrIndex = (rrIndex + 1) % lojas.length;
    saveRrIndex(rrIndex);

    writeStatus({
      estado: 'rodando',
      ciclo,
      loja: loja.id_loja,
      loja_nome: loja.name,
      bk_number: loja.bk_number,
      lojas_total: lojas.length,
    });
    logServico(`ciclo #${ciclo} → BKN ${bknLoja(loja)} ${loja.name} (${((rrIndex === 0 ? lojas.length : rrIndex))}/${lojas.length})`);
    logLoja(loja, 'INFO', `inicio ciclo #${ciclo}`);

    let ok = false;
    if (syncRodando) {
      logServico(`ciclo #${ciclo} pulado — sync anterior ainda rodando`);
      logLoja(loja, 'ERRO', `ciclo #${ciclo} pulado — sync anterior ainda rodando`);
    } else {
      syncRodando = true;
      try {
        const hoje = hojeBR();
        if (once) {
          logLoja(loja, 'INFO', 'modo teste — so hoje nesta loja');
          const r = await runSync(secrets, loja, hoje, hoje);
          writeStatus({ ultimo_sync: r, estado: r.ok ? 'parado' : 'erro' }, loja);
          if (r.ok) markSynced(loja.id_loja, hoje);
          logServico(r.ok ? 'TESTE OK' : 'TESTE FALHOU');
          process.exit(r.ok ? 0 : 1);
        }
        if (forceBackfill && ciclo === 1) {
          logLoja(loja, 'INFO', 'backfill forcado 01→hoje');
          const ini = `${hoje.slice(0, 8)}01`;
          for (let d = ini; d <= hoje; d = addDays(d, 1)) {
            const r = await runSync(secrets, loja, d, d);
            writeStatus({ ultimo_sync: r }, loja);
            if (r.ok) markSynced(loja.id_loja, d);
            else {
              ok = false;
              break;
            }
            ok = true;
          }
        } else {
          ok = await syncIncremental(secrets, loja, { forceBackfill });
        }
        if (rrIndex === 0) {
          try {
            lojas = await fetchLojasSync(secrets);
            logServico(`lista atualizada: ${lojas.length} loja(s)`);
          } catch (e) {
            logServico(`aviso: nao atualizou lista de lojas (${e.message})`);
          }
        }
      } catch (e) {
        logLoja(loja, 'ERRO', e.message || String(e));
        logServico(`ERRO BKN ${bknLoja(loja)}: ${e.message || e}`);
        writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message || String(e) } }, loja);
        if (once) process.exit(1);
      } finally {
        syncRodando = false;
      }
    }

    if (once) break;

    const proximo = new Date(Date.now() + intervalMs);
    const proximoFmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(proximo);

    const st = loadSynced(loja.id_loja);
    writeStatus({
      estado: ok ? 'dormindo' : 'erro',
      ciclo,
      loja: loja.id_loja,
      loja_nome: loja.name,
      bk_number: loja.bk_number,
      lojas_total: lojas.length,
      dias_ok: st.dias,
      pendentes: [],
      proximo_ciclo: proximoFmt,
    });
    logLoja(
      loja,
      ok ? 'OK' : 'ERRO',
      `fim ciclo #${ciclo}  proximo_rodizio_em=${intervalSec}s`,
    );
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  logServico(`FATAL ${e.message || e}`);
  writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message || String(e) } });
  process.exit(1);
});
