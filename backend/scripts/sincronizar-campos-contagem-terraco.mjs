/**
 * Lê a planilha Terraço e atualiza nos insumos:
 * - permite_contagem_caixa / pc_fd / kg_und (célula preta = false)
 * - entra_cmv (linhas 7..231 = true; depois = false)
 * - secao_contagem + ordem_contagem (faixas CONGELADOS, BRINDES, …)
 *
 * Uso:
 *   node backend/scripts/sincronizar-campos-contagem-terraco.mjs --db=prod --yes
 *   node backend/scripts/sincronizar-campos-contagem-terraco.mjs --db=dev --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';
import {
  CMV_LINHA_FIM,
  celulaBloqueadaContagem,
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
const yes = args.includes('--yes');
const dryRun = args.includes('--dry-run');
const dbFlag = getArg('--db', 'dev');
const DB_NAME =
  dbFlag === 'prod'
    ? process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check'
    : process.env.DB_NAME_DEV || process.env.DB_NAME || 'vision_check_dev';
const arquivo = getArg(
  '--arquivo',
  'f:/Users/Benson/Downloads/Estoque 01 de agosto - TERRAÇO.xlsx',
);
const ID_LOJA = Number(getArg('--loja', '21'));

if (!yes && !dryRun) {
  console.error('Use --yes para confirmar (ou --dry-run).');
  process.exit(1);
}

function isLinhaSecao(sh, rowNum, rawCod, desc) {
  if (!desc) return false;
  const c = sh[`C${rowNum}`];
  const d = sh[`D${rowNum}`];
  const hasPrice = typeof c?.v === 'number' || typeof d?.v === 'number';
  if (hasPrice) return false;
  if (/^\d+$/.test(String(rawCod || '').trim())) return false;
  // cabeçalhos de coluna / totais
  if (/^(CODIGO|DESCRICAO|TOTAL GERAL|CONTAGEM)\b/i.test(normalizarDesc(desc))) return false;
  return true;
}

function parsePlanilha(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), {
    type: 'buffer',
    cellStyles: true,
    cellFormula: true,
  });
  const sheetName = wb.SheetNames.find((n) => /contagem/i.test(n)) || wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: true });
  const items = [];
  const codCount = new Map();
  const secoes = [];
  let secaoAtual = 'OUTROS';
  let ordem = 0;

  for (let r = 5; r < rows.length; r++) {
    const rowNum = r + 1;
    const rawCod = String(rows[r][0] ?? '').trim();
    const desc = String(rows[r][1] ?? '').trim();
    if (!desc) continue;

    if (isLinhaSecao(sh, rowNum, rawCod, desc)) {
      secaoAtual = desc.trim();
      if (!secoes.includes(secaoAtual)) secoes.push(secaoAtual);
      continue;
    }

    const fD = sh[`D${rowNum}`]?.f || '';
    const fH = sh[`H${rowNum}`]?.f || '';
    const preco = num(rows[r][2]);
    const vlUnit = num(rows[r][3]);
    if (!fD && !fH && !(preco > 0) && !(vlUnit > 0)) continue;

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

    ordem += 1;
    items.push({
      rowNum,
      codigo,
      descricao: desc,
      secao_contagem: secaoAtual,
      ordem_contagem: ordem,
      permite_contagem_caixa: !celulaBloqueadaContagem(sh[`E${rowNum}`]),
      permite_contagem_pc_fd: !celulaBloqueadaContagem(sh[`F${rowNum}`]),
      permite_contagem_kg_und: !celulaBloqueadaContagem(sh[`G${rowNum}`]),
      entra_cmv: rowNum <= CMV_LINHA_FIM,
    });
  }
  return { items, secoes };
}

function matchInsumo(byCod, byDesc, it) {
  if (byCod.has(it.codigo)) return byCod.get(it.codigo);
  const d = normalizarDesc(it.descricao);
  return byDesc.get(d) || null;
}

async function main() {
  if (!fs.existsSync(arquivo)) {
    console.error('Planilha não encontrada:', arquivo);
    process.exit(1);
  }
  const { items, secoes } = parsePlanilha(arquivo);
  console.log(`Planilha: ${items.length} itens | CMV até linha ${CMV_LINHA_FIM}`);
  console.log(`Seções (${secoes.length}): ${secoes.join(' | ')}`);
  console.log(
    `  pc bloqueado=${items.filter((i) => !i.permite_contagem_pc_fd).length}` +
      ` kg bloqueado=${items.filter((i) => !i.permite_contagem_kg_und).length}` +
      ` fora CMV=${items.filter((i) => !i.entra_cmv).length}`,
  );

  const pool = new pg.Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: DB_NAME,
    ssl:
      process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    await pool.query(`
      ALTER TABLE insumos
        ADD COLUMN IF NOT EXISTS permite_contagem_caixa BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS permite_contagem_pc_fd BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS permite_contagem_kg_und BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS entra_cmv BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS secao_contagem TEXT,
        ADD COLUMN IF NOT EXISTS ordem_contagem INTEGER
    `);

    const { rows: insumos } = await pool.query(
      `SELECT id_insumo, codigo, descricao FROM insumos WHERE id_loja = $1`,
      [ID_LOJA],
    );
    const byCod = new Map(insumos.map((r) => [String(r.codigo), r]));
    const byDesc = new Map(insumos.map((r) => [normalizarDesc(r.descricao), r]));

    let ok = 0;
    let miss = 0;
    const updates = [];
    for (const it of items) {
      const ins = matchInsumo(byCod, byDesc, it);
      if (!ins) {
        miss += 1;
        continue;
      }
      ok += 1;
      updates.push({
        id_insumo: ins.id_insumo,
        ...it,
      });
    }

    console.log(`Match: ${ok} | sem match: ${miss}`);
    if (dryRun) {
      console.log('Dry-run — exemplos:', updates.slice(0, 5));
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const u of updates) {
        await client.query(
          `UPDATE insumos
           SET permite_contagem_caixa = $2,
               permite_contagem_pc_fd = $3,
               permite_contagem_kg_und = $4,
               entra_cmv = $5,
               secao_contagem = $6,
               ordem_contagem = $7,
               atualizado_em = NOW()
           WHERE id_insumo = $1`,
          [
            u.id_insumo,
            u.permite_contagem_caixa,
            u.permite_contagem_pc_fd,
            u.permite_contagem_kg_und,
            u.entra_cmv,
            u.secao_contagem,
            u.ordem_contagem,
          ],
        );
      }
      await client.query('COMMIT');
      console.log(`Atualizados ${updates.length} insumos na loja ${ID_LOJA} (${DB_NAME}).`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
