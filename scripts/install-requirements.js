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

function npmInstall(cwd) {
  const hasLock = fs.existsSync(path.join(cwd, 'package-lock.json'));
  const args = hasLock ? ['ci', '--no-audit', '--no-fund'] : ['install', '--no-audit', '--no-fund'];
  const r = spawnSync('npm', args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`[requirements] Falha em npm ${args.join(' ')} — ${cwd}`);
    process.exit(r.status || 1);
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
