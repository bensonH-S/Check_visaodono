/**
 * Worker BK Office — cofre criptografado + sync via HTTPS.
 * NÃO reimporta o mês inteiro a cada boot: só o dia de hoje
 * (e dias que faltarem no marcador local data/synced-days.json).
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

function log(msg) {
  const line = `[bk-kit] ${agoraBR()} ${msg}`;
  const roots = [
    path.join(kitRoot(), 'Logs'),
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'MeridianBkOffice', 'Logs'),
  ];
  for (const d of roots) {
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.appendFileSync(path.join(d, 'bkoffice-python-service.log'), `${line}\n`, 'utf8');
    } catch {
      /* ignore */
    }
  }
  try {
    console.log(line);
  } catch {
    /* ignore */
  }
}

const statusPath = () => path.join(kitRoot(), 'data', 'status.json');
const statusTxtPath = () => path.join(kitRoot(), 'data', 'STATUS.txt');

function writeStatus(patch) {
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
  fs.writeFileSync(statusPath(), JSON.stringify(next, null, 2), 'utf8');

  const ult = next.ultimo_sync || {};
  const linhas = [
    '=== MERIDIAN BK OFFICE — STATUS ===',
    `Atualizado: ${agoraBR()}`,
    `Estado: ${next.estado || '?'}`,
    `Loja: ${next.loja ?? '?'}`,
    `Ciclo: #${next.ciclo ?? '?'}`,
    '',
    '--- Ultimo envio ---',
    ult.ok
      ? `OK ${ult.dia} — ${ult.linhas ?? '?'} produtos, R$ ${ult.venda_total ?? '?'} no Meridian (${ult.duracao_s ?? '?'}s)`
      : ult.dia
        ? `FALHOU ${ult.dia} — ${ult.erro || 'erro desconhecido'}`
        : '(nenhum envio ainda)',
    '',
    '--- Mes atual ---',
    `Dias OK: ${(next.dias_ok || []).length}`,
    next.pendentes?.length ? `Pendentes: ${next.pendentes.join(', ')}` : 'Pendentes: nenhum',
    next.proximo_ciclo ? `Proximo ciclo: ${next.proximo_ciclo}` : '',
    '',
    'Abra VERIFICAR.bat para mais detalhes.',
  ].filter(Boolean);
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
      // migração: arquivo antigo global só vale p/ loja 21
      const legacy = path.join(kitRoot(), 'data', 'synced-days.json');
      if (Number(idLoja) === 21 && fs.existsSync(legacy)) {
        const j = JSON.parse(fs.readFileSync(legacy, 'utf8'));
        return { dias: Array.isArray(j.dias) ? j.dias.map(String) : [] };
      }
      return { dias: [] };
    }
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { dias: Array.isArray(j.dias) ? j.dias.map(String) : [] };
  } catch {
    return { dias: [] };
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

function runSync(env, idLoja, ini, fim, termoLoja = null) {
  const root = kitRoot();
  const node = findNode(root);
  const script = path.join(root, 'app', 'backend', 'scripts', 'sync-bkoffice-via-api.mjs');
  if (!fs.existsSync(script)) {
    throw new Error(`Script ausente: ${script}`);
  }
  const childEnv = {
    ...process.env,
    ...env,
    PATH: `${path.join(root, 'runtime', 'node')}${path.delimiter}${process.env.PATH || ''}`,
    PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'runtime', 'ms-playwright'),
    BKOFFICE_USE_CHROME: env.BKOFFICE_USE_CHROME || '1',
    BKOFFICE_HEADLESS: env.BKOFFICE_HEADLESS || '1',
    BKOFFICE_KIT_QUIET: '1',
    BKOFFICE_DOWNLOAD_TIMEOUT_MS: env.BKOFFICE_DOWNLOAD_TIMEOUT_MS || '180000',
    BKOFFICE_SERVER_SYNC: '0',
    BKOFFICE_SYNC_CRON_MS: '0',
    NODE_ENV: 'production',
    DB_HOST: '',
    DB_PASS: '',
  };
  const timeoutMs = Math.max(360000, Number(env.BKOFFICE_DOWNLOAD_TIMEOUT_MS || 180000) * 3 + 120000);
  log(`sync loja=${idLoja} ${ini} — baixando Excel BK Office (timeout ${Math.round(timeoutMs / 1000)}s)...`);
  writeStatus({ estado: 'sincronizando', loja: idLoja, ultimo_sync: { dia: ini, ok: null } });
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
        log(`FALHOU loja=${idLoja} ${ini} — ${parsed.erro}`);
      } else if (code === 0 && parsed.ok !== false) {
        parsed.ok = true;
        const venda = parsed.venda_total != null ? ` R$ ${parsed.venda_total}` : '';
        log(`OK loja=${idLoja} ${ini} — ${parsed.linhas ?? '?'} produtos${venda} (${elapsed}s)`);
      } else {
        parsed.ok = false;
        parsed.erro = parsed.erro || `exit ${code}`;
        log(`FALHOU loja=${idLoja} ${ini} — ${parsed.erro} (${elapsed}s)`);
      }
      resolve(parsed);
    });
  });
}

async function syncIncremental(env, loja) {
  const idLoja = loja.id_loja;
  const termo = loja.bk_number || null;
  const hoje = hojeBR();
  const iniMes = `${hoje.slice(0, 8)}01`;
  const state = loadSynced(idLoja);
  const pendentes = [];
  for (let d = iniMes; d < hoje; d = addDays(d, 1)) {
    if (!state.dias.includes(d)) pendentes.push(d);
  }

  writeStatus({
    estado: 'sincronizando',
    loja: idLoja,
    loja_nome: loja.name,
    bk_number: loja.bk_number,
    dias_ok: state.dias.filter((d) => d >= iniMes && d <= hoje),
    pendentes,
  });

  if (pendentes.length) {
    log(`loja=${idLoja} faltam ${pendentes.length} dia(s): ${pendentes.join(', ')}`);
    for (const d of pendentes) {
      const r = await runSync(env, idLoja, d, d, termo);
      writeStatus({ ultimo_sync: r });
      if (r.ok) markSynced(idLoja, d);
      else return false;
    }
  } else {
    log(`loja=${idLoja} mes OK ate ontem — so atualiza hoje (${hoje})`);
  }

  const rHoje = await runSync(env, idLoja, hoje, hoje, termo);
  writeStatus({ ultimo_sync: rHoje });
  if (rHoje.ok) markSynced(idLoja, hoje);
  return rHoje.ok;
}

async function main() {
  const root = kitRoot();
  log(`iniciando pid=${process.pid} pasta=${root}`);

  let keyParts;
  try {
    const mod = await import('./key_parts.generated.mjs');
    keyParts = mod.KEY_PARTS;
  } catch (e) {
    log(`ERRO: chave do cofre ausente (${e.message})`);
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message } });
    process.exit(1);
  }

  let secrets;
  try {
    secrets = loadVault(root, keyParts);
  } catch (e) {
    log(`ERRO ao abrir cofre: ${e.message}`);
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message } });
    process.exit(1);
  }

  if (!secrets.BKOFFICE_SYNC_ID_LOJAS) secrets.BKOFFICE_SYNC_ID_LOJAS = 'all';

  const intervalMs = Math.max(60000, Number(secrets.SYNC_INTERVAL_MS || 90000));
  const intervalSec = Math.round(intervalMs / 1000);

  if (!secrets.BKOFFICE_USER || !secrets.BKOFFICE_PASS || !secrets.API_BASE || !secrets.BKOFFICE_KIT_TOKEN) {
    log('ERRO: cofre incompleto');
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: 'cofre incompleto' } });
    process.exit(1);
  }

  let lojas;
  try {
    lojas = await fetchLojasSync(secrets);
    log(`rodizio ${lojas.length} loja(s): ${lojas.map((l) => l.bk_number || l.id_loja).join(', ')}`);
  } catch (e) {
    log(`ERRO ao listar lojas: ${e.message}`);
    writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message } });
    process.exit(1);
  }

  const once = process.argv.includes('--once') || process.argv.includes('--uma-vez');
  const forceBackfill = process.argv.includes('--backfill') || secrets.BKOFFICE_FORCE_BACKFILL === '1';
  let rrIndex = loadRrIndex();

  log(`ativo multi-loja intervalo=${intervalSec}s`);

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
    log(`ciclo #${ciclo} loja=${loja.id_loja} ${loja.bk_number} ${loja.name}`);

    let ok = false;
    if (syncRodando) {
      log(`ciclo #${ciclo} pulado — sync anterior ainda rodando`);
    } else {
      syncRodando = true;
      try {
        const hoje = hojeBR();
        if (once) {
          log('modo teste — so hoje nesta loja');
          const r = await runSync(secrets, loja.id_loja, hoje, hoje, loja.bk_number);
          writeStatus({ ultimo_sync: r, estado: r.ok ? 'parado' : 'erro' });
          if (r.ok) markSynced(loja.id_loja, hoje);
          log(r.ok ? 'TESTE OK' : 'TESTE FALHOU');
          process.exit(r.ok ? 0 : 1);
        }
        if (forceBackfill && ciclo === 1) {
          log('AVISO: backfill forcado 01→hoje nesta loja');
          const ini = `${hoje.slice(0, 8)}01`;
          for (let d = ini; d <= hoje; d = addDays(d, 1)) {
            const r = await runSync(secrets, loja.id_loja, d, d, loja.bk_number);
            writeStatus({ ultimo_sync: r });
            if (r.ok) markSynced(loja.id_loja, d);
            else {
              ok = false;
              break;
            }
            ok = true;
          }
        } else {
          ok = await syncIncremental(secrets, loja);
        }
        // refresh lista a cada volta completa
        if (rrIndex === 0) {
          try {
            lojas = await fetchLojasSync(secrets);
          } catch (e) {
            log(`aviso: nao atualizou lista de lojas (${e.message})`);
          }
        }
      } catch (e) {
        log(`ERRO ${e.message || e}`);
        writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message || String(e) } });
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
    log(
      ok
        ? `ciclo #${ciclo} OK — proximo em ${intervalSec}s (${proximoFmt})`
        : `ciclo #${ciclo} com falha — tenta de novo em ${intervalSec}s`,
    );
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  log(`FATAL ${e.message || e}`);
  writeStatus({ estado: 'erro', ultimo_sync: { ok: false, erro: e.message || String(e) } });
  process.exit(1);
});
