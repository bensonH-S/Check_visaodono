/**
 * Importa catálogo Popeyes (planilha mensal) e marca contagem diária
 * nos itens semelhantes ao padrão BK (batata, pão, frango, bacon, queijo).
 *
 *   node scripts/_op_popeyes_import_diaria.mjs
 *   node scripts/_op_popeyes_import_diaria.mjs --apply
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import { normalizarDesc, classificarUnidadeContagem } from '../src/services/estoqueContagem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const apply = process.argv.includes('--apply');
const ID_LOJA = 5; // POPYES - VALPARAÍSO
const FILE =
  'F:/Users/benson/OneDrive/Documentos/PLANILHAS DE CONTAGEM - GRUPO ALVIM MÊS 09/Barbara/POPYES - MES 09.xlsx';

const { pool } = await import('../src/db.js');

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normKey(s) {
  return normalizarDesc(s)
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Diária Popeyes: mesmos grupos do BK (batata/pão/frango/bacon/queijo),
 * adaptado a nomes PLK (FILES, PEITO, pães 270un, etc.).
 */
function classificarGrupoDiarioPopeyes(descricao) {
  const d = normalizarDesc(descricao);
  if (!d) return null;

  if (
    /\b(CART |CARTON|CARTONAGEM|SACO |SAQUINHO|EMBALAG|LAMINA|TAMPA|FUNDO|GUARDANAPO|LACRE|CANUDO|CAIXA VIAGEM|KIT GARFO|AVENTAL|ETIQUETA|BANDEJA|FILME|BOBINA|PAPEL TOALHA|PANO |LUVA|REDE|TEFLON|ZIPCLIP|DETERGENTE|SAC O P|LIXO|BRINDE|FILTRO|MAGNESOL)\b/.test(
      d,
    )
  ) {
    return null;
  }
  if (/\b(ALFACE|TOMATE|CEBOLA|OLEO|PICKLES|SAL REFINADO|AGUA COPO|TEMPERO)\b/.test(d)) return null;
  if (/\bMARMITA\b/.test(d) || /\bFUSILLI\b/.test(d)) return null;
  if (
    /\b(MOLHO|MAIONESE|KETCHUP|MOSTARDA|MANTEIGA|FARINHA|BATTER|CALDA|MOUSSE|CHURROS|BOMBOM|SORBET|DOCE DE LEITE)\b/.test(
      d,
    )
  ) {
    return null;
  }
  if (/\b(COCA|SPRITE|FANTA|SUCO|BAG IN BOX|BIB )\b/.test(d)) return null;
  if (/\bRISOLE\b/.test(d)) return null;

  if (/\bBATATA\b/.test(d)) return 'batata';
  if (/\bPAO\b/.test(d)) return 'pao';
  if (/\bQUEIJO\b/.test(d)) return 'queijo';
  if (/\bBACON\b/.test(d)) return 'bacon';
  if (
    /\b(FRANGO|CHICKEN|FILES|FILEZINHO|PEITO|PEDACOS|SASSAMI)\b/.test(d) ||
    /\bMINI FILES\b/.test(d)
  ) {
    return 'frango';
  }
  return null;
}

function parseSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const items = [];
  const seen = new Set();
  const codCount = new Map();

  for (const r of rows.slice(3)) {
    const desc = r[1] != null ? String(r[1]).trim() : '';
    if (!desc) continue;
    const k = normKey(desc);
    if (seen.has(k)) continue;
    seen.add(k);

    const undSheet = String(r[2] || '')
      .trim()
      .toUpperCase();
    const preco = num(r[3]) ?? 0;
    const undConv = num(r[4]) ?? 1;
    let unidade =
      undSheet === 'KG' ? 'KG' : undSheet === 'UND' || undSheet === 'UN' ? 'UND' : null;
    if (!unidade) unidade = classificarUnidadeContagem(desc, undConv);

    let codigo = r[0] != null && /^\d+$/.test(String(r[0]).trim()) ? String(r[0]).trim() : '';
    if (!codigo) {
      const slug = normalizarDesc(desc)
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 20);
      codigo = `PLK-${slug || items.length + 1}`;
    }
    const n = (codCount.get(codigo) || 0) + 1;
    codCount.set(codigo, n);
    if (n > 1) codigo = `${codigo}-${n}`;

    const grupo = classificarGrupoDiarioPopeyes(desc);
    items.push({
      codigo,
      descricao: desc,
      unidade_contagem: unidade,
      preco_caixa: preco,
      und_convertida: undConv,
      contagem_diaria: !!grupo,
      grupo_diario: grupo,
    });
  }
  return items;
}

const items = parseSheet(FILE);
const diarias = items.filter((i) => i.contagem_diaria);

console.log(
  JSON.stringify(
    {
      apply,
      loja: ID_LOJA,
      total_planilha: items.length,
      candidatas_diaria: diarias.length,
      diarias: diarias.map((d) => ({ g: d.grupo_diario, desc: d.descricao, und: d.unidade_contagem })),
    },
    null,
    2,
  ),
);

if (!apply) {
  console.log('\nDry-run. Rode com --apply para importar insumos e marcar diária.');
  await pool.end();
  process.exit(0);
}

const client = await pool.connect();
const stats = { criados: 0, atualizados: 0, diaria: 0 };

try {
  await client.query('BEGIN');

  const { rows: loja } = await client.query(
    `SELECT id_loja, name FROM lojas WHERE id_loja = $1`,
    [ID_LOJA],
  );
  if (!loja[0]) throw new Error(`Loja ${ID_LOJA} não encontrada`);

  const { rows: existentes } = await client.query(
    `SELECT id_insumo, codigo, descricao FROM insumos WHERE id_loja = $1`,
    [ID_LOJA],
  );
  const byCod = new Map(existentes.map((x) => [String(x.codigo), x.id_insumo]));
  const byDesc = new Map(existentes.map((x) => [normKey(x.descricao), x.id_insumo]));

  for (const it of items) {
    let id = byCod.get(it.codigo) || byDesc.get(normKey(it.descricao)) || null;

    if (!id) {
      const { rows: ins } = await client.query(
        `INSERT INTO insumos (
           id_loja, codigo, descricao, unidade_contagem,
           preco_caixa, und_convertida, und_parcial,
           ativo, participa_contagem, contagem_diaria, grupo_diario,
           custo_fonte,
           permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und,
           atualizado_em
         ) VALUES (
           $1,$2,$3,$4,$5,$6,1,TRUE,TRUE,$7,$8,'manual',TRUE,TRUE,TRUE,NOW()
         )
         RETURNING id_insumo`,
        [
          ID_LOJA,
          it.codigo,
          it.descricao,
          it.unidade_contagem,
          it.preco_caixa,
          it.und_convertida,
          it.contagem_diaria,
          it.grupo_diario,
        ],
      );
      id = ins[0].id_insumo;
      byCod.set(it.codigo, id);
      byDesc.set(normKey(it.descricao), id);
      stats.criados += 1;
    } else {
      await client.query(
        `UPDATE insumos SET
           descricao = $2,
           unidade_contagem = $3,
           preco_caixa = CASE WHEN $4::numeric > 0 THEN $4 ELSE preco_caixa END,
           und_convertida = $5,
           ativo = TRUE,
           participa_contagem = TRUE,
           contagem_diaria = $6,
           grupo_diario = $7,
           custo_fonte = 'manual',
           permite_contagem_caixa = TRUE,
           permite_contagem_pc_fd = TRUE,
           permite_contagem_kg_und = TRUE,
           atualizado_em = NOW()
         WHERE id_insumo = $1`,
        [
          id,
          it.descricao,
          it.unidade_contagem,
          it.preco_caixa,
          it.und_convertida,
          it.contagem_diaria,
          it.grupo_diario,
        ],
      );
      stats.atualizados += 1;
    }
    if (it.contagem_diaria) stats.diaria += 1;
  }

  const del = await client.query(
    `
    DELETE FROM estoque_itens i
    USING estoque_contagens c, insumos p
    WHERE i.id_contagem = c.id_contagem AND i.id_insumo = p.id_insumo
      AND c.id_loja = $1 AND c.status = 'aberta'
      AND COALESCE(p.participa_contagem, TRUE) = FALSE
  `,
    [ID_LOJA],
  );

  const insCompleta = await client.query(
    `
    INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
    SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
    FROM estoque_contagens c
    JOIN insumos p ON p.id_loja = c.id_loja AND p.ativo AND COALESCE(p.participa_contagem, TRUE)
    LEFT JOIN estoque_saldos s ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
    WHERE c.id_loja = $1 AND c.status = 'aberta' AND COALESCE(c.tipo,'completa') = 'completa'
      AND NOT EXISTS (
        SELECT 1 FROM estoque_itens x
        WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
      )
  `,
    [ID_LOJA],
  );

  const insDiaria = await client.query(
    `
    INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
    SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
    FROM estoque_contagens c
    JOIN insumos p ON p.id_loja = c.id_loja AND p.ativo AND p.contagem_diaria
    LEFT JOIN estoque_saldos s ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
    WHERE c.id_loja = $1 AND c.status = 'aberta' AND c.tipo = 'diaria'
      AND NOT EXISTS (
        SELECT 1 FROM estoque_itens x
        WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
      )
  `,
    [ID_LOJA],
  );

  await client.query('COMMIT');
  console.log(
    JSON.stringify(
      {
        ok: true,
        loja: loja[0].name,
        ...stats,
        sync: {
          deleted: del.rowCount,
          completa: insCompleta.rowCount,
          diaria: insDiaria.rowCount,
        },
      },
      null,
      2,
    ),
  );
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
