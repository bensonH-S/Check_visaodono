/**
 * Importa Excel; opcional --map-bkn=21274:30784 (BKN no Excel → BKN no banco).
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { parseVendasExcelBuffer } from '../src/services/bkoffice/parseVendasExcel.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'backend', '.env') });

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);
const file = String(args.file || '');
const mapRaw = String(args['map-bkn'] || '');
const map = new Map();
if (mapRaw) {
  const [from, to] = mapRaw.split(':').map((s) => s.replace(/\D/g, ''));
  if (from && to) map.set(from, to);
}
if (!file || !fs.existsSync(file)) {
  console.error('Informe --file=');
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

const itens = parseVendasExcelBuffer(fs.readFileSync(file), {});
const porBkn = new Map();
for (const r of itens) {
  let bkn = String(r.bk_number || '').replace(/\D/g, '');
  if (map.has(bkn)) bkn = map.get(bkn);
  if (!bkn) continue;
  if (!porBkn.has(bkn)) porBkn.set(bkn, []);
  porBkn.get(bkn).push(r);
}

for (const [bkn, linhas] of porBkn) {
  const { rows: lojas } = await client.query(
    `SELECT id_loja, name FROM lojas WHERE regexp_replace(COALESCE(bk_number,''), '\\D', '', 'g') = $1`,
    [bkn],
  );
  if (!lojas.length) {
    console.log(`SKIP BKN ${bkn} — não cadastrada`);
    continue;
  }
  const loja = lojas[0];
  const porData = new Map();
  for (const r of linhas) {
    const d = String(r.data_venda || '').slice(0, 10);
    const codigo = String(r.codigo || '').trim();
    if (!d || !codigo) continue;
    if (!porData.has(d)) porData.set(d, []);
    porData.get(d).push(r);
  }
  const datas = [...porData.keys()].sort();
  const total = linhas.reduce((a, r) => a + (Number(r.venda_liquida) || 0), 0);
  console.log(
    `${loja.name} BKN ${bkn} — ${linhas.length} linhas — R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
  );

  await client.query('BEGIN');
  await client.query(
    `DELETE FROM estoque_venda_itens vi USING estoque_vendas v
     WHERE vi.id_venda = v.id_venda AND v.id_loja = $1 AND v.origem = 'bkoffice'`,
    [loja.id_loja],
  );
  await client.query(`DELETE FROM estoque_vendas WHERE id_loja = $1 AND origem = 'bkoffice'`, [
    loja.id_loja,
  ]);
  const { rows: vendRows } = await client.query(
    `INSERT INTO estoque_vendas (id_loja, data_venda, origem, status, arquivo_nome)
     SELECT $1, d::date, 'bkoffice', 'pendente', $2
     FROM unnest($3::text[]) AS d
     RETURNING id_venda, data_venda::text AS data_venda`,
    [loja.id_loja, path.basename(file), datas],
  );
  const idPorData = new Map(vendRows.map((r) => [String(r.data_venda).slice(0, 10), r.id_venda]));
  const idVenda = [];
  const codigos = [];
  const descricoes = [];
  const qtdes = [];
  const valores = [];
  for (const [d, ls] of porData) {
    const id = idPorData.get(d);
    if (!id) continue;
    for (const r of ls) {
      idVenda.push(id);
      codigos.push(String(r.codigo).trim());
      descricoes.push(String(r.descricao || '').slice(0, 200));
      qtdes.push(Number(r.qtde) || 0);
      valores.push(Number(r.venda_liquida) || 0);
    }
  }
  await client.query(
    `INSERT INTO estoque_venda_itens
       (id_venda, codigo, descricao, qtde, venda_liquida, processado, sem_ficha)
     SELECT id_venda, codigo, descricao, qtde, valor, FALSE, FALSE
     FROM unnest($1::int[], $2::text[], $3::text[], $4::numeric[], $5::numeric[])
       AS t(id_venda, codigo, descricao, qtde, valor)`,
    [idVenda, codigos, descricoes, qtdes, valores],
  );
  await client.query('COMMIT');
  console.log(`OK ${datas.length}d ${idVenda.length} itens`);
}
await client.end();
