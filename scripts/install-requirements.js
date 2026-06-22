/**
 * Instala/atualiza dependências npm (raiz, backend e frontend).
 * Equivalente ao pip install -r requirements.txt — use antes de subir o servidor.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const WORKSPACES = [
  { label: 'raiz', dir: root },
  { label: 'backend', dir: path.join(root, 'backend') },
  { label: 'frontend', dir: path.join(root, 'frontend') },
];

function runNpm(cwd, args) {
  const r = spawnSync('npm', args, { cwd, stdio: 'inherit', shell: true });
  return r.status ?? 1;
}

function npmInstall(cwd) {
  const hasLock = fs.existsSync(path.join(cwd, 'package-lock.json'));
  if (!hasLock) {
    if (runNpm(cwd, ['install', '--no-audit', '--no-fund']) !== 0) {
      console.error(`[requirements] Falha em npm install — ${cwd}`);
      process.exit(1);
    }
    return;
  }

  const ciStatus = runNpm(cwd, ['ci', '--no-audit', '--no-fund']);
  if (ciStatus === 0) return;

  console.warn(`[requirements] package-lock desatualizado em ${cwd} — rodando npm install`);
  if (runNpm(cwd, ['install', '--no-audit', '--no-fund']) !== 0) {
    console.error(`[requirements] Falha em npm install — ${cwd}`);
    process.exit(1);
  }
}

console.log('[requirements] Sincronizando dependências npm…');
for (const ws of WORKSPACES) {
  if (!fs.existsSync(path.join(ws.dir, 'package.json'))) {
    console.warn(`[requirements] Ignorando ${ws.label} (sem package.json)`);
    continue;
  }
  console.log(`[requirements] → ${ws.label}`);
  npmInstall(ws.dir);
}
console.log('[requirements] OK');
