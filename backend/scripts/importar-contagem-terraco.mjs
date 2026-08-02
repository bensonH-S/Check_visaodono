/**
 * Importa catálogo de insumos da planilha Terraço (Contagem 2026)
 * para uma loja — unidades kg/und/L + fatores und_convertida/und_parcial.
 *
 * Uso:
 *   node backend/scripts/importar-contagem-terraco.mjs [--loja=7] [--arquivo=...] [--com-precos] [--db=dev]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';
import {
  classificarUnidadeContagem,
  extrairFatoresFormula,
  normalizarDesc,
  num,
} from '../src/services/estoqueContagem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
const ID_LOJA = Number(getArg('--loja', '7'));
const comPrecos = args.includes('--com-precos');
const dryRun = args.includes('--dry-run');
const arquivo =
  getArg(
    '--arquivo',
    'f:/Users/Benson/Downloads/Estoque 01 de agosto - TERRAÇO.xlsx',
  );
const dbFlag = getArg('--db', 'dev');
const DB_NAME =
  dbFlag === 'prod'
    ? process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check'
    : process.env.DB_NAME_DEV || process.env.DB_NAME || 'vision_check_dev';

function isCabecalho(desc) {
  const d = normalizarDesc(desc);
  if (!d) return true;
  if (/^(CONGELADOS|REFRIGERANTES|BRINDES|LANCAMENTO|TOTAL GERAL|SECOS|LIMPEZA|EMBALAGENS)\b/.test(d)) {
    return true;
  }
  return false;
}

function parsePlanilha(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellFormula: true });
  const sheetName = wb.SheetNames.find((n) => /contagem/i.test(n)) || wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: true });
  const items = [];
  const codCount = new Map();

  for (let r = 6; r < rows.length; r++) {
    const rowNum = r + 1;
    const rawCod = String(rows[r][0] ?? '').trim();
    const desc = String(rows[r][1] ?? '').trim();
    if (!desc || isCabecalho(desc)) continue;

    const fD = sh[`D${rowNum}`]?.f || '';
    const fH = sh[`H${rowNum}`]?.f || '';
    const preco = num(rows[r][2]);
    if (!fD && !fH && !(preco > 0)) continue;

    const { und_convertida, und_parcial, temFatorPc } = extrairFatoresFormula(fD, fH);
    const unidade = classificarUnidadeContagem(desc, und_convertida);

    let codigo = /^\d+$/.test(rawCod) ? rawCod : '';
    if (!codigo) {
      const slug = normalizarDesc(desc)
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 18);
      codigo = `TRC-${slug || rowNum}`;
    }
    const n = (codCount.get(codigo) || 0) + 1;
    codCount.set(codigo, n);
    if (n > 1) codigo = `${codigo}-${n}`;

    items.push({
      codigo,
      descricao: desc,
      unidade_contagem: unidade,
      und_convertida,
      und_parcial: temFatorPc ? und_parcial : 1,
      preco_caixa: preco,
      row: rowNum,
    });
  }
  return items;
}

async function main() {
  if (!fs.existsSync(arquivo)) {
    console.error('Arquivo não encontrado:', arquivo);
    process.exit(1);
  }
  const items = parsePlanilha(arquivo);
  const byUnd = {};
  for (const it of items) byUnd[it.unidade_contagem] = (byUnd[it.unidade_contagem] || 0) + 1;
  console.log(`Loja ${ID_LOJA} | DB ${DB_NAME} | itens ${items.length}`, byUnd);
  console.log('preços:', comPrecos ? 'SIM (só cadastro; não marca custo_fonte)' : 'não (mantém preços existentes)');

  const samples = [
    'BACON',
    'COCA',
    'FILE',
    'MANTEIGA',
    'MOLHO',
    'MOSTARDA',
    'OLEO',
    'PEITO',
    'PEDACO',
    'PEPINO',
    'QUEIJO',
    'SPRITE',
  ];
  for (const k of samples) {
    const hits = items.filter((i) => i.descricao.toUpperCase().includes(k)).slice(0, 3);
    if (!hits.length) continue;
    console.log(`\n== ${k}`);
    for (const it of hits) {
      console.log(
        `  ${it.unidade_contagem.padEnd(3)} cx=${it.und_convertida} pc=${it.und_parcial} ${it.codigo} ${it.descricao.slice(0, 55)}`,
      );
    }
  }

  const out = path.join(projectRoot, 'Logs', 'terraco-contagem-parse.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(items, null, 2), 'utf8');
  console.log('\nJSON:', out);

  if (dryRun) {
    console.log('Dry-run: sem gravar no banco.');
    return;
  }

  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: DB_NAME,
    port: Number(process.env.DB_PORT || 5432),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let upserts = 0;
    for (const it of items) {
      const preco = comPrecos ? it.preco_caixa : 0;
      await client.query(
        `INSERT INTO insumos (
           id_loja, codigo, descricao, unidade_contagem,
           preco_caixa, und_convertida, und_parcial, ativo, atualizado_em
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW())
         ON CONFLICT (id_loja, codigo) DO UPDATE SET
           descricao = EXCLUDED.descricao,
           unidade_contagem = EXCLUDED.unidade_contagem,
           und_convertida = EXCLUDED.und_convertida,
           und_parcial = EXCLUDED.und_parcial,
           preco_caixa = CASE
             WHEN $8::boolean AND EXCLUDED.preco_caixa > 0 THEN EXCLUDED.preco_caixa
             ELSE insumos.preco_caixa
           END,
           ativo = TRUE,
           atualizado_em = NOW()`,
        [
          ID_LOJA,
          it.codigo,
          it.descricao,
          it.unidade_contagem,
          preco,
          it.und_convertida,
          it.und_parcial,
          comPrecos,
        ],
      );
      upserts += 1;
    }
    await client.query('COMMIT');
    console.log(`\nOK: ${upserts} insumos upsert em loja ${ID_LOJA}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
