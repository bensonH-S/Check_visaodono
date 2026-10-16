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
    /** Sempre calcula o % quando há venda e custo; cmv_confiavel indica se dá para confiar. */
    const pct = venda > 0 && custo > 0 ? custo / venda : null;
    out.set(Number(r.id_loja), {
      cmv_teorico_pct: pct != null ? Math.round(pct * 10000) / 100 : null,
      meta_pct: Math.round(metaN * 10000) / 100,
      cmv_confiavel: confiavel,
      cobertura_custo_pct: Math.round(cobertura * 10) / 10,
      venda_liquida: Math.round(venda * 100) / 100,
      custo_teorico: Math.round(custo * 100) / 100,
    });
  }
  return out;
}

/** Compras do mês (NF por vencimento + entradas manuais) — base do CMP. */
async function comprasMesPorLojas(idsLojas, { de, ate } = {}) {
  if (!idsLojas.length) return new Map();
  const params = [idsLojas, de, ate];
  const { rows } = await pool.query(
    `
    WITH nf AS (
      SELECT
        n.id_loja,
        COALESCE(SUM(n.valor_total), 0)::numeric AS valor
      FROM estoque_nfe n
      WHERE n.id_loja = ANY($1::int[])
        AND COALESCE(n.status, '') <> 'erro'
        AND COALESCE(n.data_vencimento, n.emissao::date) >= $2::date
        AND COALESCE(n.data_vencimento, n.emissao::date) <= $3::date
      GROUP BY n.id_loja
    ),
    man AS (
      SELECT
        m.id_loja,
        COALESCE(SUM(
          m.quantidade * CASE
            WHEN i.custo_fonte IN ('nf', 'manual', 'catalogo') THEN COALESCE(i.valor_unidade, 0)
            ELSE 0
          END
        ), 0)::numeric AS valor
      FROM estoque_movimentos m
      JOIN insumos i ON i.id_insumo = m.id_insumo
      WHERE m.id_loja = ANY($1::int[])
        AND m.tipo = 'entrada'
        AND COALESCE(m.referencia_tipo, '') <> 'estoque_nfe'
        AND COALESCE(i.entra_cmv, TRUE)
        AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) >= $2::date
        AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) <= $3::date
      GROUP BY m.id_loja
    )
    SELECT
      COALESCE(nf.id_loja, man.id_loja) AS id_loja,
      (COALESCE(nf.valor, 0) + COALESCE(man.valor, 0))::numeric AS compras_valor
    FROM nf
    FULL OUTER JOIN man ON man.id_loja = nf.id_loja
    `,
    params,
  );
  const out = new Map();
  for (const r of rows) {
    out.set(Number(r.id_loja), Math.round(num(r.compras_valor) * 100) / 100);
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
 * @param {object} user — req.user com lojas_ids / lojas_ids_estoque
 */
export async function listarSaudeLojas(user, opts = {}) {
  const de = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.de || '')) ? opts.de : inicioMesIso();
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.ate || '')) ? opts.ate : hojeIso();
  const params = [];
  // Estoque/indicadores: preferir lojas_ids_estoque (região + fallback usuario_lojas).
  const userEscopo = user?.lojas_ids_estoque?.length
    ? { ...user, lojas_ids: user.lojas_ids_estoque }
    : user;
  const filtro = filtroSqlLojas(userEscopo, 'l', 'id_loja', params);

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

  const [cmvMap, comprasMap, metasPack] = await Promise.all([
    cmvMesPorLojas(ids, { de, ate, meta: META_CMV }).catch(() => new Map()),
    comprasMesPorLojas(ids, { de, ate }).catch(() => new Map()),
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
      venda_liquida: 0,
      custo_teorico: 0,
    };
    const vendaLiquida = num(cmv.venda_liquida);
    const comprasValor = num(comprasMap.get(id));
    const cmpPct = vendaLiquida > 0 && comprasValor > 0
      ? Math.round((comprasValor / vendaLiquida) * 10000) / 100
      : null;
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
      venda_liquida: vendaLiquida,
      compras_valor: comprasValor,
      /** CMP = mercadoria paga (compras) / vendas do mês. */
      cmp_pct: cmpPct,
      cmv_teorico_pct: cmv.cmv_teorico_pct,
      cmv_meta_pct: cmv.meta_pct,
      cmv_confiavel: cmv.cmv_confiavel,
      cmv_cobertura_pct: cmv.cobertura_custo_pct ?? null,
      custo_teorico: num(cmv.custo_teorico),
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

  const comCmv = lojas.filter((l) => l.cmv_teorico_pct != null);
  const comCmp = lojas.filter((l) => l.cmp_pct != null);
  const vendaTotal = lojas.reduce((s, l) => s + (l.venda_liquida || 0), 0);
  const comprasTotal = lojas.reduce((s, l) => s + (l.compras_valor || 0), 0);
  const resumo = {
    total: lojas.length,
    criticas: lojas.filter((l) => l.nivel === 'critica').length,
    atencao: lojas.filter((l) => l.nivel === 'atencao').length,
    ok: lojas.filter((l) => l.nivel === 'ok').length,
    com_nc: lojas.filter((l) => l.ncs_abertas > 0).length,
    sem_nc: lojas.filter((l) => l.ncs_abertas === 0).length,
    com_chamado: lojas.filter((l) => l.chamados_abertos > 0).length,
    cmv_alto: lojas.filter(
      (l) =>
        l.cmv_teorico_pct != null &&
        l.cmv_teorico_pct > l.cmv_meta_pct,
    ).length,
    metas_atrasadas: lojas.filter((l) => (l.metas?.falhou || 0) > 0).length,
    venda_liquida: Math.round(vendaTotal * 100) / 100,
    compras_valor: Math.round(comprasTotal * 100) / 100,
    cmp_pct: vendaTotal > 0 && comprasTotal > 0
      ? Math.round((comprasTotal / vendaTotal) * 10000) / 100
      : null,
    cmv_medio_pct: comCmv.length
      ? Math.round(
        (comCmv.reduce((s, l) => s + l.cmv_teorico_pct, 0) / comCmv.length) * 10,
      ) / 10
      : null,
    cmp_medio_pct: comCmp.length
      ? Math.round(
        (comCmp.reduce((s, l) => s + l.cmp_pct, 0) / comCmp.length) * 10,
      ) / 10
      : null,
  };

  return {
    periodo: { de, ate },
    metas_periodo: metasPack.periodo,
    resumo,
    lojas,
  };
}

function addDiasIso(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasNoIntervalo(de, ate) {
  const a = new Date(`${de}T12:00:00Z`).getTime();
  const b = new Date(`${ate}T12:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Venda líquida + custo teórico por dia (todas as lojas do escopo somadas). */
async function serieVendaCustoDiaria(ids, de, ate, idsCmv = []) {
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `
    WITH linhas AS (
      SELECT
        v.data_venda,
        v.id_loja,
        vi.qtde,
        vi.venda_liquida,
        COALESCE(vi.id_produto, p.id_produto) AS id_produto
      FROM estoque_vendas v
      JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
      LEFT JOIN produtos p ON p.id_loja = v.id_loja AND p.codigo = vi.codigo
      WHERE v.id_loja = ANY($1::int[])
        AND v.data_venda >= $2::date
        AND v.data_venda <= $3::date
    )
    SELECT
      l.data_venda::text AS dia,
      COALESCE(SUM(l.venda_liquida), 0)::float8 AS venda,
      COALESCE(SUM(l.venda_liquida) FILTER (WHERE l.id_loja = ANY($4::int[])), 0)::float8 AS venda_cmv,
      COALESCE(SUM(l.qtde * COALESCE((
        SELECT SUM(
          COALESCE(fi.qtde_estoque, fi.quantidade) *
          CASE WHEN ins.custo_fonte IN ('nf', 'manual') THEN COALESCE(ins.valor_unidade, 0) ELSE 0 END
        )
        FROM ficha_tecnica f
        JOIN ficha_tecnica_itens fi ON fi.id_ficha = f.id_ficha
        LEFT JOIN insumos ins
          ON ins.id_loja = l.id_loja AND UPPER(ins.codigo) = UPPER(fi.codigo_insumo)
        WHERE f.id_produto = l.id_produto AND f.ativo
      ), 0)) FILTER (WHERE l.id_loja = ANY($4::int[])), 0)::float8 AS custo
    FROM linhas l
    GROUP BY l.data_venda
    ORDER BY l.data_venda
    `,
    [ids, de, ate, idsCmv],
  );
  return rows;
}

/** Compras (NF por vencimento) por dia. */
async function serieComprasDiaria(ids, de, ate) {
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `
    SELECT
      COALESCE(n.data_vencimento, n.emissao::date)::text AS dia,
      COALESCE(SUM(n.valor_total), 0)::float8 AS compras
    FROM estoque_nfe n
    WHERE n.id_loja = ANY($1::int[])
      AND COALESCE(n.status, '') <> 'erro'
      AND COALESCE(n.data_vencimento, n.emissao::date) >= $2::date
      AND COALESCE(n.data_vencimento, n.emissao::date) <= $3::date
    GROUP BY 1
    ORDER BY 1
    `,
    [ids, de, ate],
  );
  return rows;
}

/** NCs cadastradas no período, por loja. */
async function ncsNovasPorLoja(ids, de, ate) {
  if (!ids.length) return new Map();
  const { rows } = await pool.query(
    `
    SELECT nc.id_loja, COUNT(*)::int AS qtd
    FROM nao_conformidades nc
    ${SQL_NC_CHECKLIST_FINALIZADO}
    WHERE nc.id_loja = ANY($1::int[])
      AND nc.data_cadastro >= $2::date
      AND nc.data_cadastro <= $3::date
    GROUP BY nc.id_loja
    `,
    [ids, de, ate],
  );
  return new Map(rows.map((r) => [Number(r.id_loja), Number(r.qtd) || 0]));
}

/** Meta operacional de CMV (planilha regional ~40%). */
const META_CMV_NF = 40;

/**
 * Grupo CMV: só Platlog, Ambev/Coca, Gimba e Uniforme.
 * Notas SEFAZ entram se o emitente casar com esses fornecedores.
 */
const SQL_GRUPO_CMV_NF = `
  CASE
    WHEN lower(coalesce(n.fornecedor, '')) = 'platlog'
      OR lower(coalesce(n.emitente_nome, '')) LIKE '%platlog%' THEN 'platlog'
    WHEN lower(coalesce(n.fornecedor, '')) = 'coca'
      OR lower(coalesce(n.emitente_nome, ''))
           ~ 'brasal|ambev|coca.?cola|refrescos bandeirantes' THEN 'ambev_coca'
    WHEN lower(coalesce(n.fornecedor, '')) = 'gimba'
      OR lower(coalesce(n.emitente_nome, '')) LIKE '%gimba%' THEN 'gimba'
    WHEN lower(coalesce(n.fornecedor, '')) IN ('idealwork', 'uniforme')
      OR lower(coalesce(n.emitente_nome, '')) ~ 'ideal.?work|uniforme' THEN 'uniforme'
    ELSE NULL
  END
`;

/** Data em que a NF passa a contar no CMV = confirmação de entrada do gestor. */
const SQL_DATA_CMV_NF = `
  COALESCE(
    n.entrada_em::date,
    n.data_entrega,
    n.data_saida,
    n.data_vencimento,
    n.emissao::date
  )
`;

function fimMesIso(iso) {
  const [y, m] = String(iso).slice(0, 10).split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

function weekdayIso(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function round1(n) {
  return Math.round(num(n) * 10) / 10;
}

/**
 * CMV operacional: NFs com entrada_registrada dos 4 fornecedores, por loja.
 * @returns {Map<number, { total, platlog, ambev_coca, gimba, uniforme, nfs }>}
 */
async function cmvNfConfirmadaPorLojas(ids, de, ate) {
  const out = new Map();
  if (!ids.length) return out;
  for (const id of ids) {
    out.set(id, {
      total: 0,
      platlog: 0,
      ambev_coca: 0,
      gimba: 0,
      uniforme: 0,
      nfs: 0,
    });
  }
  const { rows } = await pool.query(
    `
    SELECT
      n.id_loja,
      ${SQL_GRUPO_CMV_NF} AS grupo,
      COUNT(*)::int AS nfs,
      COALESCE(SUM(n.valor_total), 0)::float8 AS valor
    FROM estoque_nfe n
    WHERE n.id_loja = ANY($1::int[])
      AND n.entrada_registrada = TRUE
      AND COALESCE(n.status, '') <> 'erro'
      AND ${SQL_DATA_CMV_NF} >= $2::date
      AND ${SQL_DATA_CMV_NF} <= $3::date
      AND (${SQL_GRUPO_CMV_NF}) IS NOT NULL
    GROUP BY n.id_loja, 2
    `,
    [ids, de, ate],
  );
  for (const r of rows) {
    const id = Number(r.id_loja);
    const g = out.get(id) || {
      total: 0, platlog: 0, ambev_coca: 0, gimba: 0, uniforme: 0, nfs: 0,
    };
    const valor = round2(r.valor);
    const grupo = String(r.grupo);
    if (grupo in g) g[grupo] = valor;
    g.total = round2(g.total + valor);
    g.nfs += Number(r.nfs) || 0;
    out.set(id, g);
  }
  return out;
}

/** Gasto CMV confirmado por dia (escopo somado), para a série. */
async function serieCmvNfDiaria(ids, de, ate) {
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `
    SELECT
      (${SQL_DATA_CMV_NF})::text AS dia,
      COALESCE(SUM(n.valor_total), 0)::float8 AS gasto
    FROM estoque_nfe n
    WHERE n.id_loja = ANY($1::int[])
      AND n.entrada_registrada = TRUE
      AND COALESCE(n.status, '') <> 'erro'
      AND ${SQL_DATA_CMV_NF} >= $2::date
      AND ${SQL_DATA_CMV_NF} <= $3::date
      AND (${SQL_GRUPO_CMV_NF}) IS NOT NULL
    GROUP BY 1
    ORDER BY 1
    `,
    [ids, de, ate],
  );
  return rows.map((r) => ({ dia: r.dia, gasto: round2(r.gasto) }));
}

/** Venda líquida diária por loja (e histórico para média por dia da semana). */
async function vendasDiariasPorLoja(ids, de, ate) {
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `
    SELECT
      v.id_loja,
      v.data_venda::text AS dia,
      COALESCE(SUM(vi.venda_liquida), 0)::float8 AS venda
    FROM estoque_vendas v
    JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE v.id_loja = ANY($1::int[])
      AND v.data_venda >= $2::date
      AND v.data_venda <= $3::date
    GROUP BY v.id_loja, v.data_venda
    ORDER BY v.data_venda
    `,
    [ids, de, ate],
  );
  return rows;
}

/**
 * Projeção de faturamento do mês por loja.
 * - simples: média diária × dias do mês
 * - inteligente: realizado + média histórica do mesmo weekday nos dias restantes
 */
function montarProjecoes(ids, vendasRows, inicioMes, ate, fimMes) {
  const diasMes = diasNoIntervalo(inicioMes, fimMes);
  const diasDecorridos = diasNoIntervalo(inicioMes, ate);
  const porLojaDia = new Map(); // id -> Map(dia -> venda)
  for (const r of vendasRows) {
    const id = Number(r.id_loja);
    if (!porLojaDia.has(id)) porLojaDia.set(id, new Map());
    porLojaDia.get(id).set(r.dia, num(r.venda));
  }

  const out = new Map();
  for (const id of ids) {
    const diasMap = porLojaDia.get(id) || new Map();
    let vendaMtd = 0;
    for (let i = 0; i < diasDecorridos; i += 1) {
      vendaMtd += diasMap.get(addDiasIso(inicioMes, i)) || 0;
    }
    const mediaDia = diasDecorridos > 0 ? vendaMtd / diasDecorridos : 0;
    const projSimples = round2(mediaDia * diasMes);

    /** Médias por weekday usando histórico disponível (até `ate`). */
    const somaWd = Array(7).fill(0);
    const qtdWd = Array(7).fill(0);
    for (const [dia, venda] of diasMap) {
      if (dia > ate) continue;
      const wd = weekdayIso(dia);
      somaWd[wd] += venda;
      qtdWd[wd] += 1;
    }
    const mediaWd = somaWd.map((s, i) => (qtdWd[i] > 0 ? s / qtdWd[i] : mediaDia));

    let previstoRestante = 0;
    const diasRestantes = Math.max(0, diasMes - diasDecorridos);
    for (let i = 1; i <= diasRestantes; i += 1) {
      const dia = addDiasIso(ate, i);
      if (dia > fimMes) break;
      previstoRestante += mediaWd[weekdayIso(dia)] || mediaDia;
    }
    const projInteligente = round2(vendaMtd + previstoRestante);

    out.set(id, {
      venda_acumulada: round2(vendaMtd),
      dias_decorridos: diasDecorridos,
      dias_mes: diasMes,
      dias_restantes: diasRestantes,
      projecao_simples: projSimples,
      projecao_inteligente: projInteligente,
      media_dia: round2(mediaDia),
      ritmo_dia_meta: null,
    });
  }
  return out;
}

/**
 * Indicadores: período atual × anterior + CMV por NF confirmada + projeção de venda.
 */
export async function indicadoresPeriodo(user, opts = {}) {
  const atual = await listarSaudeLojas(user, opts);
  const { de, ate } = atual.periodo;
  const dias = diasNoIntervalo(de, ate);
  const ateAnt = addDiasIso(de, -1);
  const deAnt = addDiasIso(ateAnt, -(dias - 1));
  const idLoja = Number(opts.id_loja) || null;
  const ids = atual.lojas
    .map((l) => l.id_loja)
    .filter((id) => !idLoja || id === idLoja);

  const inicioMes = `${String(de).slice(0, 8)}01`;
  const fimMes = fimMesIso(de);
  const histDe = addDiasIso(inicioMes, -56);

  const [gastoAtual, gastoAnt, vendasHist, serieVenda, serieGasto, ncsAtual, ncsAnt] = await Promise.all([
    cmvNfConfirmadaPorLojas(ids, de, ate).catch(() => new Map()),
    cmvNfConfirmadaPorLojas(ids, deAnt, ateAnt).catch(() => new Map()),
    vendasDiariasPorLoja(ids, histDe, ate).catch(() => []),
    (async () => {
      if (!ids.length) return [];
      const { rows } = await pool.query(
        `
        SELECT v.data_venda::text AS dia,
               COALESCE(SUM(vi.venda_liquida), 0)::float8 AS venda
        FROM estoque_vendas v
        JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
        WHERE v.id_loja = ANY($1::int[])
          AND v.data_venda >= $2::date
          AND v.data_venda <= $3::date
        GROUP BY v.data_venda
        ORDER BY v.data_venda
        `,
        [ids, de, ate],
      );
      return rows;
    })().catch(() => []),
    serieCmvNfDiaria(ids, de, ate).catch(() => []),
    ncsNovasPorLoja(ids, de, ate).catch(() => new Map()),
    ncsNovasPorLoja(ids, deAnt, ateAnt).catch(() => new Map()),
  ]);

  const projAtual = montarProjecoes(ids, vendasHist, inicioMes, ate, fimMes);

  /** Vendas da janela anterior (mesmo nº de dias), para delta justo. */
  const vendaAntPorLoja = new Map(ids.map((id) => [id, 0]));
  for (const r of vendasHist) {
    const id = Number(r.id_loja);
    if (!vendaAntPorLoja.has(id)) continue;
    if (r.dia >= deAnt && r.dia <= ateAnt) {
      vendaAntPorLoja.set(id, vendaAntPorLoja.get(id) + num(r.venda));
    }
  }

  const anteriorPorLoja = {};
  let vendaAnt = 0;
  const cmvsAnt = [];
  let gastoAntTotal = 0;

  for (const id of ids) {
    const g = gastoAnt.get(id) || { total: 0 };
    const vendaJanela = round2(vendaAntPorLoja.get(id) || 0);
    const cmvPct = vendaJanela > 0 && g.total > 0
      ? round1((g.total / vendaJanela) * 100)
      : null;
    vendaAnt += vendaJanela;
    gastoAntTotal += num(g.total);
    if (cmvPct != null) cmvsAnt.push(cmvPct);
    anteriorPorLoja[id] = {
      venda_liquida: vendaJanela,
      compras_valor: round2(g.total),
      cmv_teorico_pct: cmvPct,
      cmv_pct: cmvPct,
      ncs_novas: ncsAnt.get(id) || 0,
    };
  }

  const gastoPorDia = new Map(serieGasto.map((r) => [r.dia, num(r.gasto)]));
  const vendaPorDia = new Map(serieVenda.map((r) => [r.dia, num(r.venda)]));
  const projRede = ids.reduce((s, id) => s + num(projAtual.get(id)?.projecao_inteligente), 0);

  const serie = [];
  let vendaAcum = 0;
  let gastoAcum = 0;
  for (let i = 0; i < dias; i += 1) {
    const dia = addDiasIso(de, i);
    const venda = vendaPorDia.get(dia) || 0;
    const gasto = gastoPorDia.get(dia) || 0;
    vendaAcum += venda;
    gastoAcum += gasto;
    serie.push({
      dia,
      venda: round2(venda),
      compras: round2(gasto),
      gasto_cmv: round2(gasto),
      cmv_pct: projRede > 0 && gastoAcum > 0
        ? round1((gastoAcum / projRede) * 100)
        : (vendaAcum > 0 && gastoAcum > 0 ? round1((gastoAcum / vendaAcum) * 100) : null),
      cmp_pct: null,
    });
  }

  const cmvsAtual = [];
  let gastoTotal = 0;
  let projTotal = 0;
  let projSimplesTotal = 0;
  let vendaMtdTotal = 0;

  for (const l of atual.lojas) {
    if (idLoja && l.id_loja !== idLoja) continue;
    const g = gastoAtual.get(l.id_loja) || {
      total: 0, platlog: 0, ambev_coca: 0, gimba: 0, uniforme: 0, nfs: 0,
    };
    const p = projAtual.get(l.id_loja) || {
      venda_acumulada: l.venda_liquida || 0,
      dias_decorridos: dias,
      dias_mes: diasNoIntervalo(inicioMes, fimMes),
      dias_restantes: 0,
      projecao_simples: l.venda_liquida || 0,
      projecao_inteligente: l.venda_liquida || 0,
      media_dia: 0,
    };
    const denom = p.projecao_inteligente > 0 ? p.projecao_inteligente : (p.venda_acumulada || l.venda_liquida || 0);
    const cmvPct = denom > 0 && g.total > 0 ? round1((g.total / denom) * 100) : null;
    if (cmvPct != null) cmvsAtual.push(cmvPct);
    gastoTotal += g.total;
    projTotal += num(p.projecao_inteligente);
    projSimplesTotal += num(p.projecao_simples);
    vendaMtdTotal += num(p.venda_acumulada);

    l.ncs_novas = ncsAtual.get(l.id_loja) || 0;
    l.cmv_gasto = g.total;
    l.cmv_por_fornecedor = {
      platlog: g.platlog,
      ambev_coca: g.ambev_coca,
      gimba: g.gimba,
      uniforme: g.uniforme,
    };
    l.cmv_nfs = g.nfs;
    l.cmv_teorico_pct = cmvPct;
    l.cmv_pct = cmvPct;
    l.cmv_meta_pct = META_CMV_NF;
    l.cmv_confiavel = g.nfs > 0 && denom > 0;
    l.cmv_cobertura_pct = g.nfs > 0 ? 100 : 0;
    l.venda_acumulada = p.venda_acumulada;
    l.venda_estimada = p.projecao_inteligente;
    l.venda_proj_simples = p.projecao_simples;
    l.dias_decorridos = p.dias_decorridos;
    l.dias_mes = p.dias_mes;
    l.dias_restantes = p.dias_restantes;
    l.media_dia = p.media_dia;
  }

  if (atual.resumo) {
    atual.resumo.cmv_medio_pct = cmvsAtual.length
      ? round1(cmvsAtual.reduce((s, n) => s + n, 0) / cmvsAtual.length)
      : null;
    atual.resumo.cmv_gasto = round2(gastoTotal);
    atual.resumo.venda_estimada = round2(projTotal);
    atual.resumo.venda_proj_simples = round2(projSimplesTotal);
    atual.resumo.cmv_alto = atual.lojas.filter(
      (l) => (!idLoja || l.id_loja === idLoja)
        && l.cmv_pct != null
        && l.cmv_pct > META_CMV_NF,
    ).length;
  }

  return {
    ...atual,
    cmv_meta_pct: META_CMV_NF,
    cmv_fornecedores: ['platlog', 'ambev_coca', 'gimba', 'uniforme'],
    anterior: {
      periodo: { de: deAnt, ate: ateAnt },
      venda_liquida: round2(vendaAnt),
      compras_valor: round2(gastoAntTotal),
      cmp_pct: null,
      cmv_medio_pct: cmvsAnt.length
        ? round1(cmvsAnt.reduce((s, n) => s + n, 0) / cmvsAnt.length)
        : null,
      por_loja: anteriorPorLoja,
    },
    serie,
    projecao: {
      inicio_mes: inicioMes,
      fim_mes: fimMes,
      venda_acumulada: round2(vendaMtdTotal),
      projecao_inteligente: round2(projTotal),
      projecao_simples: round2(projSimplesTotal),
      cmv_gasto: round2(gastoTotal),
      cmv_pct: projTotal > 0 && gastoTotal > 0
        ? round1((gastoTotal / projTotal) * 100)
        : null,
    },
  };
}
