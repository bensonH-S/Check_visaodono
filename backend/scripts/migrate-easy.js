import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { spawn } from 'child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'migrations');
const runSql = path.join(root, 'scripts', 'run-sql.js');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function listMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d+_.*\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function numOf(name) {
  const m = name.match(/^(\d+)/);
  return m ? Number(m[1]) : NaN;
}

function resolveSelection(input, all, recent) {
  const raw = input.trim();
  if (!raw) return null;

  // Número da lista exibida (1..N)
  if (/^\d+$/.test(raw)) {
    const asIndex = Number(raw);
    if (asIndex >= 1 && asIndex <= recent.length) return [recent[asIndex - 1]];
    // Código da migration (ex: 88 ou 088)
    const hit = all.filter((f) => numOf(f) === asIndex);
    if (hit.length) return hit;
  }

  // Intervalo: 084-088 ou 84-88
  const range = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const hits = all.filter((f) => {
      const n = numOf(f);
      return n >= lo && n <= hi;
    });
    if (hits.length) return hits;
  }

  // Trecho do nome
  const q = raw.toLowerCase();
  const hits = all.filter((f) => f.toLowerCase().includes(q));
  if (hits.length) return hits;

  return null;
}

function runOne(file, db, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [runSql, `migrations/${file}`, `--db=${db}`, ...extraArgs],
      { cwd: root, stdio: 'inherit' },
    );
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Falhou: ${file} (exit ${code})`));
    });
  });
}

if (!process.stdin.isTTY) {
  console.error('Este comando é interativo. Use: npm run sql');
  process.exit(1);
}

const all = listMigrations();
const recent = all.slice(-20).reverse();

console.error('');
console.error('Migrations recentes (mais novas primeiro):');
recent.forEach((f, i) => console.error(`  ${String(i + 1).padStart(2)}) ${f}`));
console.error('');
console.error('Como escolher:');
console.error('  • número da lista (ex: 1)');
console.error('  • código (ex: 088)');
console.error('  • intervalo (ex: 084-088)');
console.error('  • trecho do nome (ex: estoque)');
console.error('');

const escolha = await ask('Migration(s): ');
const selected = resolveSelection(escolha, all, recent);

if (!selected?.length) {
  console.error('Nada encontrado. Cancelado.');
  process.exit(1);
}

console.error('');
console.error(`Selecionado (${selected.length}):`);
selected.forEach((f) => console.error(`  • ${f}`));
console.error('');
console.error('Qual banco?');
console.error('  1) desenvolvimento');
console.error('  2) produção');
console.error('  3) ambos');
console.error('');

const dbRaw = (await ask('Escolha [1/2/3]: ')).trim().toLowerCase();
let db = null;
if (dbRaw === '1' || dbRaw.startsWith('dev')) db = 'dev';
else if (dbRaw === '2' || dbRaw.startsWith('prod')) db = 'prod';
else if (dbRaw === '3' || dbRaw.startsWith('ambos') || dbRaw.startsWith('both')) db = 'both';

if (!db) {
  console.error('Opção inválida. Cancelado.');
  process.exit(1);
}

const extra = [];
if (db === 'prod' || db === 'both') {
  console.error('');
  console.error('⚠  Inclui PRODUÇÃO.');
  const conf = await ask('Digite PRODUCAO para continuar: ');
  if (conf.trim().toUpperCase() !== 'PRODUCAO') {
    console.error('Cancelado.');
    process.exit(1);
  }
  extra.push('--yes');
}

console.error('');
try {
  for (const file of selected) {
    await runOne(file, db, extra);
  }
  console.error('');
  console.error(`Pronto — ${selected.length} migration(s) em ${db}.`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
