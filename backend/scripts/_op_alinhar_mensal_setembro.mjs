/**
 * Alinha contagem mensal (completa) à Planilha Estoque Setembro-NEW.
 *
 * Casa por NOME (não pelo código da planilha — códigos estão trocados).
 * Nunca altera insumos.codigo canônico do Meridian.
 *
 * Dry-run (padrão):
 *   node scripts/_op_alinhar_mensal_setembro.mjs
 *
 * Aplicar em produção:
 *   node scripts/_op_alinhar_mensal_setembro.mjs --apply
 *
 * Planilha:
 *   f:/Users/Benson/Downloads/Planilha Estoque Setembro-NEW.xlsx
 */
import fs from 'fs';
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
const PLANILHA =
  process.env.PLANILHA_MENSAL ||
  'f:/Users/Benson/Downloads/Planilha Estoque Setembro-NEW.xlsx';
const SCORE_MIN = 0.55;
const SCORE_AMB = 0.45;

function nucleo(codigo) {
  const c = String(codigo ?? '').trim();
  if (!c || !/^\d+$/.test(c)) return null;
  return c.replace(/^0+/, '') || '0';
}
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
function tokens(s) {
  return new Set(
    normDesc(s)
      .split(' ')
      .filter((w) => w.length >= 3 && !['COM', 'UND', 'CX', 'PCT', 'PARA', 'DOS'].includes(w)),
  );
}
function parecido(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / Math.min(A.size, B.size);
}
function quaseIgual(a, b, tol = 0.05) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= tol;
}

/** und_convertida para valor_unidade (gerado) ≈ vl_unit */
function undFromPrecos(vlCaixa, vlUnit, fallback = 1) {
  const c = num(vlCaixa);
  const u = num(vlUnit);
  if (c != null && u != null && u > 0) {
    const und = c / u;
    if (Number.isFinite(und) && und > 0) return Math.round(und * 1e6) / 1e6;
  }
  return fallback;
}

function lerPlanilha(file) {
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
  let secao = '';
  const planilha = [];
  const seen = new Set();
  for (const r of rows) {
    const cod = r[0];
    const desc = r[1] != null ? String(r[1]).trim() : '';
    const vlCaixa = num(r[2]);
    const vlUnit = num(r[3]);
    if (cod == null && desc && vlCaixa == null && vlUnit == null) {
      secao = desc;
      continue;
    }
    const sku = nucleo(cod);
    // Aceita linha sem código se tiver descrição + preço (planilha deixa código em branco)
    if (!desc || /código/i.test(desc)) continue;
    if (!sku && vlCaixa == null && vlUnit == null) continue;
    if (!sku && !(vlCaixa != null || vlUnit != null)) continue;
    const key = `${sku || 'SEMCOD'}|${normDesc(desc)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    planilha.push({
      codigo_xlsx: sku ? String(cod).trim() : '',
      sku: sku || null,
      descricao: desc,
      secao,
      vl_caixa: vlCaixa ?? 0,
      vl_unit: vlUnit ?? 0,
      und_convertida: undFromPrecos(vlCaixa, vlUnit, 1),
      sem_codigo: !sku,
    });
  }
  return planilha;
}

function rankCandidatos(p, insumosLoja) {
  const alvo = normDesc(p.descricao);
  return insumosLoja
    .map((x) => {
      const scoreNome = parecido(p.descricao, x.descricao);
      const exact = normDesc(x.descricao) === alvo;
      const mesmoSku = nucleo(x.codigo) === p.sku;
      // Prefer exact name, then fuzzy; never prefer inactive over active with same name
      const score =
        (exact ? 2 : scoreNome) +
        (mesmoSku && (exact || scoreNome >= 0.35) ? 0.05 : 0) +
        (x.ativo ? 0.02 : 0) +
        (x.participa_contagem ? 0.01 : 0);
      return { ...x, score, scoreNome, exact, mesmoSku };
    })
    .filter((x) => x.exact || x.scoreNome >= SCORE_AMB || x.mesmoSku)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.ativo) - Number(a.ativo) ||
        Number(b.participa_contagem) - Number(a.participa_contagem),
    );
}

function classificarLinha(p, insumosLoja) {
  const ranked = rankCandidatos(p, insumosLoja);
  const bons = ranked.filter(
    (x) => x.exact || x.scoreNome >= SCORE_MIN || (x.mesmoSku && x.scoreNome >= 0.4),
  );
  // Preferência: ativo com nome exato / bom score
  const ativos = bons.filter((x) => x.ativo);
  const top = (ativos[0] || bons[0]) || null;

  // Ambíguo só se 2+ ATIVOS com nome muito parecido e códigos diferentes
  if (ativos.length >= 2) {
    const a = ativos[0];
    const b = ativos[1];
    const ambosFortes = (a.exact || a.scoreNome >= SCORE_MIN) && (b.exact || b.scoreNome >= SCORE_MIN);
    const empate =
      ambosFortes &&
      a.exact === b.exact &&
      Math.abs(a.scoreNome - b.scoreNome) < 0.05 &&
      nucleo(a.codigo) !== nucleo(b.codigo);
    // Se um é exact e o outro não, não é ambíguo
    if (empate && a.exact && b.exact) {
      // Mesma descrição em 2 códigos ativos: preferir o que NÃO é o código errado da planilha
      // se um deles for o canônico (mais usado) — pega o de maior und_convertida/preço histórico? 
      // Regra: preferir código com zero à esquerda / maior comprimento (eSupri), senão o primeiro.
      const prefer = [...ativos]
        .filter((x) => normDesc(x.descricao) === normDesc(p.descricao))
        .sort(
          (x, y) =>
            String(y.codigo).length - String(x.codigo).length ||
            Number(y.participa_contagem) - Number(x.participa_contagem),
        )[0];
      if (prefer) {
        const codigoTrocado = nucleo(prefer.codigo) !== p.sku;
        return {
          acao: codigoTrocado ? 'MATCH_CODIGO_TROCADO' : 'MATCH_CODIGO_NOME',
          planilha: p,
          id_insumo: prefer.id_insumo,
          codigo_meridian: prefer.codigo,
          descricao_meridian: prefer.descricao,
          codigo_trocado: codigoTrocado,
          preco_antes: Number(prefer.preco_caixa),
          und_antes: Number(prefer.und_convertida),
          preco_ok: quaseIgual(prefer.preco_caixa, p.vl_caixa, 0.05),
        };
      }
      return {
        acao: 'AMBIGUO',
        planilha: p,
        candidatos: ativos.slice(0, 3).map((x) => ({
          id_insumo: x.id_insumo,
          codigo: x.codigo,
          descricao: x.descricao,
          score: +x.scoreNome.toFixed(3),
          ativo: x.ativo,
        })),
      };
    }
  }

  if (!top) {
    return { acao: 'AUSENTE', planilha: p };
  }
  const codigoTrocado = !top.mesmoSku && (top.exact || top.scoreNome >= SCORE_MIN);
  if (!top.ativo) {
    return {
      acao: 'REATIVAR',
      planilha: p,
      id_insumo: top.id_insumo,
      codigo_meridian: top.codigo,
      descricao_meridian: top.descricao,
      codigo_trocado: codigoTrocado,
      preco_antes: Number(top.preco_caixa),
      und_antes: Number(top.und_convertida),
    };
  }
  return {
    acao: codigoTrocado ? 'MATCH_CODIGO_TROCADO' : top.mesmoSku ? 'MATCH_CODIGO_NOME' : 'MATCH_NOME',
    planilha: p,
    id_insumo: top.id_insumo,
    codigo_meridian: top.codigo,
    descricao_meridian: top.descricao,
    codigo_trocado: codigoTrocado,
    preco_antes: Number(top.preco_caixa),
    und_antes: Number(top.und_convertida),
    preco_ok: quaseIgual(top.preco_caixa, p.vl_caixa, 0.05),
  };
}

const planilha = lerPlanilha(PLANILHA);
const planilhaNorm = new Set(planilha.map((p) => normDesc(p.descricao)));

const { rows: lojas } = await pool.query(`
  SELECT id_loja, name, bk_number
  FROM lojas
  WHERE bk_number IS NOT NULL AND TRIM(bk_number::text) <> ''
    AND name ILIKE 'BURGER KING%'
  ORDER BY name
`);

const { rows: todosInsumos } = await pool.query(`
  SELECT id_insumo, id_loja, codigo, descricao, ativo,
         COALESCE(participa_contagem, TRUE) AS participa_contagem,
         preco_caixa, und_convertida, valor_unidade, secao_contagem, unidade_contagem
  FROM insumos
`);

const porLoja = new Map();
for (const r of todosInsumos) {
  if (!porLoja.has(r.id_loja)) porLoja.set(r.id_loja, []);
  porLoja.get(r.id_loja).push(r);
}

const resumo = {
  apply: false,
  planilha: planilha.length,
  lojas: lojas.length,
  por_acao: {},
  ambíguos: [],
  ausentes_unicos: [],
  extras_unicos: [],
  amostra_trocados: [],
  por_loja: [],
};

const ausentesSet = new Map();
const extrasSet = new Map();
const matchedIdsGlobal = new Map(); // id_loja -> Set(id_insumo)

for (const loja of lojas) {
  const insumos = porLoja.get(loja.id_loja) || [];
  const matched = new Set();
  const acoes = {
    MATCH_CODIGO_NOME: 0,
    MATCH_NOME: 0,
    MATCH_CODIGO_TROCADO: 0,
    REATIVAR: 0,
    AUSENTE: 0,
    AMBIGUO: 0,
    EXTRA: 0,
  };
  const decisoes = [];

  for (const p of planilha) {
    const d = classificarLinha(p, insumos);
    acoes[d.acao] = (acoes[d.acao] || 0) + 1;
    decisoes.push(d);
    if (d.id_insumo) matched.add(d.id_insumo);
    if (d.acao === 'AMBIGUO') {
      resumo.ambíguos.push({ loja: loja.name, item: p.descricao, candidatos: d.candidatos });
    }
    if (d.acao === 'AUSENTE') {
      const k = `${p.sku}|${normDesc(p.descricao)}`;
      if (!ausentesSet.has(k)) ausentesSet.set(k, p);
    }
    if (d.codigo_trocado && resumo.amostra_trocados.length < 25) {
      resumo.amostra_trocados.push({
        item: p.descricao,
        planilha: p.codigo_xlsx,
        meridian: d.codigo_meridian,
        vl_caixa: p.vl_caixa,
      });
    }
  }

  for (const ins of insumos) {
    if (!ins.ativo) continue;
    if (!ins.participa_contagem) continue;
    if (matched.has(ins.id_insumo)) continue;
    // Extra: participa e não foi casado com a planilha
    const naPlanilhaPorNome = planilhaNorm.has(normDesc(ins.descricao));
    if (naPlanilhaPorNome) continue; // nome está na planilha mas match falhou — não desligar cegamente
    acoes.EXTRA += 1;
    const k = `${nucleo(ins.codigo)}|${normDesc(ins.descricao)}`;
    if (!extrasSet.has(k)) {
      extrasSet.set(k, { codigo: ins.codigo, descricao: ins.descricao });
    }
  }

  matchedIdsGlobal.set(loja.id_loja, matched);
  for (const [k, v] of Object.entries(acoes)) {
    resumo.por_acao[k] = (resumo.por_acao[k] || 0) + v;
  }
  resumo.por_loja.push({
    id_loja: loja.id_loja,
    loja: loja.name,
    bk: loja.bk_number,
    ...acoes,
    matched: matched.size,
  });

  // stash decisions for apply
  loja._decisoes = decisoes;
  loja._matched = matched;
  loja._insumos = insumos;
}

resumo.ausentes_unicos = [...ausentesSet.values()].map((p) => ({
  sku: p.sku,
  descricao: p.descricao,
  secao: p.secao,
  vl_caixa: p.vl_caixa,
}));
resumo.extras_unicos = [...extrasSet.values()];
resumo.ambíguos = resumo.ambíguos.slice(0, 40);

const reportPath = path.join(root, 'backups', `alinhar_mensal_setembro_${apply ? 'apply' : 'dry'}_${Date.now()}.json`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

if (!apply) {
  const out = { ...resumo, apply: false };
  fs.writeFileSync(reportPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ...out, report: reportPath, por_loja: out.por_loja.slice(0, 3) }, null, 2));
  console.log(`\nRelatório completo: ${reportPath}`);
  console.log(`Lojas: ${lojas.length} · Planilha: ${planilha.length}`);
  console.log('Dry-run OK. Rode com --apply para gravar.');
  await pool.end();
  process.exit(0);
}

// ---------- APPLY ----------
resumo.apply = true;
const applyStats = {
  atualizados: 0,
  reativados: 0,
  criados: 0,
  extras_off: 0,
  ambíguos_pulados: 0,
  erros: [],
  sync_abertas: { deleted: 0, inserted: 0 },
};

const client = await pool.connect();
try {
  await client.query('BEGIN');

  for (const loja of lojas) {
    const decisoes = loja._decisoes || [];
    const matched = loja._matched || new Set();
    const insumos = loja._insumos || [];

    for (const d of decisoes) {
      const p = d.planilha;
      if (d.acao === 'AMBIGUO') {
        applyStats.ambíguos_pulados += 1;
        continue;
      }

      if (d.acao === 'AUSENTE') {
        if (p.sem_codigo || !p.sku) {
          applyStats.erros.push({
            loja: loja.name,
            item: p.descricao,
            erro: 'ausente e sem código na planilha — não criou',
          });
          continue;
        }
        // Evitar colisão de código: se código já existe (outro produto), usa prefixo P
        const cod = p.codigo_xlsx.padStart(Math.max(p.codigo_xlsx.length, 5), '0');
        const { rows: existe } = await client.query(
          `SELECT id_insumo, descricao, ativo FROM insumos WHERE id_loja = $1 AND codigo = $2`,
          [loja.id_loja, cod],
        );
        if (existe[0]) {
          // Código ocupado por outro item — não sobrescrever; tentar pelo sku com zero pad alternativo
          const alt = `P${p.sku}`;
          const { rows: existeAlt } = await client.query(
            `SELECT id_insumo FROM insumos WHERE id_loja = $1 AND codigo = $2`,
            [loja.id_loja, alt],
          );
          if (existeAlt[0]) {
            applyStats.erros.push({
              loja: loja.name,
              item: p.descricao,
              erro: `código ${cod} ocupado e alt ${alt} também`,
            });
            continue;
          }
          await client.query(
            `INSERT INTO insumos (
              id_loja, codigo, descricao, unidade_contagem,
              preco_caixa, und_convertida, und_parcial,
              ativo, participa_contagem, secao_contagem, custo_fonte,
              permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
            ) VALUES ($1, $2, $3, 'UND', $4, $5, 1, TRUE, TRUE, $6, 'manual', TRUE, TRUE, TRUE)`,
            [loja.id_loja, alt, p.descricao, p.vl_caixa, p.und_convertida, p.secao || null],
          );
          applyStats.criados += 1;
          continue;
        }
        await client.query(
          `INSERT INTO insumos (
            id_loja, codigo, descricao, unidade_contagem,
            preco_caixa, und_convertida, und_parcial,
            ativo, participa_contagem, secao_contagem, custo_fonte,
            permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
          ) VALUES ($1, $2, $3, 'UND', $4, $5, 1, TRUE, TRUE, $6, 'manual', TRUE, TRUE, TRUE)`,
          [loja.id_loja, cod, p.descricao, p.vl_caixa, p.und_convertida, p.secao || null],
        );
        applyStats.criados += 1;
        continue;
      }

      // MATCH / REATIVAR
      await client.query(
        `UPDATE insumos SET
           preco_caixa = $2,
           und_convertida = $3,
           secao_contagem = COALESCE($4, secao_contagem),
           participa_contagem = TRUE,
           ativo = TRUE,
           custo_fonte = 'manual',
           permite_contagem_caixa = CASE
             WHEN NOT COALESCE(permite_contagem_caixa, FALSE)
              AND NOT COALESCE(permite_contagem_pc_fd, FALSE)
              AND NOT COALESCE(permite_contagem_kg_und, FALSE)
             THEN TRUE ELSE permite_contagem_caixa END,
           permite_contagem_pc_fd = CASE
             WHEN NOT COALESCE(permite_contagem_caixa, FALSE)
              AND NOT COALESCE(permite_contagem_pc_fd, FALSE)
              AND NOT COALESCE(permite_contagem_kg_und, FALSE)
             THEN TRUE ELSE permite_contagem_pc_fd END,
           permite_contagem_kg_und = CASE
             WHEN NOT COALESCE(permite_contagem_caixa, FALSE)
              AND NOT COALESCE(permite_contagem_pc_fd, FALSE)
              AND NOT COALESCE(permite_contagem_kg_und, FALSE)
             THEN TRUE ELSE permite_contagem_kg_und END,
           atualizado_em = NOW()
         WHERE id_insumo = $1`,
        [d.id_insumo, p.vl_caixa, p.und_convertida, p.secao || null],
      );
      if (d.acao === 'REATIVAR') applyStats.reativados += 1;
      else applyStats.atualizados += 1;
      matched.add(d.id_insumo);
    }

    // Extras: desligar participa_contagem
    for (const ins of insumos) {
      if (!ins.ativo) continue;
      if (!ins.participa_contagem) continue;
      if (matched.has(ins.id_insumo)) continue;
      if (planilhaNorm.has(normDesc(ins.descricao))) continue;
      await client.query(
        `UPDATE insumos SET participa_contagem = FALSE, atualizado_em = NOW()
         WHERE id_insumo = $1`,
        [ins.id_insumo],
      );
      applyStats.extras_off += 1;
    }
  }

  // Sync contagens completa abertas
  const del = await client.query(`
    DELETE FROM estoque_itens i
    USING estoque_contagens c, insumos p
    WHERE i.id_contagem = c.id_contagem
      AND i.id_insumo = p.id_insumo
      AND c.status = 'aberta'
      AND COALESCE(c.tipo, 'completa') = 'completa'
      AND COALESCE(p.participa_contagem, TRUE) = FALSE
  `);
  applyStats.sync_abertas.deleted = del.rowCount || 0;

  const ins = await client.query(`
    INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
    SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
    FROM estoque_contagens c
    JOIN insumos p
      ON p.id_loja = c.id_loja
     AND p.ativo = TRUE
     AND COALESCE(p.participa_contagem, TRUE) = TRUE
    LEFT JOIN estoque_saldos s
      ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
    WHERE c.status = 'aberta'
      AND COALESCE(c.tipo, 'completa') = 'completa'
      AND NOT EXISTS (
        SELECT 1 FROM estoque_itens x
        WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
      )
  `);
  applyStats.sync_abertas.inserted = ins.rowCount || 0;

  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('APPLY FALHOU — rollback', e);
  client.release();
  await pool.end();
  process.exit(1);
}
client.release();

// Validação pós-apply
const { rows: spot } = await pool.query(`
  SELECT i.codigo, i.descricao, i.preco_caixa, i.valor_unidade, i.participa_contagem, i.ativo,
         COUNT(*)::int AS lojas
  FROM insumos i
  WHERE i.ativo AND (
    i.descricao ILIKE '%BACON BK ASS CUBOS%'
    OR i.descricao ILIKE '%BACON PRONTO ASSADO%TIRAS%'
    OR i.descricao ILIKE '%BATATA CONG PRE FRITA%9MM%'
    OR i.descricao ILIKE '%CARNE CONG MOIDA WHOPPER%'
    OR i.descricao ILIKE '%QUEIJO CHEDDAR CLEAN%'
  )
  GROUP BY i.codigo, i.descricao, i.preco_caixa, i.valor_unidade, i.participa_contagem, i.ativo
  ORDER BY i.descricao, i.codigo
`);

const { rows: cobertura } = await pool.query(`
  SELECT l.name, l.bk_number,
         COUNT(*) FILTER (WHERE i.participa_contagem AND i.ativo)::int AS participa,
         COUNT(*) FILTER (WHERE i.ativo)::int AS ativos
  FROM lojas l
  LEFT JOIN insumos i ON i.id_loja = l.id_loja
  WHERE l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
  GROUP BY l.id_loja, l.name, l.bk_number
  ORDER BY l.name
`);

const resultado = {
  ...resumo,
  apply: true,
  applyStats,
  spot_check: spot,
  cobertura_por_loja: cobertura,
  report: reportPath,
};
fs.writeFileSync(reportPath, JSON.stringify(resultado, null, 2));
console.log(JSON.stringify({
  apply: true,
  planilha: planilha.length,
  lojas: lojas.length,
  applyStats,
  spot_check: spot,
  cobertura_amostra: cobertura.slice(0, 5),
  report: reportPath,
}, null, 2));

await pool.end();
