/**
 * Regenera requirements.txt a partir dos package.json do projeto.
 * Rode após adicionar dependência: npm run requirements:sync
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const PACKAGES = [
  { section: 'Raiz (API server.js)', file: 'package.json' },
  { section: 'Backend (backend/)', file: 'backend/package.json' },
  { section: 'Frontend (frontend/)', file: 'frontend/package.json' },
];

function formatDeps(pkg, kind) {
  const deps = pkg[kind] || {};
  return Object.entries(deps)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => `${name}==${String(version).replace(/^\^|~/, '')}`);
}

const lines = [
  '# Vision Check — dependências npm (gerado por npm run requirements:sync)',
  '# Instalar no servidor: npm run install:requirements',
  '# Ou manualmente: npm ci && npm ci --prefix backend && npm ci --prefix frontend',
  '',
];

for (const { section, file } of PACKAGES) {
  const full = path.join(root, file);
  const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
  lines.push(`# --- ${section} ---`);
  for (const dep of formatDeps(pkg, 'dependencies')) lines.push(dep);
  const dev = formatDeps(pkg, 'devDependencies');
  if (dev.length) {
    lines.push('');
    lines.push(`# dev (${section})`);
    for (const d of dev) lines.push(`# ${d}`);
  }
  lines.push('');
}

const out = path.join(root, 'requirements.txt');
fs.writeFileSync(out, lines.join('\n').trimEnd() + '\n', 'utf8');
console.log(`[requirements] Gerado ${out}`);
