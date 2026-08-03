/**
 * Sync local NF-e Platlog (eSupri) → loja Terraço (padrão id=21).
 *
 *   npm run estoque:sync-platlog -- --loja=21 --limit=3
 *   npm run estoque:sync-platlog -- --loja=21 --limit=3 --apply
 *
 * Credenciais (.env): ESUPRI_USER / ESUPRI_PASS
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};

const idLoja = Number(getArg('--loja', '21'));
const limit = Number(getArg('--limit', '3'));
const aplicar = args.includes('--apply');
const registrarEntrada = args.includes('--entrada');
const headed = args.includes('--headed');
const user = process.env.ESUPRI_USER || '';
const pass = process.env.ESUPRI_PASS || '';

const dbFlag = getArg('--db', '');
if (dbFlag === 'dev') process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';
if (dbFlag === 'prod') process.env.DB_NAME = process.env.DB_NAME_PROD || 'vision_check';

console.log({
  loja: idLoja,
  limit,
  aplicar,
  registrar_entrada: registrarEntrada,
  db_host: process.env.DB_HOST,
  db: process.env.DB_NAME,
  user: user ? `${user.slice(0, 3)}***` : '(vazio)',
});

if (!user || !pass) {
  console.error('Defina ESUPRI_USER e ESUPRI_PASS no .env');
  process.exit(1);
}

// Import depois do dotenv — senão o pool sobe sem DB_HOST
const { syncNfePlatlog } = await import('../src/services/platlog/syncNfePlatlog.js');

const result = await syncNfePlatlog({
  id_loja: idLoja,
  user,
  pass,
  limit,
  aplicar,
  registrar_entrada: registrarEntrada,
  headless: !headed,
});

console.log('\n=== RESUMO ===');
console.log('baixadas', result.baixadas, '| pasta', result.outDir);
for (const p of result.processadas) {
  const flag = p.pulada ? 'PULADA' : p.aplicado ? 'APLICADA' : p.ok ? 'PREVIEW' : 'ERRO';
  console.log(
    `- [${flag}] ${p.notaLabel || '?'} NF ${p.numero || ''} · casados ${p.casados ?? 0}/${p.itens ?? 0}` +
      (p.erro ? ` · ${p.erro}` : ''),
  );
  if (p.linhas) {
    for (const ln of p.linhas.slice(0, 8)) {
      console.log(
        `    ${ln.codigo_nf} ${(ln.descricao || '').slice(0, 40)} → ${ln.match || 'SEM MATCH'} · R$ ${ln.preco_caixa}`,
      );
    }
  }
}

console.log(
  aplicar
    ? '\nOK: gravado no banco (custo NF).'
    : '\nDry-run: nada gravado. Rode de novo com --apply para validar no banco.',
);

process.exit(0);
