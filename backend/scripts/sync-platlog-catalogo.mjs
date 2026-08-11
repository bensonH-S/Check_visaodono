/**
 * Sync preços Platlog via catálogo Pedido eSupri + relatório casados/faltando.
 *
 *   node scripts/sync-platlog-catalogo.mjs --loja=21
 *   node scripts/sync-platlog-catalogo.mjs --loja=21 --aplicar --db=prod
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const repoRoot = path.join(backendRoot, '..');

dotenv.config({ path: path.join(repoRoot, '.env'), override: false });
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });

const args = process.argv.slice(2);
const get = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
const has = (k) => args.includes(k);

const idLoja = Number(get('--loja', '21'));
const aplicar = has('--aplicar');
const dbFlag = get('--db', 'dev');
if (dbFlag === 'dev') process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';
if (dbFlag === 'prod') process.env.DB_NAME = process.env.DB_NAME_PROD || 'vision_check';
// pool decide dev/prod por NODE_ENV — força leitura do DB_NAME em scripts
if (dbFlag === 'prod') process.env.NODE_ENV = 'production';

const { syncPrecosCatalogoPlatlog } = await import(
  '../src/services/platlog/syncPrecosCatalogoPlatlog.js'
);

console.log({ idLoja, aplicar, dbFlag, user: !!process.env.ESUPRI_USER });

const result = await syncPrecosCatalogoPlatlog({
  id_loja: idLoja,
  user: process.env.ESUPRI_USER,
  pass: process.env.ESUPRI_PASS,
  aplicar,
  headless: process.env.ESUPRI_HEADLESS !== '0',
});

const outDir = path.join(repoRoot, 'Logs', 'esupri-catalogo');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = path.join(outDir, `loja-${idLoja}-${stamp}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

console.log('\n=== RESUMO ===');
console.log({
  catalogo_esupri: result.catalogo_total,
  insumos_loja: result.insumos_total,
  casados: result.casados.length,
  faltando: result.faltando.length,
  atualizados: result.atualizados.length,
  sem_mudanca: result.sem_mudanca.length,
  erros: result.erros.length,
  esupri_sem_insumo: result.esupri_sem_insumo.length,
  arquivo: outFile,
});

console.log('\n=== CASADOS (amostra 15) ===');
for (const r of result.casados.slice(0, 15)) {
  console.log(
    `${r.codigo} | ${String(r.descricao).slice(0, 40).padEnd(40)} | R$ ${r.preco_caixa_antes ?? '—'} → ${r.preco_caixa_novo}`,
  );
}

console.log('\n=== FALTANDO NO ESUPRI (insumos da contagem sem match) ===');
for (const r of result.faltando) {
  console.log(`${r.codigo} | ${r.descricao}`);
}

process.exit(result.erros.length ? 1 : 0);
