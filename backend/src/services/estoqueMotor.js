import { pool } from '../db.js';
import { resolverQtdContagem, anexarFatoresFracionada, garantirSchemaUnidadeFracionada } from './estoqueContagem.js';
import {
  MOTIVO_BAIXA,
  STATUS_AUDITORIA_PILOTO,
  criarSessaoAuditoriaPiloto,
  garantirSchemaPilotoBaixa,
  lojaEmPilotoBaixa,
  registrarPendenciaBaixa,
  resolverConsumoInsumo,
  resolverInsumoCanonico,
} from './estoqueConsumo.js';

/** Só vendas do kit BK Office — ignora upload/manual duplicado. */
const FILTRO_VENDA_BK = "AND v.origem = 'bkoffice'";

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Aplica delta no saldo e registra movimento.
 * quantidade > 0 = entrada; quantidade < 0 = saída.
 */
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

function normalizarNomeColab(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export async function aplicarMovimento(
  client,
  {
    id_loja,
    id_insumo = null,
    /** @deprecated use id_insumo */
    id_produto = null,
    tipo,
    quantidade,
    referencia_tipo = null,
    referencia_id = null,
    observacao = null,
    criado_por = null,
    /** Data de negócio (entrega/contagem). CMV real usa esta, não criado_em. */
    data_movimento = null,
  },
) {
  const delta = num(quantidade);
  const idInsumo = id_insumo || id_produto;
  if (!id_loja || !idInsumo || !tipo || delta === 0) {
    throw Object.assign(new Error('Movimento inválido'), { status: 400 });
  }
  const dataMov = isoDate(data_movimento) || hojeSpISO();

  const { rows } = await client.query(
    `INSERT INTO estoque_saldos (id_loja, id_insumo, quantidade, atualizado_em)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id_loja, id_insumo) DO UPDATE
       SET quantidade = estoque_saldos.quantidade + EXCLUDED.quantidade,
           atualizado_em = NOW()
     RETURNING quantidade`,
    [id_loja, idInsumo, delta],
  );
  const saldo_apos = num(rows[0]?.quantidade);

  const { rows: mov } = await client.query(
    `INSERT INTO estoque_movimentos
       (id_loja, id_insumo, tipo, quantidade, saldo_apos,
        referencia_tipo, referencia_id, observacao, criado_por, data_movimento)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date)
     RETURNING id_movimento`,
    [
      id_loja,
      idInsumo,
      tipo,
      delta,
      saldo_apos,
      referencia_tipo,
      referencia_id,
      observacao,
      criado_por,
      dataMov,
    ],
  );

  return { id_movimento: mov[0].id_movimento, saldo_apos, data_movimento: dataMov };
}

export async function obterSaldo(idLoja, idInsumo, client = pool) {
  const { rows } = await client.query(
    `SELECT quantidade FROM estoque_saldos
     WHERE id_loja = $1 AND id_insumo = $2`,
    [idLoja, idInsumo],
  );
  return rows.length ? num(rows[0].quantidade) : 0;
}

/**
 * Registra compras/entregas (entrada de estoque).
 * itens: [{ id_insumo? | codigo?, quantidade, observacao? }]
 * quantidade > 0 (unidades de contagem do insumo).
 */
export async function registrarEntradas({
  id_loja,
  itens,
  observacao = null,
  criado_por = null,
  referencia = null,
  /** id_nfe (INTEGER) — preferir em vez de chave string */
  id_nfe = null,
  /**
   * Data em que a mercadoria ENTROU na loja (não a emissão da NF).
   * CMV real agrupa compras por esta data.
   */
  data_entrega = null,
} = {}) {
  const idLoja = Number(id_loja);
  const lista = Array.isArray(itens) ? itens : [];
  if (!idLoja || !lista.length) {
    throw Object.assign(new Error('Informe a loja e os itens da compra'), { status: 400 });
  }
  const dataEntrega = isoDate(data_entrega) || hojeSpISO();
  const refId = Number(id_nfe) || (Number.isFinite(Number(referencia)) ? Number(referencia) : null);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const baixas = [];
    const erros = [];

    for (const raw of lista) {
      const qtde = num(raw.quantidade ?? raw.qtde);
      if (qtde <= 0) {
        erros.push(`Quantidade inválida: ${raw.codigo || raw.id_insumo}`);
        continue;
      }
      let idInsumo = Number(raw.id_insumo) || null;
      let codigo = raw.codigo != null ? String(raw.codigo).trim() : '';
      if (!idInsumo && codigo) {
        const ins = await resolverInsumoPorCodigo(client, idLoja, codigo);
        if (!ins) {
          erros.push(`Insumo ${codigo} não cadastrado`);
          continue;
        }
        idInsumo = ins.id_insumo;
        codigo = ins.codigo;
      }
      if (!idInsumo) {
        erros.push('Item sem id_insumo/codigo');
        continue;
      }
      const mov = await aplicarMovimento(client, {
        id_loja: idLoja,
        id_insumo: idInsumo,
        tipo: 'entrada',
        quantidade: qtde,
        referencia_tipo: refId ? 'estoque_nfe' : 'compra',
        referencia_id: refId,
        observacao: raw.observacao || observacao || 'Entrada / compra',
        criado_por,
        data_movimento: isoDate(raw.data_entrega) || dataEntrega,
      });
      baixas.push({
        id_insumo: idInsumo,
        codigo,
        quantidade: qtde,
        saldo_apos: mov.saldo_apos,
        id_movimento: mov.id_movimento,
        data_movimento: mov.data_movimento,
      });
    }

    if (!baixas.length) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error(erros[0] || 'Nenhum item válido'), { status: 400 });
    }

    await client.query('COMMIT');
    return {
      ok: erros.length === 0,
      entradas: baixas,
      erros,
      data_entrega: dataEntrega,
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * CMV teórico no período.
 * R$ só usa insumos com custo_fonte IN ('nf','manual','catalogo') — nunca preço de planilha.
 * Meta % só é “confiável” se cobertura_custo_pct >= 80.
 * Inclui break (consumo da galera) no mesmo período — baixa real de estoque fora da venda.
 */
export async function calcularCmvTeorico(idLoja, { de = null, ate = null, meta = 0.38 } = {}) {
  const params = [idLoja];
  let filtro = '';
  if (de) {
    params.push(de);
    filtro += ` AND v.data_venda >= $${params.length}::date`;
  }
  if (ate) {
    params.push(ate);
    filtro += ` AND v.data_venda <= $${params.length}::date`;
  }

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
      WHERE v.id_loja = $1 ${FILTRO_VENDA_BK} ${filtro}
    ),
    custos AS (
      SELECT
        l.id_item,
        l.qtde,
        l.venda_liquida,
        l.sem_ficha,
        l.requer_ficha,
        l.tem_ficha,
        COALESCE((
          SELECT SUM(
            COALESCE(fi.qtde_estoque, fi.quantidade) *
            CASE WHEN ins.custo_fonte IN ('nf', 'manual', 'catalogo') THEN COALESCE(ins.valor_unidade, 0) ELSE 0 END
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
            AND (ins.id_insumo IS NULL OR ins.custo_fonte IS NULL OR ins.custo_fonte NOT IN ('nf', 'manual', 'catalogo'))
        ), 0) AS insumos_sem_custo_nf
      FROM linhas l
    )
    SELECT
      COALESCE(SUM(venda_liquida), 0)::numeric AS venda_liquida,
      COALESCE(SUM(qtde * custo_unit_valido), 0)::numeric AS custo_teorico,
      COUNT(*)::int AS itens,
      COUNT(*) FILTER (WHERE sem_ficha IS TRUE OR (requer_ficha AND NOT tem_ficha))::int AS itens_sem_ficha,
      COUNT(*) FILTER (WHERE tem_ficha AND insumos_sem_custo_nf = 0 AND custo_unit_valido > 0)::int AS itens_com_custo_completo,
      COUNT(*) FILTER (WHERE tem_ficha)::int AS itens_com_ficha
    FROM custos
    `,
    params,
  );

  const { rows: diasRows } = await pool.query(
    `SELECT COUNT(DISTINCT data_venda)::int AS dias_venda
     FROM estoque_vendas v WHERE v.id_loja = $1 ${FILTRO_VENDA_BK} ${filtro}`,
    params,
  );

  const frescor = await resumoFrescorVendas(idLoja);
  const breakInfo = await calcularConsumoBreak(idLoja, { de, ate });

  const venda = num(rows[0]?.venda_liquida);
  const custo = num(rows[0]?.custo_teorico);
  const custoBreak = num(breakInfo.custo_break);
  const custoComBreak = custo + custoBreak;
  const itens = rows[0]?.itens || 0;
  const comCusto = rows[0]?.itens_com_custo_completo || 0;
  const comFicha = rows[0]?.itens_com_ficha || 0;
  const cobertura = comFicha > 0 ? (comCusto / comFicha) * 100 : 0;
  const metaN = num(meta, 0.38);
  const confiavelBase = cobertura >= 80 && venda > 0 && custo > 0;
  const pct = confiavelBase ? custo / venda : null;
  const pctComBreak = venda > 0 && (confiavelBase || custoBreak > 0) ? custoComBreak / venda : null;
  /** CMV > 70% quase sempre = und_convertida/preço unitário errado — não marcar como confiável. */
  const custoSuspeito = pct != null && pct > 0.7;
  const confiavel = confiavelBase && !custoSuspeito;

  return {
    id_loja: idLoja,
    de: de || null,
    ate: ate || null,
    /** Valor = Bruto do BK Office. */
    venda_liquida: Math.round(venda * 100) / 100,
    venda_bruta: Math.round(venda * 100) / 100,
    custo_teorico: Math.round(custo * 100) / 100,
    cmv_teorico_pct: pct != null ? Math.round(pct * 10000) / 100 : null,
    /** Break = consumo da galera (baixa real de estoque no período). */
    custo_break: Math.round(custoBreak * 100) / 100,
    qtd_breaks: breakInfo.qtd_breaks,
    break_pct_venda:
      venda > 0 && custoBreak > 0 ? Math.round((custoBreak / venda) * 10000) / 100 : null,
    custo_total: Math.round(custoComBreak * 100) / 100,
    cmv_com_break_pct:
      pctComBreak != null && (confiavelBase || custoBreak > 0)
        ? Math.round(pctComBreak * 10000) / 100
        : null,
    meta_pct: Math.round(metaN * 10000) / 100,
    gap_pp: pct != null ? Math.round((pct - metaN) * 10000) / 100 : null,
    gap_reais:
      pct != null ? Math.round((custo - venda * metaN) * 100) / 100 : null,
    itens,
    itens_sem_ficha: rows[0]?.itens_sem_ficha || 0,
    itens_com_ficha: comFicha,
    itens_com_custo_completo: comCusto,
    cobertura_custo_pct: Math.round(cobertura * 10) / 10,
    cmv_confiavel: confiavel,
    custo_suspeito: custoSuspeito,
    dias_venda: diasRows[0]?.dias_venda || 0,
    ultima_data_venda: frescor.ultima_data_venda,
    ultimo_sync_em: frescor.ultimo_sync_em,
    venda_hoje: frescor.venda_hoje,
    itens_hoje: frescor.itens_hoje,
    itens_dia_tipico: frescor.itens_dia_tipico,
    hoje_ausente: frescor.hoje_ausente,
    hoje_parcial: frescor.hoje_parcial,
    aviso: !confiavelBase
      ? 'CMV em R$ só fica confiável com custo de nota fiscal nos insumos (cobertura ≥ 80%). Ficha (quantidade) já conta; preço da planilha não. Break (consumo) entra à parte quando há custo válido.'
      : custoSuspeito
        ? `CMV teórico ${Math.round(pct * 1000) / 10}% está absurdo (custo > venda). Quase sempre und_convertida errada (preço de caixa tratado como unidade). Corrija und_convertida dos insumos — o modelo certo é: consumo teórico = vendas × ficha; CMV% = custo desse consumo ÷ venda.`
        : null,
  };
}

/**
 * Custo do break (consumo colaboradores) no período, via movimentos reais de estoque.
 */
export async function calcularConsumoBreak(idLoja, { de = null, ate = null } = {}) {
  const params = [idLoja];
  let filtro = '';
  if (de) {
    params.push(de);
    filtro += ` AND b.data_break >= $${params.length}::date`;
  }
  if (ate) {
    params.push(ate);
    filtro += ` AND b.data_break <= $${params.length}::date`;
  }

  const { rows } = await pool.query(
    `
    SELECT
      COUNT(DISTINCT b.id_break)::int AS qtd_breaks,
      COALESCE(SUM(
        ABS(m.quantidade) * CASE
          WHEN i.custo_fonte IN ('nf', 'manual', 'catalogo') THEN COALESCE(i.valor_unidade, 0)
          ELSE 0
        END
      ), 0)::numeric AS custo_break,
      COALESCE(SUM(ABS(m.quantidade)), 0)::numeric AS qtde_insumos
    FROM estoque_break b
    JOIN estoque_movimentos m
      ON m.referencia_tipo = 'estoque_break'
     AND m.referencia_id = b.id_break
     AND m.tipo = 'break'
     AND m.id_loja = b.id_loja
    JOIN insumos i ON i.id_insumo = m.id_insumo
    WHERE b.id_loja = $1
      AND COALESCE(b.tipo, 'refeicao') IN ('refeicao', 'outro')
      ${filtro}
    `,
    params,
  );

  return {
    qtd_breaks: rows[0]?.qtd_breaks || 0,
    custo_break: num(rows[0]?.custo_break),
    qtde_insumos: num(rows[0]?.qtde_insumos),
  };
}

/**
 * Pedido sugerido: vendas da semana anterior (mesmo intervalo DOW) × crescimento,
 * explode ficha → insumos, menos saldo atual.
 */
export async function calcularPedidoSugerido(
  idLoja,
  { crescimento = 0.05, dias = 7, estoque_seguranca_dias = 1 } = {},
) {
  const id = Number(idLoja);
  const cres = Number(crescimento);
  const nDias = Math.min(Math.max(Number(dias) || 7, 1), 31);
  const segDias = Math.max(Number(estoque_seguranca_dias) || 0, 0);

  const { rows: vendas } = await pool.query(
    `
    SELECT vi.codigo, MAX(vi.descricao) AS descricao, SUM(vi.qtde)::numeric AS qtde
    FROM estoque_vendas v
    JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE v.id_loja = $1 ${FILTRO_VENDA_BK}
      AND v.data_venda >= (CURRENT_DATE - ($2::int || ' days')::interval)::date
      AND v.data_venda < CURRENT_DATE
    GROUP BY vi.codigo
    `,
    [id, nDias],
  );

  const consumo = new Map(); // codigo_insumo -> { descricao, qtde }
  for (const v of vendas) {
    const qProj = num(v.qtde) * (1 + (Number.isFinite(cres) ? cres : 0));
    const { rows: ficha } = await pool.query(
      `
      SELECT fi.codigo_insumo, COALESCE(fi.qtde_estoque, fi.quantidade) AS q_est,
             COALESCE(ins.descricao, fi.codigo_insumo) AS descricao,
             COALESCE(s.quantidade, 0) AS saldo
      FROM produtos p
      JOIN ficha_tecnica f ON f.id_produto = p.id_produto AND f.ativo
      JOIN ficha_tecnica_itens fi ON fi.id_ficha = f.id_ficha
      LEFT JOIN insumos ins ON ins.id_loja = p.id_loja AND UPPER(ins.codigo) = UPPER(fi.codigo_insumo)
      LEFT JOIN estoque_saldos s ON s.id_loja = p.id_loja AND s.id_insumo = ins.id_insumo
      WHERE p.id_loja = $1 AND p.codigo = $2 AND p.ativo
      `,
      [id, String(v.codigo)],
    );
    // unitário: baixa 1:1 no próprio código se existir insumo
    if (!ficha.length) {
      const { rows: unit } = await pool.query(
        `
        SELECT i.codigo AS codigo_insumo, i.descricao, COALESCE(s.quantidade, 0) AS saldo
        FROM produtos p
        JOIN insumos i ON i.id_loja = p.id_loja AND UPPER(i.codigo) = UPPER(p.codigo)
        LEFT JOIN estoque_saldos s ON s.id_loja = i.id_loja AND s.id_insumo = i.id_insumo
        WHERE p.id_loja = $1 AND p.codigo = $2 AND p.ativo AND p.requer_ficha = FALSE
        `,
        [id, String(v.codigo)],
      );
      for (const u of unit) {
        const prev = consumo.get(u.codigo_insumo) || {
          codigo: u.codigo_insumo,
          descricao: u.descricao,
          consumo_projetado: 0,
          saldo: num(u.saldo),
        };
        prev.consumo_projetado += qProj;
        prev.saldo = num(u.saldo);
        consumo.set(u.codigo_insumo, prev);
      }
      continue;
    }
    for (const f of ficha) {
      const prev = consumo.get(f.codigo_insumo) || {
        codigo: f.codigo_insumo,
        descricao: f.descricao,
        consumo_projetado: 0,
        saldo: num(f.saldo),
      };
      prev.consumo_projetado += qProj * num(f.q_est);
      prev.saldo = num(f.saldo);
      consumo.set(f.codigo_insumo, prev);
    }
  }

  const itens = [...consumo.values()]
    .map((c) => {
      const consumoDia = nDias > 0 ? c.consumo_projetado / nDias : 0;
      const seguranca = consumoDia * segDias;
      const sugerido = Math.max(0, c.consumo_projetado + seguranca - c.saldo);
      return {
        codigo: c.codigo,
        descricao: c.descricao,
        consumo_projetado: Math.round(c.consumo_projetado * 1000) / 1000,
        estoque_seguranca: Math.round(seguranca * 1000) / 1000,
        saldo_atual: Math.round(c.saldo * 1000) / 1000,
        pedido_sugerido: Math.round(sugerido * 1000) / 1000,
        pedido_ajustado: Math.round(sugerido * 1000) / 1000,
      };
    })
    .filter((c) => c.consumo_projetado > 0)
    .sort((a, b) => b.pedido_sugerido - a.pedido_sugerido);

  return {
    id_loja: id,
    periodo_dias: nDias,
    crescimento_pct: Math.round((Number.isFinite(cres) ? cres : 0) * 10000) / 100,
    estoque_seguranca_dias: segDias,
    produtos_base: vendas.length,
    itens,
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function round2(v) {
  return Math.round(num(v) * 100) / 100;
}

function round1(v) {
  return Math.round(num(v) * 10) / 10;
}

/**
 * Último dia importado do BK Office e se o dia de hoje está faltando ou pela metade.
 * O app não é tempo real: o kit no PC baixa loja a loja.
 */
async function resumoFrescorVendas(idLoja) {
  const hoje = hojeSpISO();
  const { rows: cab } = await pool.query(
    `
    SELECT MAX(data_venda)::text AS ultima_data,
           MAX(COALESCE(processado_em, criado_em)) AS ultimo_sync_em
    FROM estoque_vendas
    WHERE id_loja = $1 AND origem = 'bkoffice'
    `,
    [idLoja],
  );
  const { rows: hojeRows } = await pool.query(
    `
    SELECT COALESCE(SUM(vi.venda_liquida), 0)::numeric AS venda,
           COUNT(*)::int AS itens
    FROM estoque_vendas v
    JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE v.id_loja = $1 AND v.data_venda = $2::date ${FILTRO_VENDA_BK}
    `,
    [idLoja, hoje],
  );
  const { rows: tipico } = await pool.query(
    `
    SELECT COALESCE(AVG(n), 0)::numeric AS media_itens
    FROM (
      SELECT COUNT(*)::int AS n
      FROM estoque_vendas v
      JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
      WHERE v.id_loja = $1 ${FILTRO_VENDA_BK}
        AND v.data_venda >= ($2::date - INTERVAL '7 days')
        AND v.data_venda < $2::date
      GROUP BY v.data_venda
    ) t
    `,
    [idLoja, hoje],
  );
  const ultima = String(cab[0]?.ultima_data || '').slice(0, 10) || null;
  const itensHoje = Number(hojeRows[0]?.itens || 0);
  const mediaItens = num(tipico[0]?.media_itens);
  const hojeAusente = !ultima || ultima < hoje;
  const hojeParcial =
    !hojeAusente && mediaItens >= 20 && itensHoje > 0 && itensHoje < mediaItens * 0.45;
  return {
    ultima_data_venda: ultima,
    ultimo_sync_em: cab[0]?.ultimo_sync_em || null,
    venda_hoje: round2(hojeRows[0]?.venda),
    itens_hoje: itensHoje,
    itens_dia_tipico: Math.round(mediaItens),
    hoje_ausente: hojeAusente,
    hoje_parcial: hojeParcial,
  };
}

/**
 * Meta de venda da loja: mesmo mês do ano passado × (1 + crescimento).
 * Sem base YoY, devolve realizado / ritmo / projeção e deixa meta nula.
 */
export async function calcularMetaVendas(idLoja, { crescimento = 0.1 } = {}) {
  const id = Number(idLoja);
  const cres = Number.isFinite(Number(crescimento)) ? Number(crescimento) : 0.1;
  const hoje = hojeSpISO();
  const [ys, ms, ds] = hoje.split('-').map(Number);
  const diasMes = new Date(ys, ms, 0).getDate();
  const yLy = ys - 1;
  const diasMesLy = new Date(yLy, ms, 0).getDate();
  const diaLy = Math.min(ds, diasMesLy);
  const inicio = `${ys}-${pad2(ms)}-01`;
  const fim = `${ys}-${pad2(ms)}-${pad2(diasMes)}`;
  const inicioLy = `${yLy}-${pad2(ms)}-01`;
  const hojeLy = `${yLy}-${pad2(ms)}-${pad2(diaLy)}`;
  const fimLy = `${yLy}-${pad2(ms)}-${pad2(diasMesLy)}`;

  const { rows: diasRows } = await pool.query(
    `
    SELECT v.data_venda::text AS data,
           COALESCE(SUM(vi.venda_liquida), 0)::numeric AS venda
    FROM estoque_vendas v
    JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE v.id_loja = $1 ${FILTRO_VENDA_BK}
      AND (
        (v.data_venda >= $2::date AND v.data_venda <= $3::date)
        OR (v.data_venda >= $4::date AND v.data_venda <= $5::date)
      )
    GROUP BY v.data_venda
    ORDER BY v.data_venda
    `,
    [id, inicio, hoje, inicioLy, fimLy],
  );

  const porData = new Map(diasRows.map((r) => [String(r.data).slice(0, 10), num(r.venda)]));
  let vendaMtd = 0;
  let vendaLyMtd = 0;
  let vendaLyMes = 0;
  const dias = [];
  for (let d = 1; d <= ds; d++) {
    const data = `${ys}-${pad2(ms)}-${pad2(d)}`;
    const dataLy = `${yLy}-${pad2(ms)}-${pad2(Math.min(d, diasMesLy))}`;
    const venda = porData.get(data) || 0;
    const vendaLy = porData.get(dataLy) || 0;
    vendaMtd += venda;
    vendaLyMtd += vendaLy;
    dias.push({
      data,
      data_ly: dataLy,
      venda: round2(venda),
      venda_ly: round2(vendaLy),
      sem_sync: venda <= 0,
    });
  }
  for (let d = 1; d <= diasMesLy; d++) {
    vendaLyMes += porData.get(`${yLy}-${pad2(ms)}-${pad2(d)}`) || 0;
  }

  const diasVenda = dias.filter((x) => x.venda > 0).length;
  const temLy = vendaLyMtd > 0 || vendaLyMes > 0;
  const fator = 1 + (Number.isFinite(cres) ? cres : 0);
  const metaMtd = temLy ? round2(vendaLyMtd * fator) : null;
  const metaMes = temLy ? round2(vendaLyMes * fator) : null;
  const mediaDia = ds > 0 ? vendaMtd / ds : 0;
  const diasRestantes = Math.max(0, diasMes - ds);
  const projecaoRestante = round2(mediaDia * diasRestantes);
  const projecao = round2(vendaMtd + projecaoRestante);
  const atingimentoMtd = metaMtd && metaMtd > 0 ? round1((vendaMtd / metaMtd) * 100) : null;
  const ritmoMes = metaMes && metaMes > 0 ? round1((projecao / metaMes) * 100) : null;
  const frescor = await resumoFrescorVendas(id);

  const { rows: topRows } = await pool.query(
    `
    SELECT vi.codigo,
           MAX(vi.descricao) AS descricao,
           COALESCE(SUM(vi.venda_liquida), 0)::numeric AS venda,
           COALESCE(SUM(vi.qtde), 0)::numeric AS qtde
    FROM estoque_vendas v
    JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE v.id_loja = $1 ${FILTRO_VENDA_BK}
      AND v.data_venda >= $2::date
      AND v.data_venda <= $3::date
    GROUP BY vi.codigo
    ORDER BY venda DESC
    LIMIT 8
    `,
    [id, inicio, hoje],
  );

  const breakInfo = await calcularConsumoBreak(id, { de: inicio, ate: hoje });
  const meses = [
    '',
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];

  return {
    id_loja: id,
    ano: ys,
    mes: ms,
    mes_nome: meses[ms] || '',
    de: inicio,
    ate: hoje,
    fim_mes: fim,
    dias_mes: diasMes,
    dias_decorridos: ds,
    dias_restantes: diasRestantes,
    dias_venda: diasVenda,
    crescimento_pct: round1((Number.isFinite(cres) ? cres : 0) * 100),
    venda_mtd: round2(vendaMtd),
    venda_ly_mtd: round2(vendaLyMtd),
    venda_ly_mes: round2(vendaLyMes),
    meta_mtd: metaMtd,
    meta_mes: metaMes,
    gap_mtd: metaMtd != null ? round2(vendaMtd - metaMtd) : null,
    media_dia: round2(mediaDia),
    projecao_restante: projecaoRestante,
    projecao_mes: projecao,
    atingimento_mtd_pct: atingimentoMtd,
    ritmo_mes_pct: ritmoMes,
    tem_base_ly: temLy,
    ultima_data_venda: frescor.ultima_data_venda,
    ultimo_sync_em: frescor.ultimo_sync_em,
    venda_hoje: frescor.venda_hoje,
    itens_hoje: frescor.itens_hoje,
    itens_dia_tipico: frescor.itens_dia_tipico,
    hoje_ausente: frescor.hoje_ausente,
    hoje_parcial: frescor.hoje_parcial,
    aviso: null,
    break_custo: round2(breakInfo.custo_break),
    break_qtd: breakInfo.qtd_breaks,
    break_pct_venda: vendaMtd > 0 && num(breakInfo.custo_break) > 0
      ? round1((num(breakInfo.custo_break) / vendaMtd) * 100)
      : null,
    top_produtos: topRows.map((r) => ({
      codigo: r.codigo,
      descricao: r.descricao,
      venda: round2(r.venda),
      qtde: Math.round(num(r.qtde) * 1000) / 1000,
    })),
    dias,
  };
}

/**
 * Painel: sync BK Office por loja (último dia, horário, bruto do mês).
 * @param {number[]|null} idsPermitidos — null = todas com BKN
 */
export async function listarStatusSyncVendasLojas(idsPermitidos = null) {
  const hoje = hojeSpISO();
  const ontem = (() => {
    const [y, m, d] = hoje.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  })();
  const inicioMes = `${hoje.slice(0, 8)}01`;
  const ids =
    Array.isArray(idsPermitidos) && idsPermitidos.length
      ? idsPermitidos.map(Number).filter((n) => n > 0)
      : null;

  const { rows } = await pool.query(
    `
    SELECT
      l.id_loja,
      l.bk_number,
      l.name,
      MAX(v.data_venda)::text AS ultima_data_venda,
      MAX(COALESCE(v.processado_em, v.criado_em)) AS ultimo_sync_em,
      COALESCE(SUM(vi.venda_liquida) FILTER (
        WHERE v.data_venda >= $1::date AND v.data_venda <= $2::date
      ), 0)::float AS venda_mes,
      COALESCE(SUM(vi.venda_liquida) FILTER (
        WHERE v.data_venda = $2::date
      ), 0)::float AS venda_hoje
    FROM lojas l
    LEFT JOIN estoque_vendas v
      ON v.id_loja = l.id_loja AND v.origem = 'bkoffice'
    LEFT JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE l.bk_number IS NOT NULL AND trim(l.bk_number) <> ''
      AND ($3::int[] IS NULL OR l.id_loja = ANY($3::int[]))
    GROUP BY l.id_loja, l.bk_number, l.name
    ORDER BY l.name
    `,
    [inicioMes, hoje, ids],
  );

  const agora = Date.now();
  return {
    hoje,
    inicio_mes: inicioMes,
    lojas: rows.map((r) => {
      const ultima = String(r.ultima_data_venda || '').slice(0, 10) || null;
      const syncEm = r.ultimo_sync_em ? new Date(r.ultimo_sync_em) : null;
      const minSemSync =
        syncEm && !Number.isNaN(syncEm.getTime())
          ? Math.max(0, Math.round((agora - syncEm.getTime()) / 60000))
          : null;
      let status = 'sem_sync';
      let status_label = 'Sem sync';
      if (ultima === hoje) {
        status = 'hoje';
        status_label = 'Hoje ok';
      } else if (ultima === ontem) {
        status = 'ontem';
        status_label = 'Até ontem';
      } else if (ultima) {
        status = 'atrasado';
        status_label = 'Atrasado';
      }
      return {
        id_loja: Number(r.id_loja),
        bk_number: String(r.bk_number || '').replace(/\D/g, '') || null,
        name: r.name,
        ultima_data_venda: ultima,
        ultimo_sync_em: syncEm && !Number.isNaN(syncEm.getTime()) ? syncEm.toISOString() : null,
        minutos_sem_sync: minSemSync,
        venda_mes: round2(r.venda_mes),
        venda_hoje: round2(r.venda_hoje),
        status,
        status_label,
      };
    }),
  };
}

/** Atualiza custo do insumo a partir de NF (ou manual). */
export async function atualizarCustoInsumo(
  idLoja,
  { id_insumo = null, codigo = null, preco_caixa, und_convertida = null, fonte = 'nf' } = {},
) {
  const fonteOk =
    fonte === 'manual' ? 'manual' : fonte === 'catalogo' ? 'catalogo' : 'nf';
  const preco = num(preco_caixa);
  if (preco < 0) throw Object.assign(new Error('Preço inválido'), { status: 400 });
  let id = Number(id_insumo) || null;
  if (!id && codigo) {
    const ins = await resolverInsumoPorCodigo(pool, idLoja, codigo);
    if (!ins) throw Object.assign(new Error('Insumo não encontrado'), { status: 404 });
    id = ins.id_insumo;
  }
  if (!id) throw Object.assign(new Error('Informe id_insumo ou codigo'), { status: 400 });

  const und = und_convertida != null ? num(und_convertida) : null;
  const { rows } = await pool.query(
    `
    UPDATE insumos SET
      preco_caixa = $3,
      und_convertida = CASE WHEN $4::numeric > 0 THEN $4::numeric ELSE und_convertida END,
      custo_fonte = $5,
      atualizado_em = NOW()
    WHERE id_loja = $1 AND id_insumo = $2
    RETURNING id_insumo, codigo, descricao, preco_caixa, und_convertida, valor_unidade, custo_fonte
    `,
    [idLoja, id, preco, und, fonteOk],
  );
  if (!rows.length) throw Object.assign(new Error('Insumo não encontrado'), { status: 404 });
  return rows[0];
}

/** Resolve insumo de estoque por loja + código (alias canônico, depois código exato). */
export async function resolverInsumoPorCodigo(client, idLoja, codigo) {
  return resolverInsumoCanonico(client, idLoja, codigo);
}

/** Upsert produto de venda pelo código BK, por loja.
 * @param {object} [opts]
 * @param {boolean} [opts.ativo] — se informado, aplica no insert/update; senão insert=true e update preserva.
 */
export async function upsertProdutoVenda(client, codigo, descricao = '', idLoja = null, opts = {}) {
  const cod = String(codigo || '').trim();
  if (!cod) return null;
  const id_loja = Number(idLoja);
  if (!Number.isFinite(id_loja) || id_loja <= 0) {
    throw Object.assign(new Error('Informe a loja do produto'), { status: 400 });
  }
  const desc = String(descricao || '').trim() || cod;
  const temAtivo = typeof opts.ativo === 'boolean';
  const ativoInsert = temAtivo ? opts.ativo : true;
  const temRequer = typeof opts.requer_ficha === 'boolean';
  const requerInsert = temRequer ? opts.requer_ficha : true;
  const { rows } = await client.query(
    `INSERT INTO produtos (id_loja, codigo, descricao, ativo, requer_ficha, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id_loja, codigo) DO UPDATE
       SET descricao = CASE
             WHEN EXCLUDED.descricao <> '' AND EXCLUDED.descricao <> EXCLUDED.codigo
             THEN EXCLUDED.descricao
             ELSE produtos.descricao
           END,
           ativo = CASE WHEN $6::boolean IS NOT NULL THEN $6::boolean ELSE produtos.ativo END,
           requer_ficha = CASE WHEN $7::boolean IS NOT NULL THEN $7::boolean ELSE produtos.requer_ficha END,
           atualizado_em = NOW()
     RETURNING *`,
    [
      id_loja,
      cod,
      desc,
      ativoInsert,
      requerInsert,
      temAtivo ? opts.ativo : null,
      temRequer ? opts.requer_ficha : null,
    ],
  );
  return rows[0];
}

export async function carregarFichaPorCodigoVenda(client, codigoVenda, idLoja = null) {
  const cod = String(codigoVenda || '').trim();
  if (!cod) return null;
  const params = [cod];
  let filtroLoja = '';
  if (idLoja != null) {
    params.push(Number(idLoja));
    filtroLoja = ` AND pv.id_loja = $${params.length}`;
  }
  const { rows: pv } = await client.query(
    `SELECT pv.*, f.id_ficha, f.ativo AS ficha_ativa
     FROM produtos pv
     LEFT JOIN ficha_tecnica f ON f.id_produto = pv.id_produto AND f.ativo = TRUE
     WHERE pv.codigo = $1 AND pv.ativo = TRUE${filtroLoja}
     LIMIT 1`,
    params,
  );
  if (!pv.length || !pv[0].id_ficha) return null;

  const { rows: itens } = await client.query(
    `SELECT id_item, codigo_insumo, quantidade, unidade_receita, qtde_estoque, observacao
     FROM ficha_tecnica_itens
     WHERE id_ficha = $1
     ORDER BY codigo_insumo`,
    [pv[0].id_ficha],
  );
  if (!itens.length) return null;

  return {
    produto_venda: pv[0],
    id_ficha: pv[0].id_ficha,
    itens,
  };
}

/**
 * Baixa insumos de uma quantidade de produto de venda via ficha.
 * Retorna { ok, sem_ficha, baixas[], erros[] }.
 */
export async function baixarPorProdutoVenda(
  client,
  {
    id_loja,
    codigo_venda,
    quantidade,
    tipo = 'venda',
    referencia_tipo = null,
    referencia_id = null,
    observacao = null,
    criado_por = null,
  },
) {
  const qtde = num(quantidade);
  if (qtde <= 0) {
    return { ok: false, sem_ficha: false, baixas: [], erros: ['Quantidade inválida'] };
  }

  await garantirSchemaPilotoBaixa(pool);
  const pilotoVenda = tipo === 'venda' && (await lojaEmPilotoBaixa(client, id_loja));
  const ignorados = [];
  const pendencias = [];

  const registrarPulo = async (motivo, extra) => {
    pendencias.push({ motivo, ...extra });
    await registrarPendenciaBaixa(client, {
      id_loja,
      codigo_venda: String(codigo_venda || '').trim(),
      motivo,
      observacao: observacao || null,
      ...extra,
    });
  };

  const codVenda = String(codigo_venda || '').trim();
  const { rows: prodRows } = await client.query(
    `SELECT id_produto, codigo, descricao, requer_ficha
     FROM produtos
     WHERE id_loja = $1 AND codigo = $2 AND ativo = TRUE
     LIMIT 1`,
    [id_loja, codVenda],
  );

  const auditoria = pilotoVenda
    ? await criarSessaoAuditoriaPiloto(client, {
        id_loja,
        codigo_venda: codVenda,
        quantidade_vendida: qtde,
        referencia_tipo,
        referencia_id,
        descricao_produto: prodRows[0]?.descricao || null,
      })
    : null;

  // Produto unitário (Coca, brinquedo…): não exige ficha.
  // Se existir insumo com o mesmo código, baixa 1:1; senão só processa a venda.
  if (prodRows[0] && prodRows[0].requer_ficha === false) {
    const insumo = await resolverInsumoPorCodigo(client, id_loja, codVenda);
    if (!insumo) {
      return {
        ok: true,
        sem_ficha: false,
        unitario: true,
        baixas: [],
        erros: [],
        ignorados,
        pendencias,
        id_produto: prodRows[0].id_produto,
      };
    }
    if (pilotoVenda && !insumo.contagem_diaria) {
      ignorados.push({ codigo: insumo.codigo, motivo: MOTIVO_BAIXA.FORA_PILOTO });
      const saldo = await obterSaldo(id_loja, insumo.id_insumo, client);
      await auditoria?.log({
        status: STATUS_AUDITORIA_PILOTO.FORA_DO_PILOTO,
        codigo_ficha: insumo.codigo,
        id_insumo: insumo.id_insumo,
        codigo_insumo: insumo.codigo,
        descricao_insumo: insumo.descricao,
        unidade_estoque: insumo.unidade_contagem,
        delta: 0,
        saldo_antes: saldo,
        saldo_depois: saldo,
      });
      return {
        ok: true,
        sem_ficha: false,
        unitario: true,
        baixas: [],
        erros: [],
        ignorados,
        pendencias,
        id_produto: prodRows[0].id_produto,
      };
    }
    const saldoAntes = await obterSaldo(id_loja, insumo.id_insumo, client);
    const delta = -qtde;
    const mov = await aplicarMovimento(client, {
      id_loja,
      id_insumo: insumo.id_insumo,
      tipo,
      quantidade: delta,
      referencia_tipo,
      referencia_id,
      observacao: observacao || `Baixa unitária: ${codVenda} x${qtde}`,
      criado_por,
    });
    await auditoria?.log({
      status: STATUS_AUDITORIA_PILOTO.MOVIMENTO_GERADO,
      codigo_ficha: insumo.codigo,
      id_insumo: insumo.id_insumo,
      codigo_insumo: insumo.codigo,
      descricao_insumo: insumo.descricao,
      quantidade_receita: qtde,
      unidade_receita: insumo.unidade_contagem,
      unidade_estoque: insumo.unidade_contagem,
      fator_aplicado: 1,
      origem_conversao: 'identidade',
      consumo_unitario: 1,
      delta,
      saldo_antes: saldoAntes,
      saldo_depois: mov.saldo_apos,
      observacao: 'unitario 1:1',
    });
    return {
      ok: true,
      sem_ficha: false,
      unitario: true,
      baixas: [
        {
          id_insumo: insumo.id_insumo,
          codigo: insumo.codigo,
          quantidade: delta,
          saldo_apos: mov.saldo_apos,
        },
      ],
      erros: [],
      ignorados,
      pendencias,
      id_produto: prodRows[0].id_produto,
    };
  }

  const ficha = await carregarFichaPorCodigoVenda(client, codigo_venda, id_loja);
  if (!ficha) {
    return { ok: false, sem_ficha: true, baixas: [], erros: ['Sem ficha técnica'] };
  }

  const baixas = [];
  const erros = [];

  for (const item of ficha.itens) {
    const insumo = await resolverInsumoPorCodigo(client, id_loja, item.codigo_insumo);
    if (!insumo) {
      erros.push(`Insumo ${item.codigo_insumo} não cadastrado na loja`);
      await registrarPulo(MOTIVO_BAIXA.INSUMO_NAO_CADASTRADO, {
        codigo_insumo: item.codigo_insumo,
        quantidade_receita: num(item.quantidade),
        unidade_receita: item.unidade_receita || 'und',
      });
      await auditoria?.log({
        status: STATUS_AUDITORIA_PILOTO.CONVERSAO_NAO_VALIDADA,
        codigo_ficha: item.codigo_insumo,
        quantidade_receita: num(item.quantidade),
        unidade_receita: item.unidade_receita || 'und',
        observacao: 'insumo não cadastrado na loja',
      });
      continue;
    }

    if (pilotoVenda && !insumo.contagem_diaria) {
      ignorados.push({ codigo: insumo.codigo, motivo: MOTIVO_BAIXA.FORA_PILOTO });
      const saldo = await obterSaldo(id_loja, insumo.id_insumo, client);
      await auditoria?.log({
        status: STATUS_AUDITORIA_PILOTO.FORA_DO_PILOTO,
        codigo_ficha: item.codigo_insumo,
        id_insumo: insumo.id_insumo,
        codigo_insumo: insumo.codigo,
        descricao_insumo: insumo.descricao,
        quantidade_receita: num(item.quantidade),
        unidade_receita: item.unidade_receita || 'und',
        unidade_estoque: insumo.unidade_contagem,
        delta: 0,
        saldo_antes: saldo,
        saldo_depois: saldo,
      });
      continue;
    }

    const consumo = await resolverConsumoInsumo(client, {
      idInsumo: insumo.id_insumo,
      quantidadeReceita: item.quantidade,
      unidadeReceita: item.unidade_receita || 'und',
      unidadeEstoque: insumo.unidade_contagem,
    });
    if (!consumo.ok) {
      await registrarPulo(consumo.motivo, {
        codigo_insumo: insumo.codigo,
        id_insumo: insumo.id_insumo,
        quantidade_receita: num(item.quantidade),
        unidade_receita: item.unidade_receita || 'und',
        unidade_estoque: insumo.unidade_contagem,
      });
      const saldo = await obterSaldo(id_loja, insumo.id_insumo, client);
      await auditoria?.log({
        status: STATUS_AUDITORIA_PILOTO.CONVERSAO_NAO_VALIDADA,
        codigo_ficha: item.codigo_insumo,
        id_insumo: insumo.id_insumo,
        codigo_insumo: insumo.codigo,
        descricao_insumo: insumo.descricao,
        quantidade_receita: num(item.quantidade),
        unidade_receita: item.unidade_receita || 'und',
        unidade_estoque: insumo.unidade_contagem,
        fator_aplicado: consumo.fatorAplicado ?? null,
        origem_conversao: consumo.origemConversao ?? null,
        delta: 0,
        saldo_antes: saldo,
        saldo_depois: saldo,
        observacao: consumo.motivo,
      });
      continue;
    }

    const porUnidadeVenda = consumo.quantidadeEstoque;
    const delta = -(qtde * porUnidadeVenda);
    if (delta === 0) continue;
    const saldoAntes = await obterSaldo(id_loja, insumo.id_insumo, client);
    const mov = await aplicarMovimento(client, {
      id_loja,
      id_insumo: insumo.id_insumo,
      tipo,
      quantidade: delta,
      referencia_tipo,
      referencia_id,
      observacao:
        observacao ||
        `Baixa ${tipo}: ${codigo_venda} x${qtde} → ${insumo.codigo} (receita ${item.quantidade} ${item.unidade_receita || 'und'} = ${porUnidadeVenda} ${insumo.unidade_contagem || ''} via ${consumo.origemConversao})`,
      criado_por,
    });
    await auditoria?.log({
      status: STATUS_AUDITORIA_PILOTO.MOVIMENTO_GERADO,
      codigo_ficha: item.codigo_insumo,
      id_insumo: insumo.id_insumo,
      codigo_insumo: insumo.codigo,
      descricao_insumo: insumo.descricao,
      quantidade_receita: num(item.quantidade),
      unidade_receita: item.unidade_receita || 'und',
      unidade_estoque: insumo.unidade_contagem,
      fator_aplicado: consumo.fatorAplicado ?? null,
      origem_conversao: consumo.origemConversao,
      consumo_unitario: porUnidadeVenda,
      delta,
      saldo_antes: saldoAntes,
      saldo_depois: mov.saldo_apos,
    });
    baixas.push({
      id_insumo: insumo.id_insumo,
      codigo: insumo.codigo,
      quantidade: delta,
      saldo_apos: mov.saldo_apos,
      origem_conversao: consumo.origemConversao,
    });
  }

  const soForaPiloto =
    baixas.length === 0 && erros.length === 0 && ignorados.length > 0 && pendencias.length === 0;

  return {
    ok: (erros.length === 0 && baixas.length > 0) || soForaPiloto,
    sem_ficha: false,
    parcial: baixas.length > 0 && (erros.length > 0 || pendencias.length > 0),
    baixas,
    erros,
    ignorados,
    pendencias,
    id_ficha: ficha.id_ficha,
  };
}

/** Processa itens pendentes de uma venda importada. */
export async function processarVenda(idVenda, { criado_por = null } = {}, externalClient = null) {
  const client = externalClient || (await pool.connect());
  const ownClient = !externalClient;
  try {
    if (ownClient) await client.query('BEGIN');

    const { rows: vendas } = await client.query(
      `SELECT * FROM estoque_vendas WHERE id_venda = $1 FOR UPDATE`,
      [idVenda],
    );
    if (!vendas.length) throw Object.assign(new Error('Venda não encontrada'), { status: 404 });
    const venda = vendas[0];

    const { rows: itens } = await client.query(
      `SELECT * FROM estoque_venda_itens
       WHERE id_venda = $1 AND processado = FALSE
       ORDER BY id_item`,
      [idVenda],
    );

    let processados = 0;
    let semFicha = 0;
    let comErro = 0;

    for (const item of itens) {
      const pv = await upsertProdutoVenda(client, item.codigo, item.descricao, venda.id_loja);
      const result = await baixarPorProdutoVenda(client, {
        id_loja: venda.id_loja,
        codigo_venda: item.codigo,
        quantidade: item.qtde,
        tipo: 'venda',
        referencia_tipo: 'estoque_venda_item',
        referencia_id: item.id_item,
        observacao: `Venda #${idVenda} ${venda.data_venda} — ${item.codigo}`,
        criado_por,
      });

      if (result.sem_ficha) {
        semFicha += 1;
        await client.query(
          `UPDATE estoque_venda_itens
           SET id_produto = $1, sem_ficha = TRUE, processado = FALSE, erro = $2
           WHERE id_item = $3`,
          [pv?.id_produto || null, 'Sem ficha técnica', item.id_item],
        );
        continue;
      }

      if (result.ok || result.parcial) {
        processados += 1;
        await client.query(
          `UPDATE estoque_venda_itens
           SET id_produto = $1, sem_ficha = FALSE, processado = TRUE,
               erro = $2
           WHERE id_item = $3`,
          [
            pv?.id_produto || null,
            result.erros.length ? result.erros.join('; ') : null,
            item.id_item,
          ],
        );
      } else {
        comErro += 1;
        await client.query(
          `UPDATE estoque_venda_itens
           SET id_produto = $1, processado = FALSE, erro = $2
           WHERE id_item = $3`,
          [pv?.id_produto || null, result.erros.join('; ') || 'Falha na baixa', item.id_item],
        );
      }
    }

    const { rows: stats } = await client.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE processado)::int AS processados,
         COUNT(*) FILTER (WHERE sem_ficha AND NOT processado)::int AS sem_ficha,
         COUNT(*) FILTER (WHERE erro IS NOT NULL AND NOT processado AND NOT sem_ficha)::int AS erros
       FROM estoque_venda_itens WHERE id_venda = $1`,
      [idVenda],
    );
    const s = stats[0];
    let status = 'pendente';
    if (s.total > 0 && s.processados === s.total) status = 'processada';
    else if (s.processados > 0 || s.sem_ficha > 0) status = 'parcial';
    else if (s.erros > 0) status = 'erro';

    await client.query(
      `UPDATE estoque_vendas
       SET status = $1, processado_em = CASE WHEN $1 IN ('processada','parcial') THEN NOW() ELSE processado_em END
       WHERE id_venda = $2`,
      [status, idVenda],
    );

    if (ownClient) await client.query('COMMIT');
    return {
      id_venda: idVenda,
      status,
      processados,
      sem_ficha: semFicha,
      erros: comErro,
      stats: s,
    };
  } catch (e) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownClient) client.release();
  }
}

/**
 * Ao finalizar contagem: ajusta saldo para o valor contado.
 */
export async function ajustarSaldoPorContagem(client, idContagem, criado_por = null) {
  const { rows: cont } = await client.query(
    `SELECT id_contagem, id_loja, status, data_contagem
     FROM estoque_contagens WHERE id_contagem = $1`,
    [idContagem],
  );
  if (!cont.length) throw Object.assign(new Error('Contagem não encontrada'), { status: 404 });
  const { id_loja, data_contagem } = cont[0];
  const dataMov = isoDate(data_contagem) || hojeSpISO();

  const { rows: itens } = await client.query(
    `SELECT id_item, id_insumo, estoque_contado, estoque_sistema
     FROM estoque_itens WHERE id_contagem = $1`,
    [idContagem],
  );

  let ajustes = 0;
  for (const item of itens) {
    if (item.estoque_contado == null) continue;
    const contado = num(item.estoque_contado);
    const atual = await obterSaldo(id_loja, item.id_insumo, client);
    const delta = contado - atual;
    if (delta === 0) {
      await client.query(
        `INSERT INTO estoque_saldos (id_loja, id_insumo, quantidade, atualizado_em)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id_loja, id_insumo) DO UPDATE SET atualizado_em = NOW()`,
        [id_loja, item.id_insumo, contado],
      );
      continue;
    }
    await aplicarMovimento(client, {
      id_loja,
      id_insumo: item.id_insumo,
      tipo: 'contagem',
      quantidade: delta,
      referencia_tipo: 'estoque_contagem',
      referencia_id: idContagem,
      observacao: `Ajuste por contagem #${idContagem}`,
      criado_por,
      data_movimento: dataMov,
    });
    ajustes += 1;
  }
  return { ajustes };
}

let schemaBreakCadernoOk = false;

export async function garantirSchemaBreakCaderno(client) {
  if (schemaBreakCadernoOk) return;
  try {
    await client.query(`
      ALTER TABLE estoque_break
        ADD COLUMN IF NOT EXISTS turno TEXT,
        ADD COLUMN IF NOT EXISTS id_loja_destino INTEGER REFERENCES lojas(id_loja) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS motivo_codigo TEXT,
        ADD COLUMN IF NOT EXISTS recebimento_status TEXT,
        ADD COLUMN IF NOT EXISTS recebido_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS recebido_em TIMESTAMPTZ
    `);
    await client.query(`
      ALTER TABLE estoque_break_itens
        ADD COLUMN IF NOT EXISTS contagem_caixa NUMERIC(14, 4),
        ADD COLUMN IF NOT EXISTS contagem_pc_fd NUMERIC(14, 4),
        ADD COLUMN IF NOT EXISTS contagem_kg_und NUMERIC(14, 4)
    `);
    await client.query(`ALTER TABLE estoque_break DROP CONSTRAINT IF EXISTS estoque_break_tipo_check`);
    await client.query(`
      ALTER TABLE estoque_break
        ADD CONSTRAINT estoque_break_tipo_check
        CHECK (tipo IN (
          'refeicao', 'outro',
          'desperdicio_completo', 'desperdicio_incompleto', 'emprestimo'
        ))
    `);
    await client.query(
      `ALTER TABLE estoque_break DROP CONSTRAINT IF EXISTS estoque_break_recebimento_status_check`,
    );
    await client.query(`
      ALTER TABLE estoque_break
        ADD CONSTRAINT estoque_break_recebimento_status_check
        CHECK (recebimento_status IS NULL OR recebimento_status IN ('pendente', 'recebido'))
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_estoque_break_receber
        ON estoque_break (id_loja_destino, recebimento_status)
        WHERE tipo = 'emprestimo' AND recebimento_status = 'pendente'
    `);
  } catch {
    /* coluna/constraint já existem */
  }
  schemaBreakCadernoOk = true;
}

const TIPOS_BREAK_OK = new Set([
  'refeicao',
  'outro',
  'desperdicio_completo',
  'desperdicio_incompleto',
  'emprestimo',
]);

const SQL_LOJA_DESTINO_EMPRESTIMO = `
  COALESCE(is_active, TRUE)
  AND bk_number IS NOT NULL
  AND TRIM(bk_number::text) <> ''
  AND name ~* 'burger king|popyes|popeyes'
`;

/** Lojas da rede que podem receber mercadoria — não depende do cadastro do gestor. */
export async function listarLojasDestinoEmprestimo() {
  const { rows } = await pool.query(
    `SELECT id_loja, name, bk_number, is_active
     FROM lojas
     WHERE ${SQL_LOJA_DESTINO_EMPRESTIMO}
     ORDER BY name`,
  );
  return rows;
}

async function lojaDestinoEmprestimoValida(client, idLoja) {
  const { rows } = await client.query(
    `SELECT id_loja FROM lojas
     WHERE id_loja = $1
       AND ${SQL_LOJA_DESTINO_EMPRESTIMO}`,
    [idLoja],
  );
  return rows[0] || null;
}

function campoContagem(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = num(v);
  return Number.isFinite(n) ? n : null;
}

async function carregarFatoresInsumo(client, idInsumo) {
  await garantirSchemaUnidadeFracionada(client);
  const { rows } = await client.query(
    `SELECT id_insumo, codigo, descricao, unidade_contagem,
            COALESCE(NULLIF(BTRIM(unidade_fracionada), ''), unidade_contagem) AS unidade_fracionada,
            COALESCE(und_convertida, 1) AS und_convertida,
            COALESCE(und_parcial, 1) AS und_parcial,
            COALESCE(permite_contagem_caixa, TRUE) AS permite_contagem_caixa,
            COALESCE(permite_contagem_pc_fd, TRUE) AS permite_contagem_pc_fd,
            COALESCE(permite_contagem_kg_und, TRUE) AS permite_contagem_kg_und
     FROM insumos WHERE id_insumo = $1`,
    [idInsumo],
  );
  if (!rows[0]) return null;
  await anexarFatoresFracionada(client, rows);
  return rows[0];
}

function qtdEmprestimo(fat, raw) {
  const r = resolverQtdContagem({
    contagem_caixa: campoContagem(raw.contagem_caixa ?? raw.caixa),
    contagem_pc_fd: campoContagem(raw.contagem_pc_fd ?? raw.pc),
    contagem_kg_und: campoContagem(raw.contagem_kg_und ?? raw.kg),
    und_convertida: fat.und_convertida,
    und_parcial: fat.und_parcial,
    permite_contagem_caixa: fat.permite_contagem_caixa,
    permite_contagem_pc_fd: fat.permite_contagem_pc_fd,
    permite_contagem_kg_und: fat.permite_contagem_kg_und,
    unidade_contagem: fat.unidade_contagem,
    unidade_fracionada: fat.unidade_fracionada,
    fator_fracionada: fat.fator_fracionada,
    fator_fracionada_status: fat.fator_fracionada_status,
    id_insumo: fat.id_insumo,
    codigo: fat.codigo,
  });
  if (!r.ok) return r;
  return { ok: true, qtd: r.qtd };
}

/** Lança break / desperdício / empréstimo — itens diretos e/ou produto venda via ficha. */
export async function lancarBreak(
  {
    id_loja,
    data_break,
    tipo = 'refeicao',
    turno = null,
    motivo = null,
    motivo_codigo = null,
    id_colaborador = null,
    colaborador_nome = null,
    id_loja_destino = null,
    itens = [],
    criado_por = null,
  },
  externalClient = null,
) {
  const client = externalClient || (await pool.connect());
  const ownClient = !externalClient;
  try {
    if (ownClient) await client.query('BEGIN');
    await garantirSchemaBreakCaderno(client);

    const tipoOk = TIPOS_BREAK_OK.has(String(tipo || '')) ? String(tipo) : 'refeicao';
    const turnoOk = ['manha', 'tarde', 'noite'].includes(String(turno || ''))
      ? String(turno)
      : null;
    const idDest =
      id_loja_destino != null && Number(id_loja_destino) > 0 && Number(id_loja_destino) !== Number(id_loja)
        ? Number(id_loja_destino)
        : null;
    const motivoCod = motivo_codigo != null ? String(motivo_codigo).trim() || null : null;

    let idColab = id_colaborador != null ? Number(id_colaborador) : null;
    if (idColab != null && (!Number.isFinite(idColab) || idColab <= 0)) idColab = null;
    let nomeColab =
      colaborador_nome != null ? String(colaborador_nome).trim() || null : null;

    if (idColab) {
      const { rows: ur } = await client.query(
        `SELECT id_usuario, nome FROM usuarios WHERE id_usuario = $1 AND ativo = TRUE`,
        [idColab],
      );
      const u = ur[0];
      if (!u) {
        // Lista do break vem do RH (employees.id ≠ usuarios.id_usuario).
        idColab = null;
      } else {
        const nomeUsuario = u.nome ? String(u.nome).trim() : '';
        if (
          nomeColab &&
          nomeUsuario &&
          normalizarNomeColab(nomeColab) !== normalizarNomeColab(nomeUsuario)
        ) {
          // ID bateu com outro usuário do sistema — grava só o nome escolhido.
          idColab = null;
        } else if (!nomeColab) {
          nomeColab = nomeUsuario || null;
        }
      }
    }
    if (tipoOk === 'refeicao' || tipoOk === 'outro') {
      if (!nomeColab) {
        throw Object.assign(new Error('Informe o colaborador que pegará o break'), {
          status: 400,
        });
      }
    }
    if ((tipoOk === 'refeicao' || tipoOk.startsWith('desperdicio')) && !turnoOk) {
      throw Object.assign(new Error('Informe o turno (manhã, tarde ou noite)'), {
        status: 400,
      });
    }
    if (tipoOk.startsWith('desperdicio') && !motivoCod && !motivo) {
      throw Object.assign(new Error('Informe o motivo do desperdício'), { status: 400 });
    }
    if (tipoOk === 'emprestimo') {
      if (!idDest) {
        throw Object.assign(new Error('Informe a loja que vai receber o empréstimo'), {
          status: 400,
        });
      }
      const destOk = await lojaDestinoEmprestimoValida(client, idDest);
      if (!destOk) {
        throw Object.assign(new Error('Loja de destino inválida para empréstimo'), {
          status: 400,
        });
      }
    }

    const { rows: br } = await client.query(
      `INSERT INTO estoque_break
         (id_loja, data_break, tipo, turno, motivo, motivo_codigo,
          id_colaborador, colaborador_nome, id_loja_destino, recebimento_status, criado_por)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id_loja,
        data_break || null,
        tipoOk,
        turnoOk,
        motivo,
        motivoCod,
        idColab,
        nomeColab,
        idDest,
        tipoOk === 'emprestimo' ? 'pendente' : null,
        criado_por,
      ],
    );
    const idBreak = br[0].id_break;
    const baixas = [];
    const erros = [];

    for (const raw of itens) {
      const qtde = num(raw.quantidade);
      const insumoEmp =
        tipoOk === 'emprestimo' && Boolean(raw.id_insumo || raw.codigo_insumo);
      if (!insumoEmp && qtde <= 0) continue;

      if (raw.id_insumo || raw.codigo_insumo) {
        let idInsumo = raw.id_insumo ? Number(raw.id_insumo) : null;
        let codigo = raw.codigo_insumo || raw.codigo || null;
        let descricao = raw.descricao || null;
        if (!idInsumo && codigo) {
          const insumo = await resolverInsumoPorCodigo(client, id_loja, codigo);
          if (!insumo) {
            erros.push(`Insumo ${codigo} não encontrado`);
            continue;
          }
          idInsumo = insumo.id_insumo;
          codigo = insumo.codigo;
          descricao = insumo.descricao;
        }
        if (!idInsumo) {
          erros.push('Item sem insumo');
          continue;
        }
        let qtdeBaixa = qtde;
        let cx = null;
        let pc = null;
        let kg = null;
        if (tipoOk === 'emprestimo') {
          const fat = await carregarFatoresInsumo(client, idInsumo);
          if (!fat) {
            erros.push(`Insumo ${codigo || idInsumo} sem cadastro`);
            continue;
          }
          cx = campoContagem(raw.contagem_caixa ?? raw.caixa);
          pc = campoContagem(raw.contagem_pc_fd ?? raw.pc);
          kg = campoContagem(raw.contagem_kg_und ?? raw.kg);
          const calc = qtdEmprestimo(fat, raw);
          if (!calc.ok) {
            const e = calc.erro || {};
            erros.push(
              `${e.codigo || fat.codigo}: ${e.motivo || 'conversao_nao_encontrada'} (${e.unidade_origem} → ${e.unidade_destino})`,
            );
            continue;
          }
          if (calc.qtd == null || calc.qtd <= 0) {
            erros.push(`${fat.codigo}: informe caixa, pct ou kg/und`);
            continue;
          }
          qtdeBaixa = calc.qtd;
          descricao = fat.descricao || descricao;
          codigo = fat.codigo || codigo;
        }
        await client.query(
          `INSERT INTO estoque_break_itens
             (id_break, id_insumo, codigo, descricao, quantidade,
              contagem_caixa, contagem_pc_fd, contagem_kg_und)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [idBreak, idInsumo, codigo, descricao, qtdeBaixa, cx, pc, kg],
        );
        const mov = await aplicarMovimento(client, {
          id_loja,
          id_insumo: idInsumo,
          tipo: tipoOk === 'emprestimo' ? 'ajuste' : 'break',
          quantidade: -qtdeBaixa,
          referencia_tipo: 'estoque_break',
          referencia_id: idBreak,
          observacao:
            tipoOk === 'emprestimo'
              ? `Empréstimo #${idBreak} enviado`
              : motivo || `Break #${idBreak}`,
          criado_por,
        });
        baixas.push({ id_insumo: idInsumo, quantidade: -qtdeBaixa, saldo_apos: mov.saldo_apos });
        continue;
      }

      if (raw.codigo_venda || raw.id_produto_venda || raw.id_produto) {
        let codigoVenda = raw.codigo_venda;
        let idPv = raw.id_produto_venda
          ? Number(raw.id_produto_venda)
          : raw.id_produto
            ? Number(raw.id_produto)
            : null;
        if (idPv && !codigoVenda) {
          const { rows } = await client.query('SELECT codigo FROM produtos WHERE id_produto = $1', [
            idPv,
          ]);
          codigoVenda = rows[0]?.codigo;
        }
        if (!codigoVenda) {
          erros.push('Produto de venda inválido');
          continue;
        }
        const pv = await upsertProdutoVenda(client, codigoVenda, raw.descricao || '', id_loja);
        await client.query(
          `INSERT INTO estoque_break_itens
             (id_break, id_produto, codigo, descricao, quantidade)
           VALUES ($1,$2,$3,$4,$5)`,
          [idBreak, pv.id_produto, codigoVenda, pv.descricao, qtde],
        );
        const result = await baixarPorProdutoVenda(client, {
          id_loja,
          codigo_venda: codigoVenda,
          quantidade: qtde,
          tipo: 'break',
          referencia_tipo: 'estoque_break',
          referencia_id: idBreak,
          observacao: motivo || `Break #${idBreak} — ${codigoVenda}`,
          criado_por,
        });
        if (result.sem_ficha) {
          erros.push(`Sem ficha para ${codigoVenda}`);
        } else {
          baixas.push(...result.baixas);
          if (result.erros.length) erros.push(...result.erros);
        }
      }
    }

    if (!baixas.length && erros.length) {
      throw Object.assign(new Error(erros.join('; ')), { status: 400 });
    }
    if (!baixas.length) {
      throw Object.assign(new Error('Informe ao menos um item para o break'), { status: 400 });
    }

    if (ownClient) await client.query('COMMIT');
    return { break: br[0], baixas, erros };
  } catch (e) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownClient) client.release();
  }
}

export async function listarEmprestimosAReceber(idLojaDestino) {
  await garantirSchemaBreakCaderno(pool);
  const { rows } = await pool.query(
    `SELECT b.id_break, b.data_break, b.criado_em, b.recebimento_status,
            b.id_loja AS id_loja_origem,
            lo.name AS loja_origem_nome,
            lo.bk_number AS loja_origem_bk,
            u.nome AS criado_por_nome,
            COALESCE(
              json_agg(
                json_build_object(
                  'codigo', i.codigo,
                  'descricao', i.descricao,
                  'quantidade', i.quantidade,
                  'contagem_caixa', i.contagem_caixa,
                  'contagem_pc_fd', i.contagem_pc_fd,
                  'contagem_kg_und', i.contagem_kg_und
                ) ORDER BY i.id_item
              ) FILTER (WHERE i.id_item IS NOT NULL),
              '[]'::json
            ) AS itens
     FROM estoque_break b
     JOIN lojas lo ON lo.id_loja = b.id_loja
     LEFT JOIN usuarios u ON u.id_usuario = b.criado_por
     LEFT JOIN estoque_break_itens i ON i.id_break = b.id_break
     WHERE b.tipo = 'emprestimo'
       AND b.id_loja_destino = $1
       AND b.recebimento_status = 'pendente'
     GROUP BY b.id_break, lo.name, lo.bk_number, u.nome
     ORDER BY b.criado_em DESC
     LIMIT 50`,
    [idLojaDestino],
  );
  return rows.map((row) => ({
    ...row,
    itens: Array.isArray(row.itens)
      ? row.itens
      : typeof row.itens === 'string'
        ? JSON.parse(row.itens)
        : [],
  }));
}

export async function confirmarRecebimentoEmprestimo({
  id_break,
  id_loja_destino,
  recebido_por = null,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await garantirSchemaBreakCaderno(client);

    const { rows: br } = await client.query(
      `SELECT * FROM estoque_break WHERE id_break = $1 FOR UPDATE`,
      [id_break],
    );
    const emp = br[0];
    if (!emp || emp.tipo !== 'emprestimo') {
      throw Object.assign(new Error('Empréstimo não encontrado'), { status: 404 });
    }
    if (Number(emp.id_loja_destino) !== Number(id_loja_destino)) {
      throw Object.assign(new Error('Este empréstimo não é para esta loja'), { status: 403 });
    }
    if (emp.recebimento_status === 'recebido') {
      throw Object.assign(new Error('Este empréstimo já foi confirmado'), { status: 409 });
    }
    if (emp.recebimento_status !== 'pendente') {
      throw Object.assign(new Error('Empréstimo sem recebimento pendente'), { status: 400 });
    }

    const { rows: origem } = await client.query(
      `SELECT name, bk_number FROM lojas WHERE id_loja = $1`,
      [emp.id_loja],
    );
    const rotuloOrigem = origem[0]
      ? `${origem[0].bk_number ? `${origem[0].bk_number} · ` : ''}${origem[0].name}`
      : `loja ${emp.id_loja}`;

    const { rows: itens } = await client.query(
      `SELECT * FROM estoque_break_itens WHERE id_break = $1 ORDER BY id_item`,
      [id_break],
    );
    if (!itens.length) {
      throw Object.assign(new Error('Empréstimo sem itens'), { status: 400 });
    }

    const entradas = [];
    for (const item of itens) {
      const codigo = item.codigo;
      const dest = codigo
        ? await resolverInsumoPorCodigo(client, id_loja_destino, codigo)
        : null;
      if (!dest) {
        throw Object.assign(
          new Error(`SKU ${codigo || '—'} não cadastrado nesta loja. Cadastre o insumo para receber.`),
          { status: 400 },
        );
      }
      const qtde = num(item.quantidade);
      if (qtde <= 0) continue;
      const mov = await aplicarMovimento(client, {
        id_loja: id_loja_destino,
        id_insumo: dest.id_insumo,
        tipo: 'ajuste',
        quantidade: qtde,
        referencia_tipo: 'estoque_break',
        referencia_id: id_break,
        observacao: `Empréstimo #${id_break} recebido de ${rotuloOrigem}`,
        criado_por: recebido_por,
      });
      entradas.push({
        codigo: dest.codigo,
        quantidade: qtde,
        saldo_apos: mov.saldo_apos,
      });
    }

    if (!entradas.length) {
      throw Object.assign(new Error('Empréstimo sem quantidade para receber'), { status: 400 });
    }

    const { rows: upd } = await client.query(
      `UPDATE estoque_break
       SET recebimento_status = 'recebido',
           recebido_por = $2,
           recebido_em = NOW()
       WHERE id_break = $1
       RETURNING *`,
      [id_break, recebido_por],
    );

    await client.query('COMMIT');
    return { break: upd[0], entradas };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Importa linhas de venda (já parseadas) e opcionalmente processa baixas. */
export async function importarVendasLoja(
  {
    id_loja,
    itens,
    origem = 'bkoffice',
    arquivo_nome = null,
    criado_por = null,
    processar = true,
  },
  externalClient = null,
) {
  const client = externalClient || (await pool.connect());
  const ownClient = !externalClient;
  try {
    if (ownClient) await client.query('BEGIN');

    const porData = new Map();
    for (const row of itens) {
      const data = String(row.data_venda || row.data || '').slice(0, 10);
      const codigo = String(row.codigo || '').trim();
      if (!data || !codigo) continue;
      if (!porData.has(data)) porData.set(data, []);
      porData.get(data).push(row);
    }

    const resultados = [];
    for (const [data_venda, linhas] of porData) {
      const { rows: vend } = await client.query(
        `INSERT INTO estoque_vendas
           (id_loja, data_venda, origem, status, arquivo_nome, criado_por)
         VALUES ($1, $2::date, $3, 'pendente', $4, $5)
         ON CONFLICT (id_loja, data_venda, origem) DO UPDATE
           SET arquivo_nome = COALESCE(EXCLUDED.arquivo_nome, estoque_vendas.arquivo_nome),
               status = 'pendente',
               observacao = NULL,
               criado_em = NOW()
         RETURNING *`,
        [id_loja, data_venda, origem, arquivo_nome, criado_por],
      );
      const idVenda = vend[0].id_venda;

      // Reimport: remove só pendentes órfãos; processados recebem delta de qtde + Bruto novo.
      await client.query(
        `DELETE FROM estoque_venda_itens
         WHERE id_venda = $1 AND processado = FALSE`,
        [idVenda],
      );

      for (const row of linhas) {
        const codigo = String(row.codigo || '').trim();
        const descricao = String(row.descricao || '').trim();
        const qtde = num(row.qtde ?? row.quantidade);
        const venda_liquida =
          row.venda_liquida != null ? num(row.venda_liquida) : row.valor != null ? num(row.valor) : null;
        if (!codigo || qtde <= 0) continue;

        const pv = await upsertProdutoVenda(client, codigo, descricao, id_loja);
        const { rows: existentes } = await client.query(
          `SELECT id_item, qtde, processado
           FROM estoque_venda_itens
           WHERE id_venda = $1 AND codigo = $2
           LIMIT 1`,
          [idVenda, codigo],
        );

        if (!existentes.length) {
          await client.query(
            `INSERT INTO estoque_venda_itens
               (id_venda, codigo, descricao, qtde, venda_liquida, id_produto, processado, sem_ficha)
             VALUES ($1,$2,$3,$4,$5,$6,FALSE,FALSE)`,
            [idVenda, codigo, descricao, qtde, venda_liquida, pv?.id_produto || null],
          );
          continue;
        }

        const ant = existentes[0];
        const qtdeAnt = num(ant.qtde);
        if (ant.processado) {
          const deltaQ = Math.round((qtde - qtdeAnt) * 10000) / 10000;
          if (Math.abs(deltaQ) >= 0.0001) {
            const baixa = await baixarPorProdutoVenda(client, {
              id_loja,
              codigo_venda: codigo,
              quantidade: deltaQ,
              tipo: 'venda',
              referencia_tipo: 'estoque_venda_item',
              referencia_id: ant.id_item,
              observacao: `Reimport venda #${idVenda} ${data_venda} — ${codigo} delta ${deltaQ}`,
              criado_por,
            });
            if (baixa.sem_ficha) {
              await client.query(
                `UPDATE estoque_venda_itens
                 SET descricao = $1, venda_liquida = $2, id_produto = COALESCE($3, id_produto),
                     sem_ficha = TRUE, erro = 'Sem ficha técnica'
                 WHERE id_item = $4`,
                [descricao, venda_liquida, pv?.id_produto || null, ant.id_item],
              );
              continue;
            }
            if (!baixa.ok && !baixa.parcial) {
              await client.query(
                `UPDATE estoque_venda_itens
                 SET descricao = $1, venda_liquida = $2, id_produto = COALESCE($3, id_produto),
                     erro = $4
                 WHERE id_item = $5`,
                [
                  descricao,
                  venda_liquida,
                  pv?.id_produto || null,
                  (baixa.erros || []).join('; ') || 'Falha no delta de estoque',
                  ant.id_item,
                ],
              );
              continue;
            }
          }
          await client.query(
            `UPDATE estoque_venda_itens
             SET descricao = $1, qtde = $2, venda_liquida = $3,
                 id_produto = COALESCE($4, id_produto),
                 sem_ficha = FALSE, erro = NULL
             WHERE id_item = $5`,
            [descricao, qtde, venda_liquida, pv?.id_produto || null, ant.id_item],
          );
        } else {
          await client.query(
            `UPDATE estoque_venda_itens
             SET descricao = $1, qtde = $2, venda_liquida = $3,
                 id_produto = COALESCE($4, id_produto)
             WHERE id_item = $5`,
            [descricao, qtde, venda_liquida, pv?.id_produto || null, ant.id_item],
          );
        }
      }

      let proc = null;
      if (processar) {
        proc = await processarVenda(idVenda, { criado_por }, client);
      }
      resultados.push({ id_venda: idVenda, data_venda, processado: proc });
    }

    if (ownClient) await client.query('COMMIT');
    return { loja: id_loja, dias: resultados.length, resultados };
  } catch (e) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownClient) client.release();
  }
}
