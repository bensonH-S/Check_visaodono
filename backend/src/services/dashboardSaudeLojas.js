/**
 * Saúde por loja — cruza nota, NCs, chamados e CMV teórico do mês.
 */
import { pool } from '../db.js';
import { SQL_NC_CHECKLIST_FINALIZADO } from '../naoConformidadesChecklist.js';
import { filtroSqlLojas } from '../lojasUsuario.js';

const META_CMV = 0.38;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function inicioMesIso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function hojeIso(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** CMV teórico do mês corrente, agrupado por loja (mesma regra do motor). */
async function cmvMesPorLojas(idsLojas, { de, ate, meta = META_CMV } = {}) {
  if (!idsLojas.length) return new Map();

  const params = [idsLojas, de, ate];
  const { rows } = await pool.query(
    `
    WITH linhas AS (
      SELECT
        vi.id_item,
        vi.qtde,
        vi.venda_liquida,
        vi.sem_ficha,
        v.id_loja,
        COALESCE(vi.id_produto, p.id_produto) AS id_produto,
        COALESCE(p.requer_ficha, TRUE) AS requer_ficha,
        EXISTS (
          SELECT 1 FROM ficha_tecnica f
          WHERE f.id_produto = COALESCE(vi.id_produto, p.id_produto) AND f.ativo
        ) AS tem_ficha
      FROM estoque_vendas v
      JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
      LEFT JOIN produtos p ON p.id_loja = v.id_loja AND p.codigo = vi.codigo
      WHERE v.id_loja = ANY($1::int[])
        AND v.data_venda >= $2::date
        AND v.data_venda <= $3::date
    ),
    custos AS (
      SELECT
        l.id_loja,
        l.qtde,
        l.venda_liquida,
        l.requer_ficha,
        l.tem_ficha,
        l.sem_ficha,
        COALESCE((
          SELECT SUM(
            COALESCE(fi.qtde_estoque, fi.quantidade) *
            CASE WHEN ins.custo_fonte IN ('nf', 'manual') THEN COALESCE(ins.valor_unidade, 0) ELSE 0 END
          )
          FROM ficha_tecnica f
          JOIN ficha_tecnica_itens fi ON fi.id_ficha = f.id_ficha
          LEFT JOIN insumos ins
            ON ins.id_loja = l.id_loja AND UPPER(ins.codigo) = UPPER(fi.codigo_insumo)
          WHERE f.id_produto = l.id_produto AND f.ativo
        ), 0) AS custo_unit_valido,
        COALESCE((
          SELECT COUNT(*)::int
          FROM ficha_tecnica f
          JOIN ficha_tecnica_itens fi ON fi.id_ficha = f.id_ficha
          LEFT JOIN insumos ins
            ON ins.id_loja = l.id_loja AND UPPER(ins.codigo) = UPPER(fi.codigo_insumo)
          WHERE f.id_produto = l.id_produto AND f.ativo
            AND (ins.id_insumo IS NULL OR ins.custo_fonte IS NULL OR ins.custo_fonte NOT IN ('nf', 'manual'))
        ), 0) AS insumos_sem_custo_nf
      FROM linhas l
    )
    SELECT
      id_loja,
      COALESCE(SUM(venda_liquida), 0)::numeric AS venda_liquida,
      COALESCE(SUM(qtde * custo_unit_valido), 0)::numeric AS custo_teorico,
      COUNT(*)::int AS itens,
      COUNT(*) FILTER (WHERE tem_ficha)::int AS itens_com_ficha,
      COUNT(*) FILTER (
        WHERE tem_ficha AND insumos_sem_custo_nf = 0 AND custo_unit_valido > 0
      )::int AS itens_com_custo_completo
    FROM custos
    GROUP BY id_loja
    `,
    params,
  );

  const metaN = num(meta, META_CMV);
  const out = new Map();
  for (const r of rows) {
    const venda = num(r.venda_liquida);
    const custo = num(r.custo_teorico);
    const comFicha = r.itens_com_ficha || 0;
    const comCusto = r.itens_com_custo_completo || 0;
    const cobertura = comFicha > 0 ? (comCusto / comFicha) * 100 : 0;
    const confiavel = cobertura >= 80 && venda > 0 && custo > 0;
    const pct = confiavel ? custo / venda : null;
    out.set(Number(r.id_loja), {
      cmv_teorico_pct: pct != null ? Math.round(pct * 10000) / 100 : null,
      meta_pct: Math.round(metaN * 10000) / 100,
      cmv_confiavel: confiavel,
      cobertura_custo_pct: Math.round(cobertura * 10) / 10,
    });
  }
  return out;
}

function classificarLoja({
  nota,
  ncsAbertas,
  ncsCriticas,
  chamadosAbertos,
  cmvPct,
  cmvConfiavel,
  metaPct,
}) {
  let score = 0;
  const motivos = [];

  if (nota == null || Number.isNaN(nota) || nota <= 0) {
    score += 10;
    motivos.push('Sem visita finalizada');
  } else if (nota < 60) {
    score += 50;
    motivos.push(`Nota crítica ${nota.toFixed(1)}`);
  } else if (nota < 75) {
    score += 30;
    motivos.push(`Nota baixa ${nota.toFixed(1)}`);
  } else if (nota < 80) {
    score += 10;
    motivos.push(`Nota ${nota.toFixed(1)} (abaixo de 80)`);
  }

  if (ncsCriticas > 0) {
    score += 40;
    motivos.push(
      ncsCriticas === 1 ? '1 NC crítica' : `${ncsCriticas} NCs críticas`,
    );
  }
  if (ncsAbertas > 0) {
    score += Math.min(ncsAbertas, 3) * 8;
    if (ncsCriticas === 0) {
      motivos.push(ncsAbertas === 1 ? '1 NC aberta' : `${ncsAbertas} NCs abertas`);
    }
  }

  if (chamadosAbertos > 0) {
    score += Math.min(chamadosAbertos, 3) * 10;
    motivos.push(
      chamadosAbertos === 1
        ? '1 chamado aberto'
        : `${chamadosAbertos} chamados abertos`,
    );
  }

  if (cmvConfiavel && cmvPct != null && cmvPct > metaPct) {
    const gap = Math.round((cmvPct - metaPct) * 10) / 10;
    score += 25 + Math.min(gap * 2, 20);
    motivos.push(`CMV ${cmvPct.toFixed(1)}% (meta ${metaPct}%)`);
  }

  let nivel = 'ok';
  if (score >= 50) nivel = 'critica';
  else if (score >= 20) nivel = 'atencao';

  if (!motivos.length) motivos.push('Operação estável');

  return { score, nivel, motivos: motivos.slice(0, 4) };
}

/**
 * @param {object} user — req.user com lojas_ids
 */
export async function listarSaudeLojas(user) {
  const de = inicioMesIso();
  const ate = hojeIso();
  const params = [];
  const filtro = filtroSqlLojas(user, 'l', 'id_loja', params);

  const { rows } = await pool.query(
    `
    SELECT
      l.id_loja,
      l.name,
      l.bk_number,
      l.city,
      l.neighborhood,
      l.nota_atual,
      l.ultima_visita,
      COALESCE(nc.ncs_abertas, 0)::int AS ncs_abertas,
      COALESCE(nc.ncs_criticas, 0)::int AS ncs_criticas,
      COALESCE(ch.chamados_abertos, 0)::int AS chamados_abertos
    FROM lojas l
    LEFT JOIN (
      SELECT
        nc.id_loja,
        COUNT(*)::int AS ncs_abertas,
        COUNT(*) FILTER (WHERE nc.gravidade = 'Crítica')::int AS ncs_criticas
      FROM nao_conformidades nc
      ${SQL_NC_CHECKLIST_FINALIZADO}
      WHERE nc.status = 'Em aberto'
      GROUP BY nc.id_loja
    ) nc ON nc.id_loja = l.id_loja
    LEFT JOIN (
      SELECT
        c.id_loja,
        COUNT(*)::int AS chamados_abertos
      FROM manut_chamados c
      WHERE c.status::text NOT IN ('concluido', 'cancelado')
      GROUP BY c.id_loja
    ) ch ON ch.id_loja = l.id_loja
    WHERE l.is_active = TRUE
      AND l.bk_number IS NOT NULL
      ${filtro}
    ORDER BY l.name
    `,
    params,
  );

  const ids = rows.map((r) => Number(r.id_loja));
  let cmvMap = new Map();
  try {
    cmvMap = await cmvMesPorLojas(ids, { de, ate, meta: META_CMV });
  } catch {
    // Estoque pode não estar disponível em algum ambiente — saúde segue sem CMV
    cmvMap = new Map();
  }

  const lojas = rows.map((r) => {
    const id = Number(r.id_loja);
    const notaRaw = r.nota_atual != null ? num(r.nota_atual) : null;
    const nota =
      r.ultima_visita && notaRaw != null && notaRaw > 0 ? notaRaw : null;
    const ncsAbertas = Number(r.ncs_abertas) || 0;
    const ncsCriticas = Number(r.ncs_criticas) || 0;
    const chamadosAbertos = Number(r.chamados_abertos) || 0;
    const cmv = cmvMap.get(id) || {
      cmv_teorico_pct: null,
      meta_pct: META_CMV * 100,
      cmv_confiavel: false,
      cobertura_custo_pct: 0,
    };

    const { score, nivel, motivos } = classificarLoja({
      nota,
      ncsAbertas,
      ncsCriticas,
      chamadosAbertos,
      cmvPct: cmv.cmv_teorico_pct,
      cmvConfiavel: cmv.cmv_confiavel,
      metaPct: cmv.meta_pct,
    });

    return {
      id_loja: id,
      name: r.name,
      bk_number: r.bk_number,
      city: r.city,
      neighborhood: r.neighborhood,
      nota_atual: nota,
      ultima_visita: r.ultima_visita,
      ncs_abertas: ncsAbertas,
      ncs_criticas: ncsCriticas,
      chamados_abertos: chamadosAbertos,
      cmv_teorico_pct: cmv.cmv_teorico_pct,
      cmv_meta_pct: cmv.meta_pct,
      cmv_confiavel: cmv.cmv_confiavel,
      nivel,
      score,
      motivos,
    };
  });

  lojas.sort((a, b) => {
    const ordem = { critica: 0, atencao: 1, ok: 2 };
    const d = (ordem[a.nivel] ?? 9) - (ordem[b.nivel] ?? 9);
    if (d !== 0) return d;
    if (b.score !== a.score) return b.score - a.score;
    return String(a.name).localeCompare(String(b.name), 'pt-BR');
  });

  const resumo = {
    total: lojas.length,
    criticas: lojas.filter((l) => l.nivel === 'critica').length,
    atencao: lojas.filter((l) => l.nivel === 'atencao').length,
    ok: lojas.filter((l) => l.nivel === 'ok').length,
  };

  return {
    periodo: { de, ate },
    resumo,
    lojas,
  };
}
