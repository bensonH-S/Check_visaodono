/**
 * Garante node_modules na raiz e no frontend antes do npm run dev.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function pacoteInstalado(nmDir, nome) {
  if (nome.startsWith('@')) {
    const [escopo, pkg] = nome.split('/');
    return fs.existsSync(path.join(nmDir, escopo, pkg));
  }
  return fs.existsSync(path.join(nmDir, nome));
}

function depsFaltando(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(nm)) return ['node_modules'];

  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  return Object.keys(deps).filter((nome) => !pacoteInstalado(nm, nome));
}

function precisaInstall(dir) {
  const pkg = path.join(dir, 'package.json');
  if (!fs.existsSync(pkg)) return false;
  const faltando = depsFaltando(dir);
  if (faltando.includes('node_modules')) return true;
  if (faltando.length > 0) {
    console.log(`[ensure-deps] Pacotes ausentes em ${path.basename(dir)}: ${faltando.join(', ')}`);
    return true;
  }
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
