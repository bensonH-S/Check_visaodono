/**
 * Saúde por loja — cruza nota, NCs, chamados, CMV, metas e região.
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

function diasEntre(isoDate, hoje = new Date()) {
  if (!isoDate) return null;
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((hoje.getTime() - d.getTime()) / 86400000));
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
      venda_liquida: Math.round(venda * 100) / 100,
    });
  }
  return out;
}

/** Resumo de metas do período mais recente, por loja. */
async function metasPorLojas(idsLojas) {
  const out = new Map();
  if (!idsLojas.length) return { periodo: null, map: out };

  let periodo;
  try {
    const { rows } = await pool.query(
      `SELECT id_periodo, ano, mes, titulo
       FROM metas_periodos
       ORDER BY ano DESC, mes DESC
       LIMIT 1`,
    );
    periodo = rows[0] || null;
  } catch {
    return { periodo: null, map: out };
  }
  if (!periodo) return { periodo: null, map: out };

  try {
    const { rows } = await pool.query(
      `
      SELECT
        pl.id_loja,
        COUNT(*)::int AS indicadores,
        COUNT(*) FILTER (
          WHERE r.valor_texto = 'OK'
             OR (r.valor_texto IS DISTINCT FROM 'X' AND r.atingiu IS TRUE)
        )::int AS ok,
        COUNT(*) FILTER (
          WHERE r.valor_texto = 'X'
             OR (r.valor_texto IS DISTINCT FROM 'OK' AND r.atingiu IS FALSE)
        )::int AS falhou,
        COUNT(*) FILTER (
          WHERE r.id_realizado IS NULL
             OR (
               (r.valor_texto IS NULL OR r.valor_texto = '')
               AND r.atingiu IS NULL
             )
        )::int AS pendentes,
        COALESCE(SUM(pi.peso), 0)::numeric AS meta_peso,
        COALESCE(SUM(pi.peso) FILTER (
          WHERE r.valor_texto = 'OK'
             OR (r.valor_texto IS DISTINCT FROM 'X' AND r.atingiu IS TRUE)
        ), 0)::numeric AS realizado_peso
      FROM metas_paineis p
      JOIN metas_painel_indicadores pi ON pi.id_painel = p.id_painel
      JOIN metas_painel_lojas pl ON pl.id_painel = p.id_painel
      LEFT JOIN metas_realizados r
        ON r.id_painel = p.id_painel
       AND r.id_indicador = pi.id_indicador
       AND r.id_loja = pl.id_loja
      WHERE p.id_periodo = $1
        AND pl.id_loja = ANY($2::int[])
      GROUP BY pl.id_loja
      `,
      [periodo.id_periodo, idsLojas],
    );

    for (const r of rows) {
      const indicadores = Number(r.indicadores) || 0;
      const ok = Number(r.ok) || 0;
      const falhou = Number(r.falhou) || 0;
      const pendentes = Number(r.pendentes) || 0;
      const metaPeso = num(r.meta_peso);
      const realizadoPeso = num(r.realizado_peso);
      const pct =
        metaPeso > 0 ? Math.round((realizadoPeso / metaPeso) * 1000) / 10 : null;
      out.set(Number(r.id_loja), {
        indicadores,
        ok,
        falhou,
        pendentes,
        meta_peso: Math.round(metaPeso),
        realizado_peso: Math.round(realizadoPeso),
        pct_atingido: pct,
        tem_dados: indicadores > 0 && ok + falhou > 0,
      });
    }
  } catch {
    return { periodo: null, map: out };
  }

  return {
    periodo: {
      id_periodo: periodo.id_periodo,
      ano: periodo.ano,
      mes: periodo.mes,
      titulo: periodo.titulo,
    },
    map: out,
  };
}

function classificarLoja({
  nota,
  diasSemVisita,
  ncsAbertas,
  ncsCriticas,
  chamadosAbertos,
  chamadosUrgentes,
  chamadosSla,
  cmvPct,
  cmvConfiavel,
  metaPct,
  metas,
}) {
  let score = 0;
  const motivos = [];

  if (nota == null || Number.isNaN(nota) || nota <= 0) {
    score += 15;
    motivos.push('Sem visita finalizada');
  } else if (nota < 60) {
    score += 50;
    motivos.push(`Nota crítica ${nota.toFixed(1)}`);
  } else if (nota < 75) {
    score += 30;
    motivos.push(`Nota baixa ${nota.toFixed(1)}`);
  } else if (nota < 80) {
    score += 12;
    motivos.push(`Nota ${nota.toFixed(1)} (abaixo de 80)`);
  }

  if (diasSemVisita != null && diasSemVisita >= 45) {
    score += 20;
    motivos.push(`Sem visita há ${diasSemVisita} dias`);
  } else if (diasSemVisita != null && diasSemVisita >= 30) {
    score += 10;
    motivos.push(`Última visita há ${diasSemVisita} dias`);
  }

  if (ncsCriticas > 0) {
    score += 40 + Math.min(ncsCriticas - 1, 5) * 4;
    motivos.push(
      ncsCriticas === 1 ? '1 NC crítica' : `${ncsCriticas} NCs críticas`,
    );
  } else if (ncsAbertas > 0) {
    score += Math.min(ncsAbertas, 4) * 8;
    motivos.push(ncsAbertas === 1 ? '1 NC aberta' : `${ncsAbertas} NCs abertas`);
  }

  if (chamadosSla > 0) {
    score += 35;
    motivos.push(
      chamadosSla === 1
        ? '1 chamado com SLA estourado'
        : `${chamadosSla} chamados com SLA estourado`,
    );
  } else if (chamadosUrgentes > 0) {
    score += 18;
    motivos.push(
      chamadosUrgentes === 1
        ? '1 chamado urgente'
        : `${chamadosUrgentes} chamados urgentes`,
    );
  } else if (chamadosAbertos > 0) {
    score += Math.min(chamadosAbertos, 3) * 8;
    motivos.push(
      chamadosAbertos === 1
        ? '1 chamado aberto'
        : `${chamadosAbertos} chamados abertos`,
    );
  }

  if (cmvConfiavel && cmvPct != null && cmvPct > metaPct) {
    const gap = Math.round((cmvPct - metaPct) * 10) / 10;
    score += 25 + Math.min(gap * 2, 25);
    motivos.push(`CMV ${cmvPct.toFixed(1)}% (meta ${metaPct}%)`);
  }

  if (metas?.tem_dados) {
    if (metas.falhou > 0) {
      score += 15 + Math.min(metas.falhou, 4) * 5;
      motivos.push(
        metas.falhou === 1
          ? '1 meta em X'
          : `${metas.falhou} metas em X`,
      );
    }
    if (metas.pct_atingido != null && metas.pct_atingido < 50 && metas.indicadores >= 2) {
      score += 12;
      if (!motivos.some((m) => m.includes('meta'))) {
        motivos.push(`Metas ${metas.pct_atingido}% atingidas`);
      }
    }
  }

  let nivel = 'ok';
  if (score >= 50) nivel = 'critica';
  else if (score >= 20) nivel = 'atencao';

  if (!motivos.length) motivos.push('Operação estável');

  return { score, nivel, motivos: motivos.slice(0, 5) };
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
      COALESCE(ch.chamados_abertos, 0)::int AS chamados_abertos,
      COALESCE(ch.chamados_urgentes, 0)::int AS chamados_urgentes,
      COALESCE(ch.chamados_sla, 0)::int AS chamados_sla,
      COALESCE(vm.visitas_mes, 0)::int AS visitas_mes,
      reg.regiao_nome
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
        COUNT(*)::int AS chamados_abertos,
        COUNT(*) FILTER (
          WHERE c.urgencia::text IN ('alta', 'critica')
        )::int AS chamados_urgentes,
        COUNT(*) FILTER (
          WHERE c.prazo_sla IS NOT NULL AND c.prazo_sla < NOW()
        )::int AS chamados_sla
      FROM manut_chamados c
      WHERE c.status::text NOT IN ('concluido', 'cancelado')
      GROUP BY c.id_loja
    ) ch ON ch.id_loja = l.id_loja
    LEFT JOIN (
      SELECT id_loja, COUNT(*)::int AS visitas_mes
      FROM visitas
      WHERE data_visita >= date_trunc('month', CURRENT_DATE)::date
        AND status = 'Finalizada'
      GROUP BY id_loja
    ) vm ON vm.id_loja = l.id_loja
    LEFT JOIN LATERAL (
      SELECT r.nome AS regiao_nome
      FROM frota_regiao_lojas rl
      JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
      WHERE rl.id_loja = l.id_loja
      ORDER BY r.nome
      LIMIT 1
    ) reg ON TRUE
    WHERE l.is_active = TRUE
      AND l.bk_number IS NOT NULL
      ${filtro}
    ORDER BY l.name
    `,
    params,
  );

  const ids = rows.map((r) => Number(r.id_loja));

  const [cmvMap, metasPack] = await Promise.all([
    cmvMesPorLojas(ids, { de, ate, meta: META_CMV }).catch(() => new Map()),
    metasPorLojas(ids),
  ]);

  const lojas = rows.map((r) => {
    const id = Number(r.id_loja);
    const notaRaw = r.nota_atual != null ? num(r.nota_atual) : null;
    const nota =
      r.ultima_visita && notaRaw != null && notaRaw > 0 ? notaRaw : null;
    const diasSemVisita = diasEntre(r.ultima_visita);
    const ncsAbertas = Number(r.ncs_abertas) || 0;
    const ncsCriticas = Number(r.ncs_criticas) || 0;
    const chamadosAbertos = Number(r.chamados_abertos) || 0;
    const chamadosUrgentes = Number(r.chamados_urgentes) || 0;
    const chamadosSla = Number(r.chamados_sla) || 0;
    const visitasMes = Number(r.visitas_mes) || 0;
    const cmv = cmvMap.get(id) || {
      cmv_teorico_pct: null,
      meta_pct: META_CMV * 100,
      cmv_confiavel: false,
      cobertura_custo_pct: 0,
      venda_liquida: null,
    };
    const metas = metasPack.map.get(id) || null;

    const { score, nivel, motivos } = classificarLoja({
      nota,
      diasSemVisita,
      ncsAbertas,
      ncsCriticas,
      chamadosAbertos,
      chamadosUrgentes,
      chamadosSla,
      cmvPct: cmv.cmv_teorico_pct,
      cmvConfiavel: cmv.cmv_confiavel,
      metaPct: cmv.meta_pct,
      metas,
    });

    return {
      id_loja: id,
      name: r.name,
      bk_number: r.bk_number,
      city: r.city,
      neighborhood: r.neighborhood,
      regiao: r.regiao_nome || null,
      nota_atual: nota,
      ultima_visita: r.ultima_visita,
      dias_sem_visita: diasSemVisita,
      visitas_mes: visitasMes,
      ncs_abertas: ncsAbertas,
      ncs_criticas: ncsCriticas,
      chamados_abertos: chamadosAbertos,
      chamados_urgentes: chamadosUrgentes,
      chamados_sla_estourado: chamadosSla,
      cmv_teorico_pct: cmv.cmv_teorico_pct,
      cmv_meta_pct: cmv.meta_pct,
      cmv_confiavel: cmv.cmv_confiavel,
      cmv_cobertura_pct: cmv.cobertura_custo_pct ?? null,
      metas: metas
        ? {
            ok: metas.ok,
            falhou: metas.falhou,
            pendentes: metas.pendentes,
            indicadores: metas.indicadores,
            meta_peso: metas.meta_peso,
            realizado_peso: metas.realizado_peso,
            pct_atingido: metas.pct_atingido,
            tem_dados: metas.tem_dados,
          }
        : null,
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
    com_nc: lojas.filter((l) => l.ncs_abertas > 0).length,
    com_chamado: lojas.filter((l) => l.chamados_abertos > 0).length,
    cmv_alto: lojas.filter(
      (l) =>
        l.cmv_confiavel &&
        l.cmv_teorico_pct != null &&
        l.cmv_teorico_pct > l.cmv_meta_pct,
    ).length,
    metas_atrasadas: lojas.filter((l) => (l.metas?.falhou || 0) > 0).length,
  };

  return {
    periodo: { de, ate },
    metas_periodo: metasPack.periodo,
    resumo,
    lojas,
  };
}
