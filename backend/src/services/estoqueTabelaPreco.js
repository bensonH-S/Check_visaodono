/**
 * Tabela de Preço BKC × Platlog: compara pedido e NF com o preço acordado
 * e monta o espelho dos pedidos do eSupri com a regra do CMP.
 */
import { pool } from '../db.js';
import { META_CMP_PADRAO } from './estoquePedidoRascunho.js';

/** BB5 = Franquia N/NE/CO, mesma tabela que o portal aplica às lojas (PC_TAPRE). */
export const TABELA_PRECO_PADRAO = 'BB5';
/** Diferença acima disso (em %) provavelmente é unidade diferente (caixa × pacote), não sobrepreço. */
export const LIMITE_CONFERIR_UNIDADE = 0.5;
const CNPJ_PLATLOG = '02229804';

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function r2(v) {
  return Math.round(num(v) * 100) / 100;
}

function r4(v) {
  return Math.round(num(v) * 10000) / 10000;
}

function hojeSpISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function diasNoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * @returns {'acima'|'igual'|'abaixo'|'sem_tabela'|'conferir_unidade'}
 */
export function situacaoPreco(pago, tabela) {
  const p = Number(pago);
  const t = Number(tabela);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(p) || p <= 0) return 'sem_tabela';
  const dif = r2(p - t);
  const pct = p / t - 1;
  if (Math.abs(pct) > LIMITE_CONFERIR_UNIDADE) return 'conferir_unidade';
  if (dif >= 0.01 && pct > 0.001) return 'acima';
  if (dif <= -0.01 && pct < -0.001) return 'abaixo';
  return 'igual';
}

const RUIDO_PRODUTO = new Set(['BK', 'BKC', 'CX', 'PCT', 'UN', 'UND', 'KG', 'FD', 'COM', 'NAC', 'NOVO', 'NOVA', 'CLEAN', 'TESTE', 'CONG']);

/** Palavras que identificam o produto (para achar troca de código entre pedido e NF). */
function tokensProduto(desc) {
  return new Set(
    String(desc || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^A-Z0-9]+/)
      .filter((t) => /^\d+$/.test(t) || (t.length >= 3 && !RUIDO_PRODUTO.has(t) && !/^\d+[A-Z]*$/.test(t))),
  );
}

function semelhanca(a, b) {
  let palavras = 0;
  let numeros = 0;
  for (const t of a) {
    if (!b.has(t)) continue;
    if (/^\d+$/.test(t)) numeros += 1;
    else palavras += 1;
  }
  return { palavras, numeros };
}

/** LATERAL com o preço vigente na data (última vigência <= data). */
function lateralTabela(colCodigo, colData, paramTabela) {
  return `LEFT JOIN LATERAL (
    SELECT tp.preco, tp.vigencia, tp.unidade AS unidade_tabela
    FROM estoque_tabela_preco tp
    WHERE tp.tabela = ${paramTabela}
      AND tp.codigo = NULLIF(LTRIM(${colCodigo}, '0'), '')
      AND tp.vigencia <= ${colData}
    ORDER BY tp.vigencia DESC
    LIMIT 1
  ) tp ON TRUE`;
}

/** Uma linha por chave (a nota pode existir como 'platlog' e 'sefaz'); fica a que tem itens. */
function cteNotasPlatlog(filtroLoja) {
  return `nf AS (
    SELECT DISTINCT ON (n.id_loja, COALESCE(n.chave, n.id_nfe::text))
      n.id_nfe, n.id_loja, n.numero, n.chave, n.emissao, n.pedido_esupri, n.fornecedor
    FROM estoque_nfe n
    WHERE ${filtroLoja}
      AND n.emitente_cnpj LIKE '${CNPJ_PLATLOG}%'
      AND COALESCE(n.status, '') <> 'erro'
      AND COALESCE(n.status_entrega, '') <> 'cancelada'
    ORDER BY n.id_loja, COALESCE(n.chave, n.id_nfe::text),
      (SELECT COUNT(*) FROM estoque_nfe_itens i WHERE i.id_nfe = n.id_nfe) DESC,
      n.id_nfe DESC
  )`;
}

export async function vigenciasTabela(tabela = TABELA_PRECO_PADRAO) {
  const { rows } = await pool.query(
    `SELECT vigencia, COUNT(*)::int AS itens FROM estoque_tabela_preco
     WHERE tabela = $1 GROUP BY vigencia ORDER BY vigencia DESC`,
    [tabela],
  );
  return rows;
}

/** Preço de tabela para itens de NF (detalhe da nota). */
export async function enriquecerItensComTabela(itens, dataRef, tabela = TABELA_PRECO_PADRAO) {
  const codigos = [...new Set((itens || []).map((i) => String(i.codigo_nf || '').replace(/^0+/, '')).filter(Boolean))];
  if (!codigos.length || !dataRef) return itens;
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (codigo) codigo, preco, vigencia
     FROM estoque_tabela_preco
     WHERE tabela = $1 AND codigo = ANY($2::text[]) AND vigencia <= $3::date
     ORDER BY codigo, vigencia DESC`,
    [tabela, codigos, String(dataRef).slice(0, 10)],
  );
  const mapa = new Map(rows.map((r) => [r.codigo, r]));
  return itens.map((it) => {
    const tp = mapa.get(String(it.codigo_nf || '').replace(/^0+/, ''));
    if (!tp) return { ...it, preco_tabela: null, vigencia_tabela: null, situacao_preco: 'sem_tabela' };
    const pago = num(it.v_un_com);
    return {
      ...it,
      preco_tabela: num(tp.preco),
      vigencia_tabela: tp.vigencia,
      situacao_preco: situacaoPreco(pago, tp.preco),
      diferenca_unit: r4(pago - num(tp.preco)),
      diferenca_total: r2((pago - num(tp.preco)) * num(it.q_com)),
    };
  });
}

async function cmpPorMes(idLoja, meses) {
  if (!meses.length) return new Map();
  const hoje = hojeSpISO();
  const mesHoje = hoje.slice(0, 7);
  const inicio = `${[...meses].sort()[0]}-01`;
  const { rows: vendas } = await pool.query(
    `SELECT to_char(v.data_venda, 'YYYY-MM') AS mes,
            COALESCE(SUM(vi.venda_liquida), 0)::numeric AS venda
     FROM estoque_vendas v
     JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
     WHERE v.id_loja = $1 AND v.origem = 'bkoffice'
       AND v.data_venda >= $2::date AND v.data_venda < $3::date
     GROUP BY 1`,
    [idLoja, inicio, hoje],
  );
  const { rows: v28 } = await pool.query(
    `SELECT COALESCE(SUM(vi.venda_liquida), 0)::numeric AS venda
     FROM estoque_vendas v
     JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
     WHERE v.id_loja = $1 AND v.origem = 'bkoffice'
       AND v.data_venda >= ($2::date - 28) AND v.data_venda < $2::date`,
    [idLoja, hoje],
  );
  const { rows: compras } = await pool.query(
    `SELECT to_char(COALESCE(n.data_vencimento, n.emissao::date), 'YYYY-MM') AS mes,
            COALESCE(SUM(n.valor_total), 0)::numeric AS valor
     FROM estoque_nfe n
     WHERE n.id_loja = $1
       AND COALESCE(n.status, '') <> 'erro'
       AND COALESCE(n.status_entrega, '') <> 'cancelada'
       AND COALESCE(n.data_vencimento, n.emissao::date) >= $2::date
     GROUP BY 1`,
    [idLoja, inicio],
  );
  const vendaMes = new Map(vendas.map((r) => [r.mes, num(r.venda)]));
  const compraMes = new Map(compras.map((r) => [r.mes, num(r.valor)]));
  const out = new Map();
  for (const mes of meses) {
    const venda = vendaMes.get(mes) || 0;
    let projetada = venda;
    let base = 'mes_fechado';
    if (mes === mesHoje) {
      const decorridos = Math.max(Number(hoje.slice(8, 10)) - 1, 0);
      const dm = diasNoMes(mes);
      if (decorridos > 0 && venda > 0) {
        projetada = (venda / decorridos) * dm;
        base = 'ritmo_mes';
      } else {
        projetada = (num(v28[0]?.venda) / 28) * dm;
        base = 'ultimos_28_dias';
      }
    }
    out.set(mes, {
      mes,
      meta_pct: META_CMP_PADRAO,
      venda_realizada: r2(venda),
      venda_projetada: r2(projetada),
      base_projecao: base,
      teto: r2(projetada * META_CMP_PADRAO),
      compras_nf: r2(compraMes.get(mes) || 0),
    });
  }
  return out;
}

/**
 * Espelho dos pedidos do portal com preço de tabela, faturado nas NFs (xPed) e CMP do mês.
 */
export async function listarPedidosPlatlogEspelho(idLoja, { dias = 90, tabela = TABELA_PRECO_PADRAO } = {}) {
  const id = Number(idLoja);
  const nDias = Math.min(Math.max(Number(dias) || 90, 7), 400);

  const { rows: pedidos } = await pool.query(
    `SELECT id_pedido, codigo, data_pedido, hora_pedido, valor_total, qtd_itens, peso_bruto,
            data_entrega, status, flag_status, observacao, itens_lidos_em, sincronizado_em
     FROM estoque_pedido_platlog
     WHERE id_loja = $1 AND data_pedido >= (CURRENT_DATE - $2::int)
     ORDER BY data_pedido DESC, hora_pedido DESC NULLS LAST, codigo DESC`,
    [id, nDias],
  );

  const { rows: itens } = await pool.query(
    `SELECT it.id_pedido, it.codigo, it.descricao, it.quantidade, it.unidade,
            it.valor_unitario, it.valor_total,
            tp.preco AS preco_tabela, tp.vigencia AS vigencia_tabela
     FROM estoque_pedido_platlog_itens it
     JOIN estoque_pedido_platlog p ON p.id_pedido = it.id_pedido
     ${lateralTabela('it.codigo', 'p.data_pedido', '$3')}
     WHERE p.id_loja = $1 AND p.data_pedido >= (CURRENT_DATE - $2::int)
     ORDER BY it.id_pedido, it.id_item`,
    [id, nDias, tabela],
  );

  const { rows: faturados } = await pool.query(
    `WITH ${cteNotasPlatlog('n.id_loja = $1 AND n.pedido_esupri IS NOT NULL')}
     SELECT nf.pedido_esupri, NULLIF(LTRIM(ni.codigo_nf, '0'), '') AS cod,
            MIN(ni.codigo_nf) AS codigo, MIN(ni.descricao) AS descricao, MIN(ni.u_com) AS unidade,
            SUM(ni.q_com)::numeric AS q_fat, SUM(ni.v_prod)::numeric AS v_fat
     FROM nf JOIN estoque_nfe_itens ni ON ni.id_nfe = nf.id_nfe
     GROUP BY 1, 2`,
    [id],
  );
  const fatPorPedido = new Map();
  for (const f of faturados) {
    const m = fatPorPedido.get(f.pedido_esupri) || new Map();
    m.set(f.cod, {
      codigo: f.codigo,
      descricao: f.descricao,
      unidade: f.unidade,
      quantidade: num(f.q_fat),
      valor: r2(f.v_fat),
    });
    fatPorPedido.set(f.pedido_esupri, m);
  }

  const { rows: notas } = await pool.query(
    `WITH ${cteNotasPlatlog('n.id_loja = $1 AND n.pedido_esupri IS NOT NULL')}
     SELECT nf.pedido_esupri, nf.id_nfe, nf.numero, nf.emissao,
            (SELECT COALESCE(SUM(v_prod), 0) FROM estoque_nfe_itens i WHERE i.id_nfe = nf.id_nfe)::numeric AS valor
     FROM nf ORDER BY nf.emissao`,
    [id],
  );
  const notasPorPedido = new Map();
  for (const n of notas) {
    const arr = notasPorPedido.get(n.pedido_esupri) || [];
    arr.push({ id_nfe: n.id_nfe, numero: n.numero, emissao: n.emissao, valor: r2(n.valor) });
    notasPorPedido.set(n.pedido_esupri, arr);
  }

  const codPedido = new Map(pedidos.map((p) => [p.id_pedido, p.codigo]));
  const itensPorPedido = new Map();
  for (const it of itens) {
    const pago = num(it.valor_unitario);
    const tab = it.preco_tabela != null ? num(it.preco_tabela) : null;
    const situacao = situacaoPreco(pago, tab);
    const fat = fatPorPedido.get(codPedido.get(it.id_pedido))?.get(String(it.codigo).replace(/^0+/, '')) || null;
    const linha = {
      codigo: it.codigo,
      descricao: it.descricao,
      quantidade: num(it.quantidade),
      unidade: it.unidade,
      valor_unitario: r4(pago),
      valor_total: r2(it.valor_total),
      preco_tabela: tab,
      vigencia_tabela: it.vigencia_tabela,
      situacao_preco: situacao,
      diferenca_unit: tab != null ? r4(pago - tab) : null,
      diferenca_total: tab != null ? r2((pago - tab) * num(it.quantidade)) : null,
      qtd_faturada: fat ? fat.quantidade : null,
      valor_faturado: fat ? fat.valor : null,
      trocado_por: null,
    };
    const arr = itensPorPedido.get(it.id_pedido) || [];
    arr.push(linha);
    itensPorPedido.set(it.id_pedido, arr);
  }

  const extrasPorPedido = new Map();
  for (const p of pedidos) {
    const fat = fatPorPedido.get(p.codigo);
    if (!fat) continue;
    const its = itensPorPedido.get(p.id_pedido) || [];
    const pedidos_cod = new Set(its.map((i) => String(i.codigo).replace(/^0+/, '')));
    const sobra = [...fat.entries()].filter(([cod]) => !pedidos_cod.has(cod)).map(([cod, f]) => ({ cod, ...f }));
    const pares = [];
    for (const i of its) {
      if (i.qtd_faturada != null) continue;
      const alvo = tokensProduto(i.descricao);
      for (const s of sobra) {
        const { palavras, numeros } = semelhanca(alvo, tokensProduto(s.descricao));
        if (!palavras) continue;
        const nota = palavras + numeros + (Math.abs(num(s.quantidade) - num(i.quantidade)) < 1e-6 ? 1 : 0);
        if (nota >= 2) pares.push({ i, s, nota });
      }
    }
    pares.sort((a, b) => b.nota - a.nota);
    const usados = new Set();
    for (const { i, s } of pares) {
      if (i.trocado_por || usados.has(s.cod)) continue;
      usados.add(s.cod);
      i.trocado_por = {
        codigo: s.codigo,
        descricao: s.descricao,
        quantidade: s.quantidade,
        unidade: s.unidade,
        valor: s.valor,
      };
    }
    extrasPorPedido.set(
      p.id_pedido,
      sobra
        .filter((s) => !usados.has(s.cod))
        .map((s) => ({ codigo: s.codigo, descricao: s.descricao, quantidade: s.quantidade, unidade: s.unidade, valor: s.valor })),
    );
  }

  const meses = [...new Set(pedidos.map((p) => String(p.data_pedido).slice(0, 7)))];
  const cmp = await cmpPorMes(id, meses);
  const acumMes = new Map();
  const cronologico = [...pedidos].reverse();
  const cmpPedido = new Map();
  for (const p of cronologico) {
    if (/cancel/i.test(String(p.status || ''))) continue;
    const mes = String(p.data_pedido).slice(0, 7);
    const acum = (acumMes.get(mes) || 0) + num(p.valor_total);
    acumMes.set(mes, acum);
    const c = cmp.get(mes);
    cmpPedido.set(p.id_pedido, {
      mes,
      acumulado_mes: r2(acum),
      pct_venda: c?.venda_projetada ? r4(acum / c.venda_projetada) : null,
      dentro_teto: c?.teto ? acum <= c.teto : null,
    });
  }

  const resumoPreco = { itens_comparados: 0, acima: 0, valor_acima: 0, conferir_unidade: 0, sem_tabela: 0 };
  const lista = pedidos.map((p) => {
    const its = itensPorPedido.get(p.id_pedido) || [];
    const acima = its.filter((i) => i.situacao_preco === 'acima');
    const valorAcima = r2(acima.reduce((s, i) => s + num(i.diferenca_total), 0));
    const nfs = notasPorPedido.get(p.codigo) || [];
    const comFat = its.filter((i) => i.qtd_faturada != null);
    const trocados = its.filter((i) => i.trocado_por).length;
    const faltando = nfs.length
      ? its.filter((i) => !i.trocado_por && num(i.qtd_faturada) + 1e-6 < num(i.quantidade)).length
      : null;
    const extras = extrasPorPedido.get(p.id_pedido) || [];
    if (!/cancel/i.test(String(p.status || ''))) {
      for (const i of its) {
        if (i.situacao_preco === 'sem_tabela') resumoPreco.sem_tabela += 1;
        else resumoPreco.itens_comparados += 1;
        if (i.situacao_preco === 'acima') resumoPreco.acima += 1;
        if (i.situacao_preco === 'conferir_unidade') resumoPreco.conferir_unidade += 1;
      }
      resumoPreco.valor_acima += valorAcima;
    }
    return {
      id_pedido: p.id_pedido,
      codigo: p.codigo,
      data_pedido: p.data_pedido,
      hora_pedido: p.hora_pedido,
      valor_total: r2(p.valor_total),
      qtd_itens: num(p.qtd_itens),
      peso_bruto: num(p.peso_bruto),
      data_entrega: p.data_entrega,
      status: p.status,
      flag_status: p.flag_status,
      observacao: p.observacao,
      itens_lidos: !!p.itens_lidos_em,
      itens: its,
      preco: {
        acima: acima.length,
        valor_acima: valorAcima,
        conferir_unidade: its.filter((i) => i.situacao_preco === 'conferir_unidade').length,
        sem_tabela: its.filter((i) => i.situacao_preco === 'sem_tabela').length,
      },
      faturamento: {
        nfs,
        valor_faturado: r2(nfs.reduce((s, n) => s + n.valor, 0)),
        itens_com_nf: comFat.length,
        itens_faltando: faltando,
        itens_trocados: trocados,
        extras,
      },
      cmp: cmpPedido.get(p.id_pedido) || null,
    };
  });

  const inicioJanela = new Date(Date.now() - nDias * 864e5).toISOString().slice(0, 10);
  const meses_cmp = [...cmp.values()]
    .filter((c) => `${c.mes}-01` >= inicioJanela && c.venda_projetada > 0)
    .map((c) => ({
      ...c,
      pedidos_portal: r2(acumMes.get(c.mes) || 0),
      pct_pedidos: c.venda_projetada ? r4((acumMes.get(c.mes) || 0) / c.venda_projetada) : null,
      pct_compras_nf: c.venda_projetada ? r4(c.compras_nf / c.venda_projetada) : null,
    }))
    .sort((a, b) => b.mes.localeCompare(a.mes));

  const { rows: sync } = await pool.query(
    `SELECT MAX(sincronizado_em) AS em FROM estoque_pedido_platlog WHERE id_loja = $1`,
    [id],
  );
  const vig = await vigenciasTabela(tabela);

  resumoPreco.valor_acima = r2(resumoPreco.valor_acima);
  return {
    tabela,
    vigencia_tabela: vig[0]?.vigencia || null,
    sincronizado_em: sync[0]?.em || null,
    pedidos: lista,
    meses: meses_cmp,
    resumo_preco: resumoPreco,
  };
}

/**
 * Pedidos do eSupri × Tabela BKC num período, de uma loja ou da rede (relatório de cobrança).
 * @param {object} o
 * @param {number|null} [o.idLoja]
 * @param {number[]|null} [o.idsLoja]
 * @param {string} o.de
 * @param {string} o.ate
 */
export async function listarPedidosTabelaPeriodo({ idLoja = null, idsLoja = null, de, ate, tabela = TABELA_PRECO_PADRAO }) {
  const params = [String(de).slice(0, 10), String(ate).slice(0, 10)];
  let filtro = `p.data_pedido BETWEEN $1::date AND $2::date AND COALESCE(p.status, '') !~* 'cancel'`;
  if (idLoja) {
    params.push(Number(idLoja));
    filtro += ` AND p.id_loja = $${params.length}`;
  } else if (Array.isArray(idsLoja)) {
    params.push(idsLoja.map(Number));
    filtro += ` AND p.id_loja = ANY($${params.length}::int[])`;
  }

  const { rows: pedidos } = await pool.query(
    `SELECT p.id_pedido, p.id_loja, l.name AS loja, l.bk_number, p.codigo, p.data_pedido,
            p.valor_total, p.itens_lidos_em, p.sincronizado_em
     FROM estoque_pedido_platlog p
     JOIN lojas l ON l.id_loja = p.id_loja
     WHERE ${filtro}
     ORDER BY p.data_pedido DESC, p.hora_pedido DESC NULLS LAST, p.codigo DESC`,
    params,
  );
  params.push(tabela);
  const { rows: itens } = await pool.query(
    `SELECT it.id_pedido, it.codigo, it.descricao, it.quantidade, it.unidade,
            it.valor_unitario, it.valor_total, tp.preco AS preco_tabela
     FROM estoque_pedido_platlog_itens it
     JOIN estoque_pedido_platlog p ON p.id_pedido = it.id_pedido
     ${lateralTabela('it.codigo', 'p.data_pedido', `$${params.length}`)}
     WHERE ${filtro}
     ORDER BY it.id_pedido, it.id_item`,
    params,
  );

  const itensPorPedido = new Map();
  for (const it of itens) {
    const pago = num(it.valor_unitario);
    const tab = it.preco_tabela != null ? num(it.preco_tabela) : null;
    const arr = itensPorPedido.get(it.id_pedido) || [];
    arr.push({
      codigo: it.codigo,
      descricao: it.descricao,
      quantidade: num(it.quantidade),
      unidade: it.unidade,
      valor_unitario: r4(pago),
      valor_total: r2(it.valor_total),
      preco_tabela: tab,
      situacao_preco: situacaoPreco(pago, tab),
      diferenca_unit: tab != null ? r4(pago - tab) : null,
      diferenca_total: tab != null ? r2((pago - tab) * num(it.quantidade)) : null,
    });
    itensPorPedido.set(it.id_pedido, arr);
  }

  const resumo = {
    lojas: 0, pedidos: 0, pedidos_acima: 0, valor_pedidos: 0,
    itens_comparados: 0, acima: 0, valor_acima: 0, conferir_unidade: 0, sem_tabela: 0,
  };
  const porLoja = new Map();
  const lista = pedidos.map((p) => {
    const its = itensPorPedido.get(p.id_pedido) || [];
    const acima = its.filter((i) => i.situacao_preco === 'acima');
    const valorAcima = r2(acima.reduce((s, i) => s + num(i.diferenca_total), 0));
    const pl = porLoja.get(p.id_loja) || {
      id_loja: p.id_loja, loja: p.loja, bk_number: p.bk_number, pedidos: 0, pedidos_acima: 0,
      valor_pedidos: 0, itens_comparados: 0, acima: 0, valor_acima: 0, sincronizado_em: null,
    };
    pl.pedidos += 1;
    pl.valor_pedidos += num(p.valor_total);
    pl.valor_acima += valorAcima;
    pl.acima += acima.length;
    if (acima.length) pl.pedidos_acima += 1;
    if (!pl.sincronizado_em || p.sincronizado_em > pl.sincronizado_em) pl.sincronizado_em = p.sincronizado_em;
    for (const i of its) {
      if (i.situacao_preco === 'sem_tabela') resumo.sem_tabela += 1;
      else {
        resumo.itens_comparados += 1;
        pl.itens_comparados += 1;
      }
      if (i.situacao_preco === 'conferir_unidade') resumo.conferir_unidade += 1;
    }
    porLoja.set(p.id_loja, pl);
    resumo.pedidos += 1;
    resumo.valor_pedidos += num(p.valor_total);
    resumo.acima += acima.length;
    resumo.valor_acima += valorAcima;
    if (acima.length) resumo.pedidos_acima += 1;
    return {
      id_pedido: p.id_pedido,
      id_loja: p.id_loja,
      loja: p.loja,
      codigo: p.codigo,
      data_pedido: p.data_pedido,
      valor_total: r2(p.valor_total),
      itens_lidos: !!p.itens_lidos_em,
      itens: its,
      preco: { acima: acima.length, valor_acima: valorAcima },
    };
  });

  resumo.lojas = porLoja.size;
  resumo.valor_pedidos = r2(resumo.valor_pedidos);
  resumo.valor_acima = r2(resumo.valor_acima);
  const vig = await vigenciasTabela(tabela);
  return {
    tabela,
    vigencia_tabela: vig[0]?.vigencia || null,
    de: params[0],
    ate: params[1],
    resumo,
    por_loja: [...porLoja.values()]
      .map((l) => ({ ...l, valor_pedidos: r2(l.valor_pedidos), valor_acima: r2(l.valor_acima) }))
      .sort((a, b) => b.valor_acima - a.valor_acima || a.loja.localeCompare(b.loja)),
    pedidos: lista,
  };
}

/**
 * Itens de NF Platlog cobrados acima da tabela (relatório de cobrança).
 * @param {object} o
 * @param {number|null} [o.idLoja]
 * @param {number[]|null} [o.idsLoja]
 */
export async function listarNfAcimaTabela({
  idLoja = null,
  idsLoja = null,
  de = null,
  ate = null,
  tabela = TABELA_PRECO_PADRAO,
  incluirConferir = true,
} = {}) {
  const params = [tabela];
  let filtro = 'TRUE';
  if (idLoja) {
    params.push(Number(idLoja));
    filtro = `n.id_loja = $${params.length}`;
  } else if (Array.isArray(idsLoja)) {
    params.push(idsLoja.map(Number));
    filtro = `n.id_loja = ANY($${params.length}::int[])`;
  }
  if (de) {
    params.push(String(de).slice(0, 10));
    filtro += ` AND n.emissao >= $${params.length}::date`;
  }
  if (ate) {
    params.push(String(ate).slice(0, 10));
    filtro += ` AND n.emissao <= $${params.length}::date`;
  }

  const { rows } = await pool.query(
    `WITH ${cteNotasPlatlog(filtro)}
     SELECT nf.id_nfe, nf.id_loja, l.name AS loja, l.bk_number, nf.numero, nf.chave, nf.emissao,
            nf.pedido_esupri,
            ni.codigo_nf, ni.descricao, ni.u_com, ni.q_com, ni.v_un_com, ni.v_prod,
            tp.preco AS preco_tabela, tp.vigencia AS vigencia_tabela
     FROM nf
     JOIN lojas l ON l.id_loja = nf.id_loja
     JOIN estoque_nfe_itens ni ON ni.id_nfe = nf.id_nfe
     ${lateralTabela('ni.codigo_nf', 'nf.emissao', '$1')}
     WHERE tp.preco IS NOT NULL
     ORDER BY nf.emissao DESC, l.name, nf.numero, ni.n_item`,
    params,
  );

  const resumo = { notas: new Set(), itens_comparados: rows.length, acima: 0, valor_acima: 0, conferir_unidade: 0 };
  const porLoja = new Map();
  const linhas = [];
  for (const r of rows) {
    const pago = num(r.v_un_com);
    const tab = num(r.preco_tabela);
    const situacao = situacaoPreco(pago, tab);
    if (situacao === 'conferir_unidade') resumo.conferir_unidade += 1;
    if (situacao !== 'acima' && !(incluirConferir && situacao === 'conferir_unidade')) continue;
    const difTotal = r2((pago - tab) * num(r.q_com));
    if (situacao === 'acima') {
      resumo.acima += 1;
      resumo.valor_acima += difTotal;
      resumo.notas.add(r.id_nfe);
      const pl = porLoja.get(r.id_loja) || { id_loja: r.id_loja, loja: r.loja, itens: 0, valor_acima: 0 };
      pl.itens += 1;
      pl.valor_acima = r2(pl.valor_acima + difTotal);
      porLoja.set(r.id_loja, pl);
    }
    linhas.push({
      id_nfe: r.id_nfe,
      id_loja: r.id_loja,
      loja: r.loja,
      bk_number: r.bk_number,
      numero: r.numero,
      chave: r.chave,
      emissao: r.emissao,
      pedido_esupri: r.pedido_esupri,
      codigo: r.codigo_nf,
      descricao: r.descricao,
      unidade: r.u_com,
      quantidade: num(r.q_com),
      preco_pago: r4(pago),
      preco_tabela: r4(tab),
      vigencia_tabela: r.vigencia_tabela,
      diferenca_unit: r4(pago - tab),
      diferenca_pct: r4(pago / tab - 1),
      diferenca_total: difTotal,
      situacao_preco: situacao,
    });
  }
  return {
    tabela,
    resumo: {
      notas: resumo.notas.size,
      itens_comparados: resumo.itens_comparados,
      acima: resumo.acima,
      valor_acima: r2(resumo.valor_acima),
      conferir_unidade: resumo.conferir_unidade,
    },
    por_loja: [...porLoja.values()].sort((a, b) => b.valor_acima - a.valor_acima),
    linhas,
  };
}

function csvCampo(v) {
  if (v == null) return '';
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function dataCsv(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function numCsv(v, casas = 2) {
  if (v == null || v === '') return '';
  return Number(v).toFixed(casas).replace('.', ',');
}

/** CSV (;) com BOM para abrir direto no Excel. */
export function csvNfAcimaTabela(dados) {
  const cab = [
    'Loja', 'BK', 'NF', 'Emissão', 'Pedido eSupri', 'Código', 'Descrição', 'Unidade', 'Quantidade',
    'Preço cobrado', `Preço tabela ${dados.tabela}`, 'Vigência tabela', 'Diferença unit.', 'Diferença %',
    'Cobrado a mais', 'Situação', 'Chave NF',
  ];
  const linhas = dados.linhas.map((l) =>
    [
      l.loja, l.bk_number, l.numero, dataCsv(l.emissao), l.pedido_esupri, l.codigo, l.descricao, l.unidade,
      numCsv(l.quantidade, 3), numCsv(l.preco_pago, 4), numCsv(l.preco_tabela, 4), dataCsv(l.vigencia_tabela),
      numCsv(l.diferenca_unit, 4), numCsv(l.diferenca_pct * 100, 1), numCsv(l.diferenca_total, 2),
      l.situacao_preco === 'acima' ? 'Acima da tabela' : 'Conferir unidade', l.chave,
    ]
      .map(csvCampo)
      .join(';'),
  );
  return `\uFEFF${[cab.join(';'), ...linhas].join('\r\n')}\r\n`;
}
