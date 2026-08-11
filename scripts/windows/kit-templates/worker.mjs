/**
 * Worker BK Office — lê cofre criptografado (sem config.env).
 * Embarcado no MeridianBkSync.exe via pkg, ou rodado com node do kit.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { loadVault } from './vault_tools.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function kitRoot() {
  // pkg: process.pkg / snapshot; senão pasta do kit
  if (process.pkg) return path.dirname(process.execPath);
  return path.resolve(__dirname);
}

function log(msg) {
  const line = `[bk-kit] ${new Date().toISOString()} ${msg}`;
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

function dataInicio(env) {
  const fixo = String(env.BKOFFICE_SYNC_DATA_INICIO || '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fixo)) return fixo;
  return `${hojeBR().slice(0, 8)}01`;
}

function findNode(root) {
  const bundled = path.join(root, 'runtime', 'node', 'node.exe');
  if (fs.existsSync(bundled)) return bundled;
  return 'node';
}

function runSync(env, idLoja, ini, fim) {
  const root = kitRoot();
  const node = findNode(root);
  const script = path.join(root, 'app', 'backend', 'scripts', 'sync-bkoffice-vendas.mjs');
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
    BKOFFICE_SERVER_SYNC: '0',
    BKOFFICE_SYNC_CRON_MS: '0',
    NODE_ENV: 'production',
  };
  // Nunca grava .env em disco — só env do processo filho
  log(`sync start loja=${idLoja} periodo=${ini}→${fim}`);
  const t0 = Date.now();
  return new Promise((resolve) => {
    const proc = spawn(
      node,
      [script, `--loja=${idLoja}`, '--db=prod', `--inicio=${ini}`, `--fim=${fim}`],
      {
        cwd: path.join(root, 'app'),
        env: childEnv,
        windowsHide: true,
      },
    );
    let out = '';
    let err = '';
    proc.stdout.on('data', (b) => {
      out += b.toString();
    });
    proc.stderr.on('data', (b) => {
      err += b.toString();
    });
    proc.on('close', (code) => {
      const elapsed = Math.round((Date.now() - t0) / 1000);
      const tail = (out + '\n' + err)
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-40);
      for (const ln of tail) log(`out ${ln}`);
      if (code === 0) log(`sync OK em ${elapsed}s (${ini}→${fim})`);
      else log(`sync FALHOU exit=${code} em ${elapsed}s (${ini}→${fim})`);
      resolve(code === 0);
    });
  });
}

async function backfill(env, idLoja) {
  const ini = dataInicio(env);
  const fim = hojeBR();
  log(`backfill ${ini} → ${fim}`);
  let ok = true;
  for (let d = ini; d <= fim; d = addDays(d, 1)) {
    const r = await runSync(env, idLoja, d, d);
    if (!r) ok = false;
  }
  return ok;
}

async function main() {
  const root = kitRoot();
  log(`boot pid=${process.pid} root=${root} exe=${process.execPath}`);

  let keyParts;
  try {
    const mod = await import('./key_parts.generated.mjs');
    keyParts = mod.KEY_PARTS;
  } catch (e) {
    log(`ERRO: chave do cofre ausente (${e.message}). Regenere o kit com GERAR-KIT.`);
    process.exit(1);
  }

  let secrets;
  try {
    secrets = loadVault(root, keyParts);
  } catch (e) {
    log(`ERRO ao abrir cofre: ${e.message}`);
    process.exit(1);
  }

  // Sanidade: não logar host/senha
  const idLoja = Number(secrets.BKOFFICE_SYNC_ID_LOJA || 21);
  const intervalMs = Math.max(60000, Number(secrets.SYNC_INTERVAL_MS || 900000));
  const intervalSec = Math.round(intervalMs / 1000);
  log(
    `iniciado intervalo=${intervalSec}s loja=${idLoja} db=${secrets.DB_NAME || '(ok)'} modo=cofre-criptografado user=${secrets.BKOFFICE_USER ? '(ok)' : '(vazio)'}`,
  );
  if (!secrets.BKOFFICE_USER || !secrets.BKOFFICE_PASS || !secrets.DB_HOST) {
    log('ERRO: cofre incompleto');
    process.exit(1);
  }

  let backfillMes = null;
  let ciclo = 0;
  const once = process.argv.includes('--once') || process.argv.includes('--uma-vez');
  for (;;) {
    ciclo += 1;
    log(`ciclo #${ciclo} — acordando`);
    try {
      const hoje = hojeBR();
      const mes = hoje.slice(0, 7);
      if (once) {
        // Teste rápido: só hoje (não faz backfill do mês inteiro)
        log('modo --once: sync só do dia de hoje');
        const ok = await runSync(secrets, idLoja, hoje, hoje);
        log(ok ? 'TESTE OK' : 'TESTE FALHOU');
        process.exit(ok ? 0 : 1);
      }
      if (backfillMes !== mes) {
        if (await backfill(secrets, idLoja)) {
          backfillMes = mes;
          log(`backfill do mês ${mes} concluído`);
        } else {
          log('backfill parcial — tenta de novo no próximo ciclo');
        }
      } else {
        await runSync(secrets, idLoja, hoje, hoje);
      }
    } catch (e) {
      log(`ERRO ${e.message || e}`);
      if (once) process.exit(1);
    }
    log(`ciclo #${ciclo} — dormindo ${intervalSec}s`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  log(`FATAL ${e.message || e}`);
  process.exit(1);
});
