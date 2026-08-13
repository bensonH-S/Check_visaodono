/**
 * CMV real por inventário + variância + entrada NF por data de entrega.
 *
 * Regra de ouro: compras entram no CMV pela DATA DE ENTREGA na loja,
 * nunca pela data de emissão da NF.
 */
import { pool } from '../db.js';
import {
  calcularCmvTeorico,
  registrarEntradas,
} from './estoqueMotor.js';

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function hojeSpISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isoDate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function addDaysISO(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function totalValorContagem(idContagem, client = pool) {
  const { rows } = await client.query(
    `SELECT COALESCE(
       c.total_valor,
       (
         SELECT ROUND(SUM(
           COALESCE(i.estoque_contado, 0) * COALESCE(p.valor_unidade, 0)
         )::numeric, 2)
         FROM estoque_itens i
         JOIN insumos p ON p.id_insumo = i.id_insumo
         WHERE i.id_contagem = c.id_contagem
           AND i.estoque_contado IS NOT NULL
           AND COALESCE(p.entra_cmv, TRUE)
       )
     ) AS total_valor,
     c.id_contagem, c.data_contagem, c.titulo, c.tipo, c.status
     FROM estoque_contagens c
     WHERE c.id_contagem = $1`,
    [idContagem],
  );
  if (!rows.length) return null;
  return {
    id_contagem: rows[0].id_contagem,
    data_contagem: rows[0].data_contagem,
    titulo: rows[0].titulo,
    tipo: rows[0].tipo,
    status: rows[0].status,
    total_valor: rows[0].total_valor != null ? num(rows[0].total_valor) : null,
  };
}

async function resolverContagensInventario(
  idLoja,
  { de, ate, id_contagem_ei = null, id_contagem_ef = null } = {},
) {
  let ei = null;
  let ef = null;

  if (id_contagem_ei) {
    ei = await totalValorContagem(id_contagem_ei);
    if (!ei || ei.status !== 'finalizada' || (ei.tipo && ei.tipo !== 'completa')) {
      throw Object.assign(
        new Error('Contagem inicial inválida (precisa ser completa finalizada)'),
        { status: 400 },
      );
    }
  } else if (de) {
    const { rows } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE id_loja = $1 AND status = 'finalizada'
         AND COALESCE(tipo, 'completa') = 'completa'
         AND data_contagem <= $2::date
       ORDER BY data_contagem DESC, id_contagem DESC
       LIMIT 1`,
      [idLoja, de],
    );
    if (rows.length) ei = await totalValorContagem(rows[0].id_contagem);
  }

  if (id_contagem_ef) {
    ef = await totalValorContagem(id_contagem_ef);
    if (!ef || ef.status !== 'finalizada' || (ef.tipo && ef.tipo !== 'completa')) {
      throw Object.assign(
        new Error('Contagem final inválida (precisa ser completa finalizada)'),
        { status: 400 },
      );
    }
  } else if (ate) {
    const params = [idLoja, ate];
    let filtroEi = '';
    if (ei?.data_contagem) {
      params.push(ei.data_contagem);
      filtroEi = ` AND data_contagem > $${params.length}::date`;
    } else if (de) {
      params.push(de);
      filtroEi = ` AND data_contagem >= $${params.length}::date`;
    }
    const { rows } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE id_loja = $1 AND status = 'finalizada'
         AND COALESCE(tipo, 'completa') = 'completa'
         AND data_contagem <= $2::date
         ${filtroEi}
       ORDER BY data_contagem DESC, id_contagem DESC
       LIMIT 1`,
      params,
    );
    if (rows.length) ef = await totalValorContagem(rows[0].id_contagem);
  }

  return { ei, ef };
}

/**
 * Compras no período pela DATA DE ENTREGA / data_movimento (nunca emissão).
 */
export async function somarComprasPorEntrega(idLoja, { de, ate } = {}) {
  const params = [idLoja];
  let filtro = '';
  if (de) {
    params.push(de);
    filtro += ` AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) > $${params.length}::date`;
  }
  if (ate) {
    params.push(ate);
    filtro += ` AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) <= $${params.length}::date`;
  }

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(
         m.quantidade * CASE
           WHEN i.custo_fonte IN ('nf', 'manual', 'catalogo') THEN COALESCE(i.valor_unidade, 0)
           ELSE 0
         END
       ), 0)::numeric AS compras_valor,
       COALESCE(SUM(m.quantidade), 0)::numeric AS compras_qtde,
       COUNT(*)::int AS movimentos,
       COUNT(DISTINCT m.referencia_id) FILTER (WHERE m.referencia_tipo = 'estoque_nfe')::int AS nfs
     FROM estoque_movimentos m
     JOIN insumos i ON i.id_insumo = m.id_insumo
     WHERE m.id_loja = $1
       AND m.tipo = 'entrada'
       AND COALESCE(i.entra_cmv, TRUE)
       ${filtro}`,
    params,
  );

  const paramsNf = [idLoja];
  let filtroNf = '';
  if (de) {
    paramsNf.push(de);
    filtroNf += ` AND n.data_entrega > $${paramsNf.length}::date`;
  }
  if (ate) {
    paramsNf.push(ate);
    filtroNf += ` AND n.data_entrega <= $${paramsNf.length}::date`;
  }

  const { rows: nfRows } = await pool.query(
    `SELECT
       COUNT(*)::int AS nfs_entregues,
       COUNT(*) FILTER (WHERE NOT n.entrada_registrada)::int AS nfs_sem_entrada,
       COALESCE(SUM(n.valor_total) FILTER (WHERE n.entrada_registrada), 0)::numeric AS valor_nfs_entrada
     FROM estoque_nfe n
     WHERE n.id_loja = $1
       AND n.data_entrega IS NOT NULL
       ${filtroNf}`,
    paramsNf,
  );

  const { rows: pend } = await pool.query(
    `SELECT COUNT(*)::int AS qtd
     FROM estoque_nfe
     WHERE id_loja = $1 AND entrada_registrada = FALSE`,
    [idLoja],
  );

  return {
    compras_valor: Math.round(num(rows[0]?.compras_valor) * 100) / 100,
    compras_qtde: num(rows[0]?.compras_qtde),
    movimentos: rows[0]?.movimentos || 0,
    nfs_mov: rows[0]?.nfs || 0,
    nfs_entregues: nfRows[0]?.nfs_entregues || 0,
    nfs_sem_entrada_periodo: nfRows[0]?.nfs_sem_entrada || 0,
    valor_nfs_entrada: Math.round(num(nfRows[0]?.valor_nfs_entrada) * 100) / 100,
    nfs_pendentes_loja: pend[0]?.qtd || 0,
  };
}

/**
 * CMV real: Consumo = EI + Compras(data_entrega) − EF ; % = Consumo / Venda
 */
export async function calcularCmvReal(
  idLoja,
  {
    de = null,
    ate = null,
    meta = 0.38,
    id_contagem_ei = null,
    id_contagem_ef = null,
  } = {},
) {
  const id = Number(idLoja);
  if (!id) throw Object.assign(new Error('id_loja obrigatório'), { status: 400 });

  const { ei, ef } = await resolverContagensInventario(id, {
    de,
    ate,
    id_contagem_ei,
    id_contagem_ef,
  });

  const dataEi = ei?.data_contagem ? isoDate(ei.data_contagem) : isoDate(de);
  const dataEf = ef?.data_contagem ? isoDate(ef.data_contagem) : isoDate(ate);
  const periodoDe = dataEi;
  const periodoAte = dataEf || isoDate(ate);

  const [teorico, compras] = await Promise.all([
    calcularCmvTeorico(id, {
      de: periodoDe ? addDaysISO(periodoDe, 1) : de,
      ate: periodoAte || ate,
      meta,
    }),
    somarComprasPorEntrega(id, {
      de: periodoDe,
      ate: periodoAte || ate,
    }),
  ]);

  const estoqueInicial = ei?.total_valor != null ? ei.total_valor : null;
  const estoqueFinal = ef?.total_valor != null ? ef.total_valor : null;
  const comprasValor = compras.compras_valor;
  const venda = teorico.venda_bruta ?? teorico.venda_liquida ?? 0;

  let consumo = null;
  let cmvRealPct = null;
  const avisos = [];

  if (estoqueInicial == null) {
    avisos.push('Falta contagem completa inicial (EI) no período.');
  }
  if (estoqueFinal == null) {
    avisos.push('Falta contagem completa final (EF) no período.');
  }
  if (compras.nfs_pendentes_loja > 0) {
    avisos.push(
      `${compras.nfs_pendentes_loja} NF(s) sem entrada confirmada — informe data de entrega para entrar no CMV.`,
    );
  }
  if (estoqueInicial != null && estoqueFinal != null) {
    consumo = Math.round((estoqueInicial + comprasValor - estoqueFinal) * 100) / 100;
    if (venda > 0) {
      cmvRealPct = Math.round((consumo / venda) * 10000) / 100;
    } else {
      avisos.push('Sem venda no período — % CMV real indisponível.');
    }
  }

  const metaN = num(meta, 0.38);
  const teoricoPct = teorico.cmv_teorico_pct;
  const gapTeoricoPp =
    cmvRealPct != null && teoricoPct != null
      ? Math.round((cmvRealPct - teoricoPct) * 100) / 100
      : null;

  return {
    id_loja: id,
    de: periodoDe,
    ate: periodoAte,
    regra_compras: 'data_entrega',
    estoque_inicial: estoqueInicial,
    compras: comprasValor,
    estoque_final: estoqueFinal,
    consumo_real: consumo,
    venda: Math.round(venda * 100) / 100,
    cmv_real_pct: cmvRealPct,
    cmv_teorico_pct: teoricoPct,
    cmv_com_break_pct: teorico.cmv_com_break_pct,
    custo_teorico: teorico.custo_teorico,
    custo_break: teorico.custo_break,
    meta_pct: Math.round(metaN * 10000) / 100,
    gap_vs_meta_pp:
      cmvRealPct != null ? Math.round((cmvRealPct - metaN * 100) * 100) / 100 : null,
    gap_vs_teorico_pp: gapTeoricoPp,
    gap_vs_teorico_reais:
      consumo != null && teorico.custo_teorico != null
        ? Math.round((consumo - teorico.custo_teorico) * 100) / 100
        : null,
    contagem_ei: ei,
    contagem_ef: ef,
    compras_detalhe: compras,
    cobertura_custo_pct: teorico.cobertura_custo_pct,
    cmv_confiavel: teorico.cmv_confiavel && estoqueInicial != null && estoqueFinal != null,
    avisos,
    aviso: avisos[0] || null,
  };
}

/**
 * Variância por insumo: teórico (venda×ficha) vs real (EI + compras − EF).
 */
export async function calcularVarianciaInsumos(
  idLoja,
  {
    de = null,
    ate = null,
    id_contagem_ei = null,
    id_contagem_ef = null,
    limite = 50,
  } = {},
) {
  const id = Number(idLoja);
  const { ei, ef } = await resolverContagensInventario(id, {
    de,
    ate,
    id_contagem_ei,
    id_contagem_ef,
  });
  if (!ei || !ef) {
    return {
      id_loja: id,
      itens: [],
      aviso: 'Precisa de duas contagens completas (EI e EF) para variância por insumo.',
      contagem_ei: ei,
      contagem_ef: ef,
    };
  }

  const dataEi = isoDate(ei.data_contagem);
  const dataEf = isoDate(ef.data_contagem);
  const deVenda = addDaysISO(dataEi, 1);

  const { rows } = await pool.query(
    `
    WITH ei_itens AS (
      SELECT i.id_insumo, COALESCE(i.estoque_contado, 0)::numeric AS qtd
      FROM estoque_itens i
      WHERE i.id_contagem = $1 AND i.estoque_contado IS NOT NULL
    ),
    ef_itens AS (
      SELECT i.id_insumo, COALESCE(i.estoque_contado, 0)::numeric AS qtd
      FROM estoque_itens i
      WHERE i.id_contagem = $2 AND i.estoque_contado IS NOT NULL
    ),
    compras AS (
      SELECT m.id_insumo, SUM(m.quantidade)::numeric AS qtd
      FROM estoque_movimentos m
      WHERE m.id_loja = $3
        AND m.tipo = 'entrada'
        AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date)
            > $4::date
        AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date)
            <= $5::date
      GROUP BY m.id_insumo
    ),
    teorico AS (
      SELECT
        ins.id_insumo,
        SUM(vi.qtde * COALESCE(fi.qtde_estoque, fi.quantidade, 0))::numeric AS qtd
      FROM estoque_vendas v
      JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
      JOIN produtos p ON p.id_loja = v.id_loja AND p.codigo = vi.codigo
      JOIN ficha_tecnica f ON f.id_produto = COALESCE(vi.id_produto, p.id_produto) AND f.ativo
      JOIN ficha_tecnica_itens fi ON fi.id_ficha = f.id_ficha
      JOIN insumos ins
        ON ins.id_loja = v.id_loja AND UPPER(ins.codigo) = UPPER(fi.codigo_insumo)
      WHERE v.id_loja = $3
        AND v.data_venda >= $6::date
        AND v.data_venda <= $5::date
      GROUP BY ins.id_insumo
    ),
    base AS (
      SELECT DISTINCT id_insumo FROM (
        SELECT id_insumo FROM ei_itens
        UNION SELECT id_insumo FROM ef_itens
        UNION SELECT id_insumo FROM compras
        UNION SELECT id_insumo FROM teorico
      ) u
    )
    SELECT
      ins.id_insumo,
      ins.codigo,
      ins.descricao,
      ins.unidade_contagem,
      COALESCE(ins.valor_unidade, 0)::numeric AS valor_unidade,
      COALESCE(ins.custo_fonte, '') AS custo_fonte,
      COALESCE(ei.qtd, 0)::numeric AS qtd_ei,
      COALESCE(c.qtd, 0)::numeric AS qtd_compras,
      COALESCE(ef.qtd, 0)::numeric AS qtd_ef,
      (COALESCE(ei.qtd, 0) + COALESCE(c.qtd, 0) - COALESCE(ef.qtd, 0))::numeric AS qtd_real,
      COALESCE(t.qtd, 0)::numeric AS qtd_teorico
    FROM base b
    JOIN insumos ins ON ins.id_insumo = b.id_insumo
    LEFT JOIN ei_itens ei ON ei.id_insumo = b.id_insumo
    LEFT JOIN ef_itens ef ON ef.id_insumo = b.id_insumo
    LEFT JOIN compras c ON c.id_insumo = b.id_insumo
    LEFT JOIN teorico t ON t.id_insumo = b.id_insumo
    WHERE COALESCE(ins.entra_cmv, TRUE)
    `,
    [ei.id_contagem, ef.id_contagem, id, dataEi, dataEf, deVenda],
  );

  const itens = rows
    .map((r) => {
      const qtdReal = num(r.qtd_real);
      const qtdTeorico = num(r.qtd_teorico);
      const gapQtd = qtdReal - qtdTeorico;
      const vu =
        r.custo_fonte === 'nf' || r.custo_fonte === 'manual' || r.custo_fonte === 'catalogo'
          ? num(r.valor_unidade)
          : 0;
      const gapReais = gapQtd * vu;
      return {
        id_insumo: r.id_insumo,
        codigo: r.codigo,
        descricao: r.descricao,
        unidade_contagem: r.unidade_contagem,
        valor_unidade: vu,
        qtd_ei: num(r.qtd_ei),
        qtd_compras: num(r.qtd_compras),
        qtd_ef: num(r.qtd_ef),
        qtd_real: Math.round(qtdReal * 1000) / 1000,
        qtd_teorico: Math.round(qtdTeorico * 1000) / 1000,
        gap_qtd: Math.round(gapQtd * 1000) / 1000,
        gap_reais: Math.round(gapReais * 100) / 100,
        gap_pct_teorico:
          qtdTeorico !== 0 ? Math.round((gapQtd / Math.abs(qtdTeorico)) * 1000) / 10 : null,
      };
    })
    .filter((x) => Math.abs(x.gap_reais) >= 0.01 || Math.abs(x.gap_qtd) >= 0.001)
    .sort((a, b) => Math.abs(b.gap_reais) - Math.abs(a.gap_reais))
    .slice(0, Math.min(Math.max(Number(limite) || 50, 1), 200));

  const gapTotal = itens.reduce((s, x) => s + x.gap_reais, 0);

  return {
    id_loja: id,
    de: dataEi,
    ate: dataEf,
    contagem_ei: ei,
    contagem_ef: ef,
    itens,
    gap_total_reais: Math.round(gapTotal * 100) / 100,
    regra_compras: 'data_entrega',
  };
}

/**
 * Confirma entrada de NF no saldo com data_entrega obrigatória.
 */
export async function confirmarEntradaNfe({
  id_nfe,
  data_entrega,
  criado_por = null,
  forcar = false,
} = {}) {
  const idNfe = Number(id_nfe);
  const dataEntrega = isoDate(data_entrega);
  if (!idNfe) throw Object.assign(new Error('id_nfe obrigatório'), { status: 400 });
  if (!dataEntrega) {
    throw Object.assign(
      new Error('Informe a data de entrega (quando a mercadoria chegou na loja)'),
      { status: 400 },
    );
  }

  const { rows: nfs } = await pool.query(`SELECT * FROM estoque_nfe WHERE id_nfe = $1`, [idNfe]);
  if (!nfs.length) throw Object.assign(new Error('NF não encontrada'), { status: 404 });
  const nfe = nfs[0];
  if (nfe.entrada_registrada && !forcar) {
    throw Object.assign(new Error('Entrada desta NF já foi registrada'), { status: 409 });
  }

  const { rows: itens } = await pool.query(
    `SELECT id_insumo, qtd_estoque, descricao, n_item
     FROM estoque_nfe_itens
     WHERE id_nfe = $1 AND id_insumo IS NOT NULL AND COALESCE(qtd_estoque, 0) > 0`,
    [idNfe],
  );
  if (!itens.length) {
    throw Object.assign(new Error('NF sem itens casados com quantidade de estoque'), {
      status: 400,
    });
  }

  const result = await registrarEntradas({
    id_loja: nfe.id_loja,
    id_nfe: idNfe,
    data_entrega: dataEntrega,
    observacao: `NF ${nfe.numero || nfe.chave} entrega ${dataEntrega}`,
    criado_por,
    itens: itens.map((i) => ({
      id_insumo: i.id_insumo,
      quantidade: num(i.qtd_estoque),
      observacao: `NF item ${i.n_item || ''} ${i.descricao || ''}`.trim(),
    })),
  });

  await pool.query(
    `UPDATE estoque_nfe
     SET data_entrega = $1::date,
         entrada_registrada = TRUE,
         entrada_em = NOW(),
         entrada_por = $2,
         atualizado_em = NOW()
     WHERE id_nfe = $3`,
    [dataEntrega, criado_por, idNfe],
  );

  return {
    ok: true,
    id_nfe: idNfe,
    data_entrega: dataEntrega,
    emissao: nfe.emissao,
    entradas: result.entradas,
    erros: result.erros,
  };
}

export async function listarNfesEstoque(idLoja, { pendentes = false, limit = 50 } = {}) {
  const params = [idLoja];
  let filtro = '';
  if (pendentes) filtro = ' AND n.entrada_registrada = FALSE';
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

  const { rows } = await pool.query(
    `SELECT n.*,
            (SELECT COUNT(*)::int FROM estoque_nfe_itens i WHERE i.id_nfe = n.id_nfe) AS itens,
            (SELECT COUNT(*)::int FROM estoque_nfe_itens i
              WHERE i.id_nfe = n.id_nfe AND i.id_insumo IS NOT NULL) AS itens_casados
     FROM estoque_nfe n
     WHERE n.id_loja = $1 ${filtro}
     ORDER BY COALESCE(n.data_entrega, n.emissao) DESC NULLS LAST, n.id_nfe DESC
     LIMIT $${params.length}`,
    params,
  );

  return rows.map((r) => ({
    ...r,
    valor_total: r.valor_total != null ? num(r.valor_total) : null,
    entrada_registrada: !!r.entrada_registrada,
  }));
}

export async function statusDisciplinaEstoque(idLoja, { hoje = null } = {}) {
  const id = Number(idLoja);
  const hojeIso = isoDate(hoje) || hojeSpISO();

  const { rows: completa } = await pool.query(
    `SELECT id_contagem, data_contagem, titulo, finalizado_em
     FROM estoque_contagens
     WHERE id_loja = $1 AND status = 'finalizada'
       AND COALESCE(tipo, 'completa') = 'completa'
     ORDER BY data_contagem DESC, id_contagem DESC
     LIMIT 1`,
    [id],
  );
  const { rows: critica } = await pool.query(
    `SELECT id_contagem, data_contagem, titulo, finalizado_em
     FROM estoque_contagens
     WHERE id_loja = $1 AND status = 'finalizada'
       AND tipo = 'critica_semanal'
     ORDER BY data_contagem DESC, id_contagem DESC
     LIMIT 1`,
    [id],
  );
  const { rows: abertas } = await pool.query(
    `SELECT COUNT(*)::int AS qtd FROM estoque_contagens
     WHERE id_loja = $1 AND status = 'aberta'`,
    [id],
  );
  const { rows: nfsPend } = await pool.query(
    `SELECT COUNT(*)::int AS qtd FROM estoque_nfe
     WHERE id_loja = $1 AND entrada_registrada = FALSE`,
    [id],
  );

  const diasDesde = (d) => {
    if (!d) return null;
    const a = new Date(`${isoDate(d)}T12:00:00`);
    const b = new Date(`${hojeIso}T12:00:00`);
    return Math.floor((b - a) / 86400000);
  };

  const diasCompleta = diasDesde(completa[0]?.data_contagem);
  const diasCritica = diasDesde(critica[0]?.data_contagem);
  const alertas = [];

  if (diasCompleta == null || diasCompleta > 35) {
    alertas.push({
      tipo: 'contagem_completa_atrasada',
      severidade: 'alta',
      mensagem:
        diasCompleta == null
          ? 'Nenhuma contagem completa finalizada.'
          : `Última completa há ${diasCompleta} dias (meta ≤ 35).`,
    });
  }
  if (diasCritica == null || diasCritica > 10) {
    alertas.push({
      tipo: 'contagem_critica_atrasada',
      severidade: 'media',
      mensagem:
        diasCritica == null
          ? 'Nenhuma contagem semanal crítica finalizada.'
          : `Última crítica semanal há ${diasCritica} dias (meta ≤ 10).`,
    });
  }
  if ((nfsPend[0]?.qtd || 0) > 0) {
    alertas.push({
      tipo: 'nf_sem_entrega',
      severidade: 'alta',
      mensagem: `${nfsPend[0].qtd} NF(s) aguardando data de entrega / entrada no saldo.`,
    });
  }
  if ((abertas[0]?.qtd || 0) > 0) {
    alertas.push({
      tipo: 'contagem_aberta',
      severidade: 'baixa',
      mensagem: `${abertas[0].qtd} contagem(ns) aberta(s).`,
    });
  }

  // CMV / cobertura no mês corrente
  const mesIni = `${hojeIso.slice(0, 7)}-01`;
  let cmvMes = null;
  try {
    cmvMes = await calcularCmvTeorico(id, { de: mesIni, ate: hojeIso });
    if (cmvMes.cmv_confiavel && cmvMes.cmv_teorico_pct != null && cmvMes.cmv_teorico_pct > cmvMes.meta_pct) {
      alertas.push({
        tipo: 'cmv_alto',
        severidade: 'alta',
        mensagem: `CMV teórico ${cmvMes.cmv_teorico_pct}% acima da meta ${cmvMes.meta_pct}%.`,
      });
    }
    if (cmvMes.cobertura_custo_pct != null && cmvMes.cobertura_custo_pct < 80) {
      alertas.push({
        tipo: 'cobertura_baixa',
        severidade: 'media',
        mensagem: `Cobertura de custo ${cmvMes.cobertura_custo_pct}% (mínimo 80%).`,
      });
    }
  } catch {
    /* ignore */
  }

  const mes = hojeIso.slice(0, 7);
  const { rows: fech } = await pool.query(
    `SELECT * FROM estoque_fechamentos WHERE id_loja = $1 AND ano_mes = $2`,
    [id, mes],
  );

  return {
    id_loja: id,
    hoje: hojeIso,
    ultima_completa: completa[0] || null,
    ultima_critica: critica[0] || null,
    dias_desde_completa: diasCompleta,
    dias_desde_critica: diasCritica,
    contagens_abertas: abertas[0]?.qtd || 0,
    nfs_pendentes_entrada: nfsPend[0]?.qtd || 0,
    cmv_mes: cmvMes
      ? {
          cmv_teorico_pct: cmvMes.cmv_teorico_pct,
          cobertura_custo_pct: cmvMes.cobertura_custo_pct,
          meta_pct: cmvMes.meta_pct,
        }
      : null,
    fechamento_mes: fech[0]
      ? {
          ano_mes: fech[0].ano_mes,
          status: fech[0].status,
          cmv_real_pct: fech[0].cmv_real_pct != null ? num(fech[0].cmv_real_pct) : null,
          fechado_em: fech[0].fechado_em,
        }
      : { ano_mes: mes, status: 'aberto' },
    alertas,
  };
}

export async function fecharMesEstoque({
  id_loja,
  ano_mes,
  criado_por = null,
  observacao = null,
  forcar = false,
} = {}) {
  const id = Number(id_loja);
  const mes = String(ano_mes || '').slice(0, 7);
  if (!id || !/^\d{4}-\d{2}$/.test(mes)) {
    throw Object.assign(new Error('id_loja e ano_mes (YYYY-MM) obrigatórios'), { status: 400 });
  }
  const de = `${mes}-01`;
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0));
  const ate = ultimo.toISOString().slice(0, 10);

  const { rows: exist } = await pool.query(
    `SELECT * FROM estoque_fechamentos WHERE id_loja = $1 AND ano_mes = $2`,
    [id, mes],
  );
  if (exist[0]?.status === 'fechado' && !forcar) {
    throw Object.assign(new Error('Mês já fechado'), { status: 409 });
  }

  const real = await calcularCmvReal(id, { de, ate });
  if (!real.cmv_confiavel && !forcar) {
    throw Object.assign(
      new Error(real.aviso || 'CMV real incompleto — não fecha sem EI/EF e cobertura'),
      { status: 400 },
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO estoque_fechamentos (
       id_loja, ano_mes, status,
       id_contagem_ei, id_contagem_ef, data_ei, data_ef,
       venda, estoque_inicial, compras, estoque_final, consumo_real,
       cmv_real_pct, cmv_teorico_pct, meta_pct, snapshot_json,
       fechado_em, fechado_por, observacao, atualizado_em
     ) VALUES (
       $1, $2, 'fechado',
       $3, $4, $5::date, $6::date,
       $7, $8, $9, $10, $11,
       $12, $13, $14, $15::jsonb,
       NOW(), $16, $17, NOW()
     )
     ON CONFLICT (id_loja, ano_mes) DO UPDATE SET
       status = 'fechado',
       id_contagem_ei = EXCLUDED.id_contagem_ei,
       id_contagem_ef = EXCLUDED.id_contagem_ef,
       data_ei = EXCLUDED.data_ei,
       data_ef = EXCLUDED.data_ef,
       venda = EXCLUDED.venda,
       estoque_inicial = EXCLUDED.estoque_inicial,
       compras = EXCLUDED.compras,
       estoque_final = EXCLUDED.estoque_final,
       consumo_real = EXCLUDED.consumo_real,
       cmv_real_pct = EXCLUDED.cmv_real_pct,
       cmv_teorico_pct = EXCLUDED.cmv_teorico_pct,
       meta_pct = EXCLUDED.meta_pct,
       snapshot_json = EXCLUDED.snapshot_json,
       fechado_em = NOW(),
       fechado_por = EXCLUDED.fechado_por,
       observacao = EXCLUDED.observacao,
       reaberto_em = NULL,
       reaberto_por = NULL,
       atualizado_em = NOW()
     RETURNING *`,
    [
      id,
      mes,
      real.contagem_ei?.id_contagem || null,
      real.contagem_ef?.id_contagem || null,
      real.de,
      real.ate,
      real.venda,
      real.estoque_inicial,
      real.compras,
      real.estoque_final,
      real.consumo_real,
      real.cmv_real_pct,
      real.cmv_teorico_pct,
      real.meta_pct,
      JSON.stringify(real),
      criado_por,
      observacao,
    ],
  );

  return rows[0];
}

export async function reabrirMesEstoque({ id_loja, ano_mes, criado_por = null } = {}) {
  const id = Number(id_loja);
  const mes = String(ano_mes || '').slice(0, 7);
  const { rows } = await pool.query(
    `UPDATE estoque_fechamentos
     SET status = 'aberto',
         reaberto_em = NOW(),
         reaberto_por = $3,
         atualizado_em = NOW()
     WHERE id_loja = $1 AND ano_mes = $2 AND status = 'fechado'
     RETURNING *`,
    [id, mes, criado_por],
  );
  if (!rows.length) {
    throw Object.assign(new Error('Fechamento não encontrado ou já aberto'), { status: 404 });
  }
  return rows[0];
}
