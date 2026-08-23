/**
 * CMV real por inventário + variância + entrada física da NF.
 *
 * Controle de CMV (R$ / %): compras entram pelo VENCIMENTO da NF
 * (como a composição CMV da unidade). Sem vencimento, usa a emissão.
 * Conferência na loja continua na data de entrega — só mexe no saldo.
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
 * Compras no período pelo VENCIMENTO da NF (composição CMV).
 * Entrada manual (sem NF) entra pela data do movimento.
 */
export async function somarComprasPorVencimento(idLoja, { de, ate } = {}) {
  const paramsNf = [idLoja];
  let filtroNf = ` AND COALESCE(n.status, '') <> 'erro'`;
  if (de) {
    paramsNf.push(de);
    filtroNf += ` AND COALESCE(n.data_vencimento, n.emissao::date) >= $${paramsNf.length}::date`;
  }
  if (ate) {
    paramsNf.push(ate);
    filtroNf += ` AND COALESCE(n.data_vencimento, n.emissao::date) <= $${paramsNf.length}::date`;
  }

  const { rows: nfRows } = await pool.query(
    `SELECT
       COALESCE(SUM(n.valor_total), 0)::numeric AS compras_valor,
       COUNT(*)::int AS nfs,
       COUNT(*) FILTER (WHERE n.entrada_registrada)::int AS nfs_com_entrada,
       COUNT(*) FILTER (WHERE NOT n.entrada_registrada)::int AS nfs_sem_entrada
     FROM estoque_nfe n
     WHERE n.id_loja = $1
       ${filtroNf}`,
    paramsNf,
  );

  const paramsMan = [idLoja];
  let filtroMan = '';
  if (de) {
    paramsMan.push(de);
    filtroMan += ` AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) >= $${paramsMan.length}::date`;
  }
  if (ate) {
    paramsMan.push(ate);
    filtroMan += ` AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) <= $${paramsMan.length}::date`;
  }

  const { rows: manRows } = await pool.query(
    `SELECT
       COALESCE(SUM(
         m.quantidade * CASE
           WHEN i.custo_fonte IN ('nf', 'manual', 'catalogo') THEN COALESCE(i.valor_unidade, 0)
           ELSE 0
         END
       ), 0)::numeric AS compras_valor,
       COUNT(*)::int AS movimentos
     FROM estoque_movimentos m
     JOIN insumos i ON i.id_insumo = m.id_insumo
     WHERE m.id_loja = $1
       AND m.tipo = 'entrada'
       AND COALESCE(m.referencia_tipo, '') <> 'estoque_nfe'
       AND COALESCE(i.entra_cmv, TRUE)
       ${filtroMan}`,
    paramsMan,
  );

  const { rows: pend } = await pool.query(
    `SELECT COUNT(*)::int AS qtd
     FROM estoque_nfe
     WHERE id_loja = $1 AND entrada_registrada = FALSE`,
    [idLoja],
  );

  const valorNf = num(nfRows[0]?.compras_valor);
  const valorMan = num(manRows[0]?.compras_valor);
  return {
    compras_valor: Math.round((valorNf + valorMan) * 100) / 100,
    compras_qtde: 0,
    movimentos: manRows[0]?.movimentos || 0,
    nfs_mov: nfRows[0]?.nfs || 0,
    nfs_entregues: nfRows[0]?.nfs_com_entrada || 0,
    nfs_sem_entrada_periodo: nfRows[0]?.nfs_sem_entrada || 0,
    valor_nfs_entrada: Math.round(valorNf * 100) / 100,
    nfs_pendentes_loja: pend[0]?.qtd || 0,
  };
}

/** @deprecated use somarComprasPorVencimento */
export const somarComprasPorEntrega = somarComprasPorVencimento;

/**
 * CMV real: Consumo = EI + Compras(vencimento da NF) − EF ; % = Consumo / Venda
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
    somarComprasPorVencimento(id, {
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
      `${compras.nfs_pendentes_loja} NF(s) ainda sem conferência no estoque — o CMV já usa o vencimento; a conferência só atualiza o saldo.`,
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
    regra_compras: 'data_vencimento',
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
 * Classifica status bruto do portal → ciclo de recebimento na loja.
 * Portal detecta saída/entrega; gestor só confere itens.
 */
export function classificarStatusPortal(statusPortal, { temDataSaida = false, temRemessa = false } = {}) {
  const s = String(statusPortal || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (/cancel|anulad|recus|rejei/.test(s)) return 'aguardando_portal';
  if (
    /entregue|entrega realizada|delivered|conclu|finaliz|recebid|baixad/.test(s) ||
    temDataSaida
  ) {
    return 'aguardando_conferencia';
  }
  if (
    /transito|transporte|despach|remessa|faturad|enviad|em rota|shipped|invoice/.test(s) ||
    temRemessa
  ) {
    return 'em_transito';
  }
  if (temDataSaida) return 'aguardando_conferencia';
  return 'aguardando_portal';
}

/**
 * Confirma entrada de NF no saldo com data_entrega obrigatória.
 */
export async function confirmarEntradaNfe({
  id_nfe,
  data_entrega,
  criado_por = null,
  forcar = false,
  itensOverride = null,
} = {}) {
  const idNfe = Number(id_nfe);
  if (!idNfe) throw Object.assign(new Error('id_nfe obrigatório'), { status: 400 });

  const { rows: nfs } = await pool.query(`SELECT * FROM estoque_nfe WHERE id_nfe = $1`, [idNfe]);
  if (!nfs.length) throw Object.assign(new Error('NF não encontrada'), { status: 404 });
  const nfe = nfs[0];
  if (nfe.entrada_registrada && !forcar) {
    throw Object.assign(new Error('Entrada desta NF já foi registrada'), { status: 409 });
  }

  // Data: preferência explícita → data_saida do portal → hoje (só na conferência)
  const dataEntrega =
    isoDate(data_entrega) || isoDate(nfe.data_saida) || isoDate(nfe.data_entrega) || hojeSpISO();

  let itens;
  if (Array.isArray(itensOverride) && itensOverride.length) {
    itens = itensOverride;
  } else {
    const { rows } = await pool.query(
      `SELECT id_item, id_insumo, qtd_estoque, qtd_conferida, descricao, n_item
       FROM estoque_nfe_itens
       WHERE id_nfe = $1 AND id_insumo IS NOT NULL
         AND COALESCE(qtd_conferida, qtd_estoque, 0) > 0`,
      [idNfe],
    );
    itens = rows.map((i) => ({
      id_insumo: i.id_insumo,
      quantidade: num(i.qtd_conferida != null ? i.qtd_conferida : i.qtd_estoque),
      observacao: `NF item ${i.n_item || ''} ${i.descricao || ''}`.trim(),
    }));
  }

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
    itens,
  });

  await pool.query(
    `UPDATE estoque_nfe
     SET data_entrega = $1::date,
         entrada_registrada = TRUE,
         entrada_em = NOW(),
         entrada_por = $2,
         status_entrega = 'conferida',
         atualizado_em = NOW()
     WHERE id_nfe = $3`,
    [dataEntrega, criado_por, idNfe],
  );

  return {
    ok: true,
    id_nfe: idNfe,
    data_entrega: dataEntrega,
    data_saida: nfe.data_saida,
    emissao: nfe.emissao,
    entradas: result.entradas,
    erros: result.erros,
  };
}

/**
 * Gestor confere itens da NF (portal já sinalizou saída/entrega).
 * Não pede data — usa data_saida do fornecedor (ou hoje se ausente).
 */
export async function conferirRecebimentoNfe({
  id_nfe,
  itens = null,
  confirmar_todos = false,
  criado_por = null,
} = {}) {
  const idNfe = Number(id_nfe);
  if (!idNfe) throw Object.assign(new Error('id_nfe obrigatório'), { status: 400 });

  const { rows: nfs } = await pool.query(`SELECT * FROM estoque_nfe WHERE id_nfe = $1`, [idNfe]);
  if (!nfs.length) throw Object.assign(new Error('NF não encontrada'), { status: 404 });
  const nfe = nfs[0];
  if (nfe.entrada_registrada) {
    throw Object.assign(new Error('NF já conferida e lançada no estoque'), { status: 409 });
  }

  const { rows: dbItens } = await pool.query(
    `SELECT * FROM estoque_nfe_itens WHERE id_nfe = $1 ORDER BY n_item NULLS LAST, id_item`,
    [idNfe],
  );
  if (!dbItens.length) {
    throw Object.assign(new Error('NF sem itens'), { status: 400 });
  }

  const mapa = new Map();
  if (Array.isArray(itens)) {
    for (const raw of itens) {
      const idItem = Number(raw.id_item);
      if (!idItem) continue;
      mapa.set(idItem, {
        qtd_conferida: raw.qtd_conferida != null ? num(raw.qtd_conferida) : null,
        conferido: raw.conferido !== false,
        divergencia_obs: raw.divergencia_obs != null ? String(raw.divergencia_obs).trim() : null,
      });
    }
  }

  let temDivergencia = false;
  const entradasItens = [];

  for (const row of dbItens) {
    const patch = mapa.get(row.id_item);
    let qtdConf;
    let conferido;
    let obs = null;

    if (confirmar_todos && !patch) {
      qtdConf = num(row.qtd_estoque ?? row.q_com);
      conferido = true;
    } else if (patch) {
      qtdConf = patch.qtd_conferida != null ? patch.qtd_conferida : num(row.qtd_estoque ?? row.q_com);
      conferido = patch.conferido;
      obs = patch.divergencia_obs;
    } else {
      continue;
    }

    const esperado = num(row.qtd_estoque ?? row.q_com);
    if (Math.abs(qtdConf - esperado) > 0.0001) temDivergencia = true;

    await pool.query(
      `UPDATE estoque_nfe_itens
       SET qtd_conferida = $1, conferido = $2, divergencia_obs = $3
       WHERE id_item = $4`,
      [qtdConf, conferido, obs, row.id_item],
    );

    if (conferido && row.id_insumo && qtdConf > 0) {
      entradasItens.push({
        id_insumo: row.id_insumo,
        quantidade: qtdConf,
        observacao: `NF item ${row.n_item || ''} ${row.descricao || ''}`.trim(),
      });
    }
  }

  const dataEntrega = nfe.data_saida || nfe.data_entrega || hojeSpISO();

  // Todos marcados como não chegaram: grava ocorrência sem lançar estoque
  if (!entradasItens.length) {
    await pool.query(
      `UPDATE estoque_nfe
       SET data_entrega = $1::date,
           entrada_registrada = TRUE,
           entrada_em = NOW(),
           entrada_por = $2,
           status_entrega = 'divergente',
           atualizado_em = NOW()
       WHERE id_nfe = $3`,
      [dataEntrega, criado_por, idNfe],
    );
    return {
      ok: true,
      id_nfe: idNfe,
      data_entrega: dataEntrega,
      data_saida: nfe.data_saida,
      emissao: nfe.emissao,
      status_entrega: 'divergente',
      divergente: true,
      entradas: [],
      erros: ['Nenhum item chegou — NF registrada sem entrada de estoque'],
    };
  }

  const entrada = await confirmarEntradaNfe({
    id_nfe: idNfe,
    data_entrega: dataEntrega,
    criado_por,
    forcar: false,
    itensOverride: entradasItens,
  });

  if (temDivergencia) {
    await pool.query(
      `UPDATE estoque_nfe SET status_entrega = 'divergente', atualizado_em = NOW() WHERE id_nfe = $1`,
      [idNfe],
    );
  }

  return {
    ...entrada,
    divergente: temDivergencia,
    status_entrega: temDivergencia ? 'divergente' : 'conferida',
  };
}

export async function obterNfeDetalhe(idNfe) {
  const id = Number(idNfe);
  const { rows } = await pool.query(`SELECT * FROM estoque_nfe WHERE id_nfe = $1`, [id]);
  if (!rows.length) return null;
  const nfe = rows[0];
  const { rows: itens } = await pool.query(
    `SELECT i.*, ins.codigo AS codigo_insumo, ins.descricao AS descricao_insumo,
            ins.unidade_contagem
     FROM estoque_nfe_itens i
     LEFT JOIN insumos ins ON ins.id_insumo = i.id_insumo
     WHERE i.id_nfe = $1
     ORDER BY i.n_item NULLS LAST, i.id_item`,
    [id],
  );
  return {
    id_nfe: nfe.id_nfe,
    id_loja: nfe.id_loja,
    fornecedor: nfe.fornecedor,
    numero: nfe.numero,
    serie: nfe.serie,
    chave: nfe.chave,
    emissao: nfe.emissao,
    data_saida: nfe.data_saida,
    data_entrega: nfe.data_entrega,
    data_vencimento: nfe.data_vencimento,
    status_portal: nfe.status_portal,
    status_entrega: nfe.status_entrega,
    emitente_nome: nfe.emitente_nome,
    emitente_cnpj: nfe.emitente_cnpj,
    valor_total: nfe.valor_total != null ? num(nfe.valor_total) : null,
    entrada_registrada: !!nfe.entrada_registrada,
    tem_xml: !!(nfe.xml_path && String(nfe.xml_path).trim()),
    itens: itens.map((i) => ({
      id_item: i.id_item,
      n_item: i.n_item,
      codigo_nf: i.codigo_nf,
      ean: i.ean,
      descricao: i.descricao,
      u_com: i.u_com,
      q_com: i.q_com != null ? num(i.q_com) : null,
      v_un_com: i.v_un_com != null ? num(i.v_un_com) : null,
      v_prod: i.v_prod != null ? num(i.v_prod) : null,
      qtd_estoque: i.qtd_estoque != null ? num(i.qtd_estoque) : null,
      qtd_conferida: i.qtd_conferida != null ? num(i.qtd_conferida) : null,
      conferido: !!i.conferido,
      divergencia_obs: i.divergencia_obs,
      id_insumo: i.id_insumo,
      codigo_insumo: i.codigo_insumo,
      descricao_insumo: i.descricao_insumo,
      unidade_contagem: i.unidade_contagem,
    })),
  };
}

export async function listarNfesEstoque(
  idLoja,
  { pendentes = false, conferir = false, limit = 50 } = {},
) {
  const params = [idLoja];
  let filtro = '';
  if (conferir || pendentes) {
    filtro = ` AND n.entrada_registrada = FALSE
               AND n.status_entrega IN ('aguardando_conferencia', 'em_transito', 'aguardando_portal', 'divergente')`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));

  const { rows } = await pool.query(
    `SELECT n.*,
            (SELECT COUNT(*)::int FROM estoque_nfe_itens i WHERE i.id_nfe = n.id_nfe) AS itens,
            (SELECT COUNT(*)::int FROM estoque_nfe_itens i
              WHERE i.id_nfe = n.id_nfe AND i.id_insumo IS NOT NULL) AS itens_casados
     FROM estoque_nfe n
     WHERE n.id_loja = $1 ${filtro}
     ORDER BY
       CASE n.status_entrega
         WHEN 'aguardando_conferencia' THEN 0
         WHEN 'em_transito' THEN 1
         WHEN 'divergente' THEN 2
         ELSE 3
       END,
       COALESCE(n.data_saida, n.emissao) DESC NULLS LAST,
       n.id_nfe DESC
     LIMIT $${params.length}`,
    params,
  );

  return rows.map((r) => ({
    id_nfe: r.id_nfe,
    id_loja: r.id_loja,
    fornecedor: r.fornecedor,
    numero: r.numero,
    chave: r.chave,
    emissao: r.emissao,
    data_saida: r.data_saida,
    data_entrega: r.data_entrega,
    data_vencimento: r.data_vencimento,
    status_portal: r.status_portal,
    status_entrega: r.status_entrega,
    emitente_nome: r.emitente_nome,
    valor_total: r.valor_total != null ? num(r.valor_total) : null,
    entrada_registrada: !!r.entrada_registrada,
    tem_xml: !!(r.xml_path && String(r.xml_path).trim()),
    itens: r.itens,
    itens_casados: r.itens_casados,
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
  const { rows: diariaHoje } = await pool.query(
    `SELECT id_contagem, data_contagem
     FROM estoque_contagens
     WHERE id_loja = $1 AND status = 'finalizada'
       AND tipo = 'diaria'
       AND data_contagem = $2::date
     LIMIT 1`,
    [id, hojeIso],
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
  if (!diariaHoje[0]) {
    alertas.push({
      tipo: 'contagem_diaria_pendente',
      severidade: 'alta',
      mensagem:
        'Contagem diária de hoje ainda não foi feita (produtos de giro do estoque da loja).',
    });
  }
  if (diasCritica == null || diasCritica > 10) {
    alertas.push({
      tipo: 'contagem_critica_atrasada',
      severidade: 'media',
      mensagem:
        diasCritica == null
          ? 'Nenhuma contagem semanal de segunda (mix e latas) finalizada.'
          : `Última semanal (segunda) há ${diasCritica} dias (meta ≤ 10).`,
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
