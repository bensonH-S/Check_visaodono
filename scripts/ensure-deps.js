/**
 * Garante node_modules na raiz e no frontend antes do npm run dev.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function precisaInstall(dir) {
  const pkg = path.join(dir, 'package.json');
  if (!fs.existsSync(pkg)) return false;
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(nm)) return true;
  if (dir.endsWith('frontend') && !fs.existsSync(path.join(nm, 'vite'))) return true;
  if (dir === root && !fs.existsSync(path.join(nm, 'express'))) return true;
  return false;
}

const dirs = [root, path.join(root, 'frontend')].filter((d) => precisaInstall(d));
if (!dirs.length) process.exit(0);

console.log('[ensure-deps] Instalando dependências faltantes…');
const r = spawnSync('node', ['scripts/install-requirements.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(r.status || 0);
