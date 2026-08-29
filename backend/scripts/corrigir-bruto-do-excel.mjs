/**
 * Corrige R$ com Excel BK (coluna Valor = Bruto). Rápido (1 SELECT + 1 UPDATE).
 *
 *   node backend/scripts/corrigir-bruto-do-excel.mjs --bkn=23531 --file="..." --yes
 */
import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseVendasExcelBuffer } from '../src/services/bkoffice/parseVendasExcel.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'backend', '.env') });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);
const yes = Boolean(args.yes);
const bkn = String(args.bkn || '23531').trim();
const file = String(args.file || '').trim();
const de = String(args.de || '2026-08-01').slice(0, 10);
const ate = String(args.ate || '2026-08-28').slice(0, 10);

if (!file || !fs.existsSync(file)) {
  console.error('Informe --file=caminho.xlsx');
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'vision_check',
  port: Number(process.env.DB_PORT || 5432),
  statement_timeout: 120000,
});

await client.connect();
const { rows: lojas } = await client.query(
  `SELECT id_loja, name, bk_number FROM lojas WHERE bk_number = $1`,
  [bkn],
);
if (!lojas.length) throw new Error(`BKN ${bkn} não encontrada`);
const loja = lojas[0];

const parsed = parseVendasExcelBuffer(fs.readFileSync(file), { bkNumber: bkn });
const porCodigo = new Map();
for (const r of parsed) {
  porCodigo.set(String(r.codigo), {
    valor: Number(r.venda_liquida) || 0,
    qtde: Number(r.qtde) || 0,
  });
}
const totalExcel = [...porCodigo.values()].reduce((a, x) => a + x.valor, 0);

const { rows: itens } = await client.query(
  `SELECT vi.id_item, vi.codigo, vi.qtde::float AS qtde, vi.venda_liquida::float AS venda
   FROM estoque_vendas v
   JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
   WHERE v.id_loja = $1 AND v.origem = 'bkoffice'
     AND v.data_venda >= $2::date AND v.data_venda <= $3::date`,
  [loja.id_loja, de, ate],
);

const qtdePorCodigo = new Map();
for (const it of itens) {
  qtdePorCodigo.set(it.codigo, (qtdePorCodigo.get(it.codigo) || 0) + Number(it.qtde));
}

const ids = [];
const valores = [];
let antes = 0;
for (const it of itens) {
  antes += Number(it.venda) || 0;
  const meta = porCodigo.get(String(it.codigo));
  const qTot = qtdePorCodigo.get(it.codigo) || 0;
  if (!meta || qTot <= 0) continue;
  const novo = Math.round(meta.valor * (Number(it.qtde) / qTot) * 100) / 100;
  ids.push(it.id_item);
  valores.push(novo);
}

console.log(loja.name, `BKN ${bkn}`);
console.log(`Excel Valor/Bruto: R$ ${totalExcel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`Banco antes:       R$ ${antes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`Linhas a atualizar: ${ids.length}`);

if (!yes) {
  console.log('Dry-run. Passe --yes para gravar.');
  await client.end();
  process.exit(0);
}

await client.query(
  `UPDATE estoque_venda_itens AS vi
   SET venda_liquida = d.valor
   FROM unnest($1::int[], $2::numeric[]) AS d(id_item, valor)
   WHERE vi.id_item = d.id_item`,
  [ids, valores],
);

const { rows: depois } = await client.query(
  `SELECT COALESCE(SUM(vi.venda_liquida),0)::float AS v
   FROM estoque_vendas v
   JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
   WHERE v.id_loja = $1 AND v.origem = 'bkoffice'
     AND v.data_venda >= $2::date AND v.data_venda <= $3::date`,
  [loja.id_loja, de, ate],
);
const v = Number(depois[0].v);
console.log(`Banco depois:      R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(Math.abs(v - totalExcel) < 2 ? 'OK — bateu com o Excel (Bruto/Valor)' : 'ATENÇÃO — ainda diverge');
await client.end();
