/**
 * Lista BKN/lojas em vários Excels e compara com o banco.
 * Importa em bulk por loja (Valor=Bruto).
 *
 *   node backend/scripts/importar-varios-excel-bk.mjs --dir="f:/Users/Benson/Downloads" --glob="Relatorio_Produto_Venda_Agrupado_Dia*.xlsx" --yes
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

const yes = process.argv.includes('--yes');
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.includes('=')).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return [m[1], m[2]];
  }),
);

const files = [
  'Relatorio_Produto_Venda_Agrupado_Dia (18).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (17).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (16).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (15).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (14).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (13).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (12).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (11).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (10).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (9).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (8).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (7).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (6).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (5).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (4).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (3).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (2).xlsx',
  'Relatorio_Produto_Venda_Agrupado_Dia (1).xlsx',
].map((n) => path.join('f:/Users/Benson/Downloads', n));

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'vision_check',
  port: Number(process.env.DB_PORT || 5432),
  statement_timeout: 180000,
});
await client.connect();

const { rows: lojasDb } = await client.query(`
  SELECT id_loja, name, regexp_replace(COALESCE(bk_number,''), '\\D', '', 'g') AS bkn
  FROM lojas
  WHERE bk_number IS NOT NULL AND trim(bk_number) <> ''
  ORDER BY name
`);
const lojaPorBkn = new Map(lojasDb.map((l) => [l.bkn, l]));

/** bkn -> { nameFromExcel, itens: [] } */
const porBkn = new Map();
const arquivosOk = [];
const arquivosFail = [];

for (const file of files) {
  if (!fs.existsSync(file)) {
    arquivosFail.push({ file: path.basename(file), erro: 'não encontrado' });
    continue;
  }
  try {
    const itens = parseVendasExcelBuffer(fs.readFileSync(file), {});
    const bkns = new Set();
    for (const r of itens) {
      const bkn = String(r.bk_number || '').replace(/\D/g, '');
      if (!bkn) continue;
      bkns.add(bkn);
      if (!porBkn.has(bkn)) {
        porBkn.set(bkn, { restaurante: r.restaurante || '', itens: [] });
      }
      const bucket = porBkn.get(bkn);
      if (!bucket.restaurante && r.restaurante) bucket.restaurante = r.restaurante;
      bucket.itens.push(r);
    }
    arquivosOk.push({
      file: path.basename(file),
      linhas: itens.length,
      bkns: [...bkns],
    });
  } catch (e) {
    arquivosFail.push({ file: path.basename(file), erro: e.message });
  }
}

console.log('\n=== Arquivos ===');
for (const a of arquivosOk) {
  console.log(`OK ${a.file}  linhas=${a.linhas}  bkn=${a.bkns.join(',') || '?'}`);
}
for (const a of arquivosFail) console.log(`FAIL ${a.file}  ${a.erro}`);

console.log('\n=== Excel vs Banco ===');
const noExcel = [...porBkn.keys()].sort();
const noBanco = lojasDb.map((l) => l.bkn).filter(Boolean);
const soExcel = noExcel.filter((b) => !lojaPorBkn.has(b));
const soBanco = noBanco.filter((b) => !porBkn.has(b));
const emAmbos = noExcel.filter((b) => lojaPorBkn.has(b));

for (const bkn of emAmbos) {
  const l = lojaPorBkn.get(bkn);
  const x = porBkn.get(bkn);
  const total = x.itens.reduce((a, r) => a + (Number(r.venda_liquida) || 0), 0);
  const dias = new Set(x.itens.map((r) => String(r.data_venda || '').slice(0, 10))).size;
  console.log(
    `MATCH  BKN ${bkn}  ${l.name}  R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}  ${x.itens.length} linhas  ${dias} dias`,
  );
}
for (const bkn of soExcel) {
  const x = porBkn.get(bkn);
  console.log(`SÓ EXCEL  BKN ${bkn}  ${x.restaurante}  (código antigo / loja não cadastrada?)`);
}
for (const bkn of soBanco) {
  const l = lojaPorBkn.get(bkn);
  const flag = /popy|popeye/i.test(l.name) ? ' ← POPYES?' : '';
  console.log(`SÓ BANCO  BKN ${bkn}  ${l.name}${flag}  (não veio no relatório)`);
}

if (!yes) {
  console.log('\nDry-run. Passe --yes para importar as lojas MATCH.');
  await client.end();
  process.exit(0);
}

async function importarLoja(loja, itens, label) {
  const porData = new Map();
  for (const r of itens) {
    const d = String(r.data_venda || '').slice(0, 10);
    const codigo = String(r.codigo || '').trim();
    if (!d || !codigo) continue;
    if (!porData.has(d)) porData.set(d, []);
    porData.get(d).push(r);
  }
  const datas = [...porData.keys()].sort();
  if (!datas.length) return { ok: false, motivo: 'sem datas' };

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
    [loja.id_loja, label, datas],
  );
  const idPorData = new Map(vendRows.map((r) => [String(r.data_venda).slice(0, 10), r.id_venda]));

  const idVenda = [];
  const codigos = [];
  const descricoes = [];
  const qtdes = [];
  const valores = [];
  for (const [d, linhas] of porData) {
    const id = idPorData.get(d);
    if (!id) continue;
    for (const r of linhas) {
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
  const total = valores.reduce((a, v) => a + Number(v), 0);
  return { ok: true, dias: datas.length, itens: idVenda.length, total };
}

console.log('\n=== Importando ===');
const t0 = Date.now();
for (const bkn of emAmbos) {
  const loja = lojaPorBkn.get(bkn);
  const x = porBkn.get(bkn);
  try {
    const r = await importarLoja(loja, x.itens, `manual-agrupado-dia-${bkn}`);
    console.log(
      `OK BKN ${bkn} ${loja.name}  R$ ${r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}  ${r.dias}d ${r.itens} itens`,
    );
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.log(`ERRO BKN ${bkn} ${loja.name}: ${e.message}`);
  }
}
console.log(`\nFeito em ${Math.round((Date.now() - t0) / 1000)}s`);
await client.end();
