/**
 * Aplica todas as migrations em ordem (002…035).
 * Use após `npm run migrate` (001) ou com --reset para rodar desde o 001 (APAGA TUDO).
 *
 * Uso:
 *   node scripts/migrate-full.js           # pula 001 (já aplicado)
 *   node scripts/migrate-full.js --reset # inclui 001 — destrutivo
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.join(backendRoot, '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(backendRoot, '.env'), override: false });

const reset = process.argv.includes('--reset');
const migrationsDir = path.join(backendRoot, 'migrations');
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const toRun = reset ? files : files.filter((f) => f !== '001_schema.sql');

if (!toRun.length) {
  console.error('Nenhuma migration encontrada.');
  process.exit(1);
}

console.log(`[migrate-full] Banco: ${process.env.DB_NAME} @ ${process.env.DB_HOST}`);
if (reset) {
  console.warn('[migrate-full] AVISO: --reset inclui 001_schema.sql (apaga tabelas base).');
}

for (const file of toRun) {
  console.log(`\n[migrate-full] → ${file}`);
  const r = spawnSync('node', ['scripts/run-sql.js', `migrations/${file}`], {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`\n[migrate-full] Falhou em ${file}`);
    process.exit(r.status || 1);
  }
}

console.log('\n[migrate-full] Concluído. Rode: npm run seed:auth');
