/**
 * Complemento: itens da planilha SEM código na coluna A.
 *   node scripts/_op_alinhar_mensal_sem_codigo.mjs
 *   node scripts/_op_alinhar_mensal_sem_codigo.mjs --apply
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const { pool } = await import('../src/db.js');
const apply = process.argv.includes('--apply');
const file = 'f:/Users/Benson/Downloads/Planilha Estoque Setembro-NEW.xlsx';

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function normDesc(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}
function undFrom(vlCaixa, vlUnit) {
  if (vlCaixa != null && vlUnit != null && vlUnit > 0) return Math.round((vlCaixa / vlUnit) * 1e6) / 1e6;
  return 1;
}

const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
const itens = [];
const seen = new Set();
for (const r of rows) {
  if (r[0] != null && /^\d+$/.test(String(r[0]).trim())) continue;
  const desc = r[1] != null ? String(r[1]).trim() : '';
  const vlCaixa = num(r[2]);
  const vlUnit = num(r[3]);
  if (!desc || /código/i.test(desc)) continue;
  if (vlCaixa == null && vlUnit == null) continue;
  const k = normDesc(desc);
  if (seen.has(k)) continue;
  seen.add(k);
  itens.push({
    descricao: desc,
    vl_caixa: vlCaixa ?? 0,
    und: undFrom(vlCaixa, vlUnit),
  });
}

const { rows: lojas } = await pool.query(`
  SELECT id_loja, name FROM lojas
  WHERE name ILIKE 'BURGER KING%' AND bk_number IS NOT NULL
`);

const stats = { itens: itens.length, matched: 0, missing: [], updated: 0 };
const missingSet = new Set();

for (const loja of lojas) {
  const { rows: insumos } = await pool.query(
    `SELECT id_insumo, codigo, descricao, ativo FROM insumos WHERE id_loja = $1`,
    [loja.id_loja],
  );
  const byNorm = new Map();
  for (const x of insumos) {
    const k = normDesc(x.descricao);
    const prev = byNorm.get(k);
    if (!prev || (x.ativo && !prev.ativo)) byNorm.set(k, x);
  }

  for (const p of itens) {
    const row = byNorm.get(normDesc(p.descricao));
    if (!row) {
      if (!missingSet.has(p.descricao)) {
        missingSet.add(p.descricao);
        stats.missing.push(p.descricao);
      }
      continue;
    }
    stats.matched += 1;
    if (!apply) continue;
    await pool.query(
      `UPDATE insumos SET
         preco_caixa = $2,
         und_convertida = $3,
         participa_contagem = TRUE,
         ativo = TRUE,
         custo_fonte = 'manual',
         permite_contagem_caixa = CASE
           WHEN NOT COALESCE(permite_contagem_caixa,FALSE)
            AND NOT COALESCE(permite_contagem_pc_fd,FALSE)
            AND NOT COALESCE(permite_contagem_kg_und,FALSE) THEN TRUE
           ELSE permite_contagem_caixa END,
         permite_contagem_pc_fd = CASE
           WHEN NOT COALESCE(permite_contagem_caixa,FALSE)
            AND NOT COALESCE(permite_contagem_pc_fd,FALSE)
            AND NOT COALESCE(permite_contagem_kg_und,FALSE) THEN TRUE
           ELSE permite_contagem_pc_fd END,
         permite_contagem_kg_und = CASE
           WHEN NOT COALESCE(permite_contagem_caixa,FALSE)
            AND NOT COALESCE(permite_contagem_pc_fd,FALSE)
            AND NOT COALESCE(permite_contagem_kg_und,FALSE) THEN TRUE
           ELSE permite_contagem_kg_und END,
         atualizado_em = NOW()
       WHERE id_insumo = $1`,
      [row.id_insumo, p.vl_caixa, p.und],
    );
    stats.updated += 1;
  }
}

if (apply) {
  const del = await pool.query(`
    DELETE FROM estoque_itens i
    USING estoque_contagens c, insumos p
    WHERE i.id_contagem = c.id_contagem AND i.id_insumo = p.id_insumo
      AND c.status = 'aberta' AND COALESCE(c.tipo,'completa') = 'completa'
      AND COALESCE(p.participa_contagem, TRUE) = FALSE
  `);
  const ins = await pool.query(`
    INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
    SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
    FROM estoque_contagens c
    JOIN insumos p ON p.id_loja = c.id_loja AND p.ativo AND COALESCE(p.participa_contagem,TRUE)
    LEFT JOIN estoque_saldos s ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
    WHERE c.status = 'aberta' AND COALESCE(c.tipo,'completa') = 'completa'
      AND NOT EXISTS (
        SELECT 1 FROM estoque_itens x
        WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
      )
  `);
  stats.sync = { deleted: del.rowCount, inserted: ins.rowCount };
}

console.log(JSON.stringify({ apply, ...stats }, null, 2));
await pool.end();
