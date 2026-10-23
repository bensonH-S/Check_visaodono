/**
 * Importa a Tabela de Preço BKC (JSON gerado por tabela_preco_bkc_extrair.py) em estoque_tabela_preco.
 *
 * Uso:
 *   python scripts/tabela_preco_bkc_extrair.py "<Tabela de Preço - BKC.xlsb>" %TEMP%\tabela.json
 *   node scripts/importar-tabela-preco-platlog.mjs --json=%TEMP%\tabela.json --vigencia=2026-08-03 [--tabelas=BB5,B31] [--db=prod] [--aplicar]
 *
 * Sem --aplicar só mostra o resumo. Reimportar a mesma vigência substitui os preços.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '..', '.env'), override: false });
dotenv.config({ path: path.join(root, '.env'), override: false });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);

if (!args.json || !/^\d{4}-\d{2}-\d{2}$/.test(String(args.vigencia || ''))) {
  console.error('Uso: --json=arquivo.json --vigencia=AAAA-MM-DD [--tabelas=BB5] [--aplicar]');
  process.exit(1);
}

const dados = JSON.parse(fs.readFileSync(String(args.json), 'utf8'));
const filtro = args.tabelas ? new Set(String(args.tabelas).toUpperCase().split(',')) : null;
const origem = `${dados.aba || 'TP CD SP'} ${args.vigencia}`;

const linhas = [];
for (const it of dados.itens || []) {
  const codigo = String(it.codigo || '').replace(/^0+/, '');
  if (!codigo) continue;
  for (const [tabela, preco] of Object.entries(it.precos || {})) {
    if (filtro && !filtro.has(tabela.toUpperCase())) continue;
    linhas.push([tabela.toUpperCase(), codigo, it.descricao || null, it.unidade || null, it.tipologia || null, preco]);
  }
}

const porTabela = {};
for (const l of linhas) porTabela[l[0]] = (porTabela[l[0]] || 0) + 1;
console.log(`${origem}: ${linhas.length} preços`, porTabela);

if (!args.aplicar) {
  console.log('Simulação. Rode com --aplicar para gravar.');
  process.exit(0);
}

const database =
  args.db === 'prod'
    ? process.env.DB_NAME_PROD || 'vision_check'
    : process.env.DB_NAME_DEV || 'vision_check_dev';
const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: Number(process.env.DB_PORT || 5432),
  database,
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
console.log(`Banco: ${database}`);
try {
  await client.query('BEGIN');
  const tabelas = Object.keys(porTabela);
  await client.query(`DELETE FROM estoque_tabela_preco WHERE vigencia = $1::date AND tabela = ANY($2::text[])`, [
    args.vigencia,
    tabelas,
  ]);
  const LOTE = 500;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const parte = linhas.slice(i, i + LOTE);
    const valores = [];
    const params = [];
    parte.forEach((l, k) => {
      const b = k * 8;
      valores.push(`($${b + 1}::date,$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`);
      params.push(args.vigencia, l[0], l[1], l[2], l[3], l[4], l[5], origem);
    });
    await client.query(
      `INSERT INTO estoque_tabela_preco (vigencia, tabela, codigo, descricao, unidade, tipologia, preco, origem)
       VALUES ${valores.join(',')}
       ON CONFLICT (vigencia, tabela, codigo) DO UPDATE SET
         descricao = EXCLUDED.descricao, unidade = EXCLUDED.unidade, tipologia = EXCLUDED.tipologia,
         preco = EXCLUDED.preco, origem = EXCLUDED.origem, importado_em = NOW()`,
      params,
    );
  }
  await client.query('COMMIT');
  console.log('Gravado.');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  throw e;
} finally {
  await client.end();
}
