/**
 * Corrige und_convertida a partir da descrição do insumo (CX C/N UN, N KG, etc.).
 * Uso: node scripts/fix-und-convertida-insumos.mjs --loja=21 [--apply] [--db=prod]
 */
import 'dotenv/config';
import { pool } from '../src/db.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const lojaArg = args.find((a) => a.startsWith('--loja='));
const idLoja = lojaArg ? Number(lojaArg.split('=')[1]) : null;
const dbArg = args.find((a) => a.startsWith('--db='));
if (dbArg?.includes('prod')) {
  process.env.NODE_ENV = 'production';
  process.env.DB_NAME = process.env.DB_NAME_PROD || 'vision_check';
}

function num(v) {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrai und_convertida sugerida da descrição.
 * Preferência: unidades explícitas (UN/UND) quando a caixa é contada em peças;
 * kg quando só há peso.
 */
export function sugerirUndConvertida(descricao, undAtual) {
  const d = String(descricao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  // CX C/12,5KG | CX C/12.5 KG
  let m = d.match(/CX\s*C\/\s*(\d+[.,]\d+)\s*KG\b/);
  if (m) {
    const n = num(m[1]);
    if (n && n > 1) return { und: n, motivo: 'cx_kg_decimal' };
  }

  // CX C/18KG | CX C/ 16KG
  m = d.match(/CX\s*C\/\s*(\d+)\s*KG\b/);
  if (m) {
    const n = num(m[1]);
    if (n && n > 1) return { und: n, motivo: 'cx_kg' };
  }

  // CX C/1800 UN | CX C/ 120 UN | CX C/588 UN 12 KG
  m = d.match(/CX\s*C\/\s*(\d+(?:[.,]\d+)?)\s*(?:X\s*\d+(?:[.,]\d+)?)?\s*(UN|UND|UNID|PCS?)\b/);
  if (m) {
    const n = num(m[1]);
    if (n && n > 1) return { und: n, motivo: 'cx_un' };
  }

  // ... 152UN | 1187 UND | 1200UN (sem CX C/)
  m = d.match(/(?:^|[^\d])(\d+(?:[.,]\d+)?)\s*(UN|UND|UNID|PCS?)\b/);
  if (m) {
    const n = num(m[1]);
    if (n && n > 1) return { und: n, motivo: 'un_explicit' };
  }

  // ... 17,2KG no meio (só se não houver contagem em UN)
  if (!/\bUN|\bUND|\bUNID|\bPC\b/.test(d)) {
    m = d.match(/\b(\d+[.,]\d+|\d+)\s*KG\b/);
    if (m) {
      const n = num(m[1]);
      if (n && n > 1 && n < 50) return { und: n, motivo: 'kg_only' };
    }
  }

  return null;
}

function precisaCorrigir(atual, sugerido) {
  if (!sugerido || !(sugerido > 1)) return false;
  const a = Number(atual) || 1;
  // só corrige se atual bem menor que o sugerido (erro típico)
  if (a >= sugerido * 0.9) return false;
  if (sugerido / a < 1.5) return false;
  return true;
}

const params = [];
let filtro = `WHERE ativo = TRUE`;
if (idLoja) {
  params.push(idLoja);
  filtro += ` AND id_loja = $${params.length}`;
}

const { rows } = await pool.query(
  `SELECT id_insumo, id_loja, codigo, descricao, preco_caixa, und_convertida, valor_unidade, custo_fonte, unidade_contagem
   FROM insumos ${filtro}
   ORDER BY id_loja, codigo`,
  params,
);

const fixes = [];
for (const r of rows) {
  const sug = sugerirUndConvertida(r.descricao, r.und_convertida);
  if (!sug) continue;
  if (!precisaCorrigir(r.und_convertida, sug.und)) continue;
  const vuNovo =
    Number(r.preco_caixa) > 0 && sug.und > 0
      ? Math.round((Number(r.preco_caixa) / sug.und) * 1e6) / 1e6
      : null;
  fixes.push({
    id_insumo: r.id_insumo,
    id_loja: r.id_loja,
    codigo: r.codigo,
    descricao: r.descricao,
    und_antiga: Number(r.und_convertida),
    und_nova: sug.und,
    motivo: sug.motivo,
    preco_caixa: Number(r.preco_caixa),
    vu_antiga: Number(r.valor_unidade),
    vu_nova: vuNovo,
    custo_fonte: r.custo_fonte,
  });
}

console.log(`Candidatos: ${fixes.length} (apply=${apply})`);
for (const f of fixes.slice(0, 40)) {
  console.log(
    `#${f.id_loja} ${f.codigo} | ${f.und_antiga} → ${f.und_nova} (${f.motivo}) | vu ${f.vu_antiga} → ${f.vu_nova} | ${String(f.descricao).slice(0, 50)}`,
  );
}
if (fixes.length > 40) console.log(`... +${fixes.length - 40} mais`);

if (apply && fixes.length) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of fixes) {
      await client.query(
        `UPDATE insumos
         SET und_convertida = $1, atualizado_em = NOW()
         WHERE id_insumo = $2`,
        [f.und_nova, f.id_insumo],
      );
    }
    await client.query('COMMIT');
    console.log(`Aplicado: ${fixes.length} insumos`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
} else if (!apply) {
  console.log('Dry-run. Passe --apply para gravar.');
}

await pool.end();
