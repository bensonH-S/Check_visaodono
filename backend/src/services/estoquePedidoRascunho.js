/**
 * Rascunho de abastecimento.
 * Ritmo = venda atual (50%) + últimos 3 meses (30%) + mesmo período do ano passado (20%).
 * Caixas cobrem até a entrega do pedido seguinte (planilha Platlog). Sem a planilha, usa a janela pedida.
 * O ritmo da venda continua na última semana, separado dos dias de cobertura.
 * O valor do pedido não passa do teto de CMP do mês (meta sobre a venda projetada, menos o que já entrou).
 * A lista de itens Platlog sai dos pedidos reais de todas as lojas da mesma marca nos últimos 120 dias.
 * A quantidade de caixas continua da venda desta loja. Loja maior vende mais, então pede mais.
 * Item sem preço ou fora do eSupri fica de fora do pedido. Cada cálculo é gravado como simulação de teste.
 * Não envia pedido.
 */
import { pool } from '../db.js';
import { janelaDaLoja } from './platlogJanela.js';

/** Mesma referência de CMV da rede. O teto de compra do mês usa esse percentual sobre a venda projetada. */
export const META_CMP_PADRAO = 0.38;

/** Maior quantidade de um item vista nos pedidos reais recentes. Acima disso a simulação segura a linha. */
export const CAIXAS_MAX_SIMULACAO = 40;

export const LOJAS_FORA_PILOTO_PEDIDO = [
  { bk: '23531', esupri: '1192301', nome: '706' },
  { bk: '25261', esupri: '3375001', nome: 'Venâncio' },
];

const STATUS_A_CAMINHO = [
  'aguardando_portal',
  'em_transito',
  'aguardando_conferencia',
  'divergente',
];

const PESO_ATUAL = 0.5;
const PESO_3M = 0.3;
const PESO_ANO = 0.2;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round(v, casas = 3) {
  const p = 10 ** casas;
  return Math.round(num(v) * p) / p;
}

function hojeSpISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addYears(iso, years) {
  const d = new Date(`${iso}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function diasNoMes(iso) {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function lojaForaDoPilotoPedido({ bk, esupri, nome } = {}) {
  const bkN = String(bk || '').replace(/\D/g, '');
  const es = String(esupri || '').replace(/\D/g, '');
  const n = String(nome || '').toUpperCase();
  return (
    LOJAS_FORA_PILOTO_PEDIDO.find(
      (l) =>
        (bkN && bkN === l.bk) ||
        (es && es === l.esupri) ||
        (l.bk === '23531' && /ASA\s*706/.test(n)) ||
        (l.bk === '25261' && /VENAN/.test(n)),
    ) || null
  );
}

/**
 * Ritmo diário em unidade de estoque.
 * Ano passado só entra se já existe venda recente — item parado não volta ao pedido por causa do ano anterior.
 */
export function ritmoBlend({ qAtual = 0, diasAtual = 7, q3m = 0, dias3m = 90, qAno = 0, diasAno = 7 } = {}) {
  const partes = [];
  if (num(qAtual) > 0 && num(diasAtual) > 0) {
    partes.push({ chave: 'atual', ritmo: num(qAtual) / num(diasAtual), peso: PESO_ATUAL });
  }
  if (num(q3m) > 0 && num(dias3m) > 0) {
    partes.push({ chave: 'tres_meses', ritmo: num(q3m) / num(dias3m), peso: PESO_3M });
  }
  const temRecente = partes.length > 0;
  if (temRecente && num(qAno) > 0 && num(diasAno) > 0) {
    partes.push({ chave: 'ano_passado', ritmo: num(qAno) / num(diasAno), peso: PESO_ANO });
  }
  const soma = partes.reduce((s, p) => s + p.peso, 0);
  if (!soma) return { ritmo: 0, pesos: { atual: 0, tres_meses: 0, ano_passado: 0 } };
  const pesos = { atual: 0, tres_meses: 0, ano_passado: 0 };
  let ritmo = 0;
  for (const p of partes) {
    const peso = p.peso / soma;
    pesos[p.chave] = round(peso, 4);
    ritmo += p.ritmo * peso;
  }
  return { ritmo, pesos };
}

/** Caixas inteiras para cobrir o horizonte. und_convertida é a unidade de estoque dentro de uma caixa. */
export function caixasParaCobrir({
  ritmo = 0,
  diasCobertura = 7,
  saldo = 0,
  aCaminho = 0,
  undConvertida = 1,
} = {}) {
  const und = num(undConvertida) > 0 ? num(undConvertida) : 1;
  const necessidade = num(ritmo) * num(diasCobertura) - num(saldo) - num(aCaminho);
  if (!(necessidade > 0.0005)) {
    return { necessidade: 0, caixas: 0 };
  }
  return {
    necessidade: round(necessidade, 4),
    caixas: Math.ceil(necessidade / und - 1e-9),
  };
}

/**
 * Atende primeiro quem tem menos cobertura. O que não cabe no teto é cortado.
 * Item sem preço fica marcado e não consome o teto. `segurarLinhaPedido` zera a caixa depois.
 */
export function aplicarTetoCmp(itens, tetoRestante) {
  const teto = Math.max(0, num(tetoRestante));
  const ordenados = [...itens].sort((a, b) => {
    const da = Number.isFinite(a.cobertura_dias) ? a.cobertura_dias : 9999;
    const db = Number.isFinite(b.cobertura_dias) ? b.cobertura_dias : 9999;
    return da - db;
  });
  let resta = teto;
  const out = [];
  for (const item of ordenados) {
    const caixas = Math.max(0, Math.round(num(item.caixas)));
    const preco = num(item.preco_caixa);
    if (!caixas) {
      out.push({ ...item, caixas_pedidas: 0, valor: 0, cortado: false, motivo: null });
      continue;
    }
    if (!(preco > 0)) {
      out.push({
        ...item,
        caixas_pedidas: caixas,
        valor: 0,
        cortado: false,
        sem_preco: true,
        motivo: 'sem_preco',
      });
      continue;
    }
    const valorCheio = caixas * preco;
    if (valorCheio <= resta + 0.009) {
      resta -= valorCheio;
      out.push({
        ...item,
        caixas_pedidas: caixas,
        valor: round(valorCheio, 2),
        cortado: false,
        motivo: null,
      });
      continue;
    }
    const cabem = Math.floor((resta + 0.009) / preco);
    const valor = round(cabem * preco, 2);
    resta = Math.max(0, resta - valor);
    out.push({
      ...item,
      caixas_pedidas: cabem,
      valor,
      cortado: cabem < caixas,
      motivo: cabem < caixas ? 'teto_cmp' : null,
    });
  }
  return { itens: out, restante: round(resta, 2) };
}

/**
 * Tira do pedido o que não dá para comprar com segurança.
 * A necessidade calculada continua em caixas_calculo para a tela mostrar o motivo.
 */
export function segurarLinhaPedido(item) {
  const caixasCalc = num(item.caixas_calculo ?? item.caixas);
  const base = { ...item, bloqueado: false };
  if (item.vende_esupri === false) {
    return {
      ...base,
      caixas_pedidas: 0,
      pedido_sugerido: 0,
      pedido_ajustado: 0,
      valor: 0,
      cortado: false,
      bloqueado: true,
      motivo: 'nao_vende',
    };
  }
  if (item.motivo === 'ficha_zerada' || item.ficha_zerada) {
    return {
      ...base,
      caixas_pedidas: 0,
      pedido_sugerido: 0,
      pedido_ajustado: 0,
      valor: 0,
      bloqueado: true,
      motivo: 'ficha_zerada',
    };
  }
  if (caixasCalc > 0 && !(num(item.preco_caixa) > 0)) {
    return {
      ...base,
      caixas_pedidas: 0,
      pedido_sugerido: 0,
      pedido_ajustado: 0,
      valor: 0,
      cortado: false,
      bloqueado: true,
      motivo: 'sem_preco',
    };
  }
  if (caixasCalc > CAIXAS_MAX_SIMULACAO) {
    return {
      ...base,
      caixas_pedidas: 0,
      pedido_sugerido: 0,
      pedido_ajustado: 0,
      valor: 0,
      cortado: false,
      bloqueado: true,
      motivo: 'quantidade_alta',
    };
  }
  return base;
}

function chaveInsumo(codigo) {
  return String(codigo || '').trim().toUpperCase();
}

function chaveSolta(codigo) {
  return chaveInsumo(codigo).replace(/^0+/, '');
}

export async function calcularRascunhoAbastecimento(
  idLoja,
  {
    dias = 7,
    estoque_seguranca_dias = 1,
    meta_cmp = META_CMP_PADRAO,
    janela_transito_dias = 21,
  } = {},
) {
  const id = Number(idLoja);
  if (!id) throw Object.assign(new Error('id_loja obrigatório'), { status: 400 });

  const diasRitmo = Math.min(Math.max(Number(dias) || 7, 1), 21);
  const segDias = Math.min(Math.max(Number(estoque_seguranca_dias) || 0, 0), 7);
  let diasCobertura = diasRitmo + segDias;
  let janelaCompra = null;
  const meta = Math.min(Math.max(num(meta_cmp, META_CMP_PADRAO), 0.05), 0.8);
  const janelaTransito = Math.min(Math.max(Number(janela_transito_dias) || 21, 7), 45);

  const hoje = hojeSpISO();
  const inicioAtual = addDays(hoje, -diasRitmo);
  const inicio3m = addDays(hoje, -90);
  const inicioAno = addYears(inicioAtual, -1);
  const fimAno = addYears(hoje, -1);
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const dia = Number(hoje.slice(8, 10));
  const decorridos = Math.max(dia - 1, 0);
  const diasMes = diasNoMes(hoje);

  const { rows: lojaRows } = await pool.query(
    `SELECT id_loja, name, bk_number FROM lojas WHERE id_loja = $1`,
    [id],
  );
  const loja = lojaRows[0] || { id_loja: id, name: '', bk_number: '' };
  janelaCompra = janelaDaLoja({ bk: loja.bk_number, nome: loja.name });
  const diasAlvo = janelaCompra
    ? Math.min(Math.max(janelaCompra.dias_ate_entrega_seguinte, 1), 21)
    : diasRitmo;
  diasCobertura = diasAlvo + segDias;

  const { rows: consumoRows } = await pool.query(
    `
    WITH vendas AS (
      SELECT vi.codigo,
        SUM(vi.qtde) FILTER (
          WHERE v.data_venda >= $2::date AND v.data_venda < $6::date
        ) AS q_atual,
        SUM(vi.qtde) FILTER (
          WHERE v.data_venda >= $3::date AND v.data_venda < $6::date
        ) AS q_3m,
        SUM(vi.qtde) FILTER (
          WHERE v.data_venda >= $4::date AND v.data_venda < $5::date
        ) AS q_ano
      FROM estoque_vendas v
      JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
      WHERE v.id_loja = $1
        AND v.origem = 'bkoffice'
        AND (
          (v.data_venda >= $3::date AND v.data_venda < $6::date)
          OR (v.data_venda >= $4::date AND v.data_venda < $5::date)
        )
      GROUP BY vi.codigo
    ),
    receita AS (
      SELECT p.codigo AS codigo_produto,
             fi.codigo_insumo,
             COALESCE(fi.qtde_estoque, fi.quantidade, 0)::numeric AS q_est
      FROM produtos p
      JOIN ficha_tecnica f ON f.id_produto = p.id_produto AND f.ativo
      JOIN ficha_tecnica_itens fi ON fi.id_ficha = f.id_ficha
      WHERE p.id_loja = $1 AND p.ativo
      UNION ALL
      SELECT p.codigo, i.codigo, 1::numeric
      FROM produtos p
      JOIN insumos i
        ON i.id_loja = p.id_loja AND UPPER(i.codigo) = UPPER(p.codigo)
      WHERE p.id_loja = $1
        AND p.ativo
        AND p.requer_ficha = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM ficha_tecnica f
          WHERE f.id_produto = p.id_produto AND f.ativo
        )
    )
    SELECT r.codigo_insumo,
           SUM(COALESCE(v.q_atual, 0) * r.q_est)::numeric AS q_atual,
           SUM(COALESCE(v.q_3m, 0) * r.q_est)::numeric AS q_3m,
           SUM(COALESCE(v.q_ano, 0) * r.q_est)::numeric AS q_ano
    FROM vendas v
    JOIN receita r ON UPPER(r.codigo_produto) = UPPER(v.codigo)
    GROUP BY r.codigo_insumo
    `,
    [id, inicioAtual, inicio3m, inicioAno, fimAno, hoje],
  );

  const { rows: insumoRows } = await pool.query(
    `
    SELECT i.codigo, i.descricao,
           COALESCE(i.unidade_contagem, 'und') AS unidade,
           COALESCE(s.quantidade, 0)::numeric AS saldo,
           COALESCE(i.preco_caixa, 0)::numeric AS preco_caixa,
           i.preco_esupri::numeric AS preco_esupri,
           i.vende_esupri,
           COALESCE(i.und_convertida, 1)::numeric AS und_convertida,
           i.custo_fonte
    FROM insumos i
    LEFT JOIN estoque_saldos s
      ON s.id_loja = i.id_loja AND s.id_insumo = i.id_insumo
    WHERE i.id_loja = $1 AND i.ativo = TRUE
    `,
    [id],
  );

  const { rows: transitoRows } = await pool.query(
    `
    SELECT i.codigo,
      SUM(
        CASE
          WHEN ni.qtd_estoque IS NOT NULL AND ni.qtd_estoque > 0 THEN ni.qtd_estoque
          ELSE COALESCE(ni.q_com, 0) * COALESCE(NULLIF(i.und_convertida, 0), 1)
        END
      )::numeric AS qtd
    FROM estoque_nfe n
    JOIN estoque_nfe_itens ni ON ni.id_nfe = n.id_nfe
    JOIN insumos i ON i.id_insumo = ni.id_insumo
    WHERE n.id_loja = $1
      AND COALESCE(n.status, '') <> 'erro'
      AND n.status_entrega = ANY($2::text[])
      AND n.emissao >= (CURRENT_DATE - ($3::int || ' days')::interval)::date
    GROUP BY i.codigo
    `,
    [id, STATUS_A_CAMINHO, janelaTransito],
  );

  const { rows: fornRows } = await pool.query(
    `
    SELECT DISTINCT ON (i.codigo) i.codigo, lower(n.fornecedor) AS fornecedor
    FROM estoque_nfe n
    JOIN estoque_nfe_itens ni ON ni.id_nfe = n.id_nfe
    JOIN insumos i ON i.id_insumo = ni.id_insumo
    WHERE n.id_loja = $1
      AND COALESCE(n.status, '') <> 'erro'
      AND n.emissao >= (CURRENT_DATE - INTERVAL '120 days')::date
    ORDER BY i.codigo, n.emissao DESC NULLS LAST, n.id_nfe DESC
    `,
    [id],
  );

  const marcaRede = String(loja.name || '').toUpperCase().includes('POP') ? '%POP%' : '%BURGER KING%';
  const { rows: platRows } = await pool.query(
    `
    SELECT DISTINCT ltrim(upper(trim(it.codigo)), '0') AS codigo
    FROM estoque_pedido_platlog p
    JOIN estoque_pedido_platlog_itens it ON it.id_pedido = p.id_pedido
    JOIN lojas l ON l.id_loja = p.id_loja
    WHERE p.data_pedido >= (CURRENT_DATE - INTERVAL '120 days')::date
      AND l.name ILIKE $1
    `,
    [marcaRede],
  );

  const { rows: vendaRows } = await pool.query(
    `
    SELECT
      COALESCE(SUM(vi.venda_liquida) FILTER (
        WHERE v.data_venda >= $2::date AND v.data_venda < $3::date
      ), 0)::numeric AS venda_mes,
      COALESCE(SUM(vi.venda_liquida) FILTER (
        WHERE v.data_venda >= $4::date AND v.data_venda < $3::date
      ), 0)::numeric AS venda_28
    FROM estoque_vendas v
    JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE v.id_loja = $1 AND v.origem = 'bkoffice'
    `,
    [id, inicioMes, hoje, addDays(hoje, -28)],
  );

  const { rows: compraRows } = await pool.query(
    `
    WITH nf AS (
      SELECT COALESCE(SUM(n.valor_total), 0)::numeric AS valor
      FROM estoque_nfe n
      WHERE n.id_loja = $1
        AND COALESCE(n.status, '') <> 'erro'
        AND COALESCE(n.status_entrega, '') <> 'cancelada'
        AND COALESCE(n.data_vencimento, n.emissao::date) >= $2::date
        AND COALESCE(n.data_vencimento, n.emissao::date) < $3::date
    ),
    man AS (
      SELECT COALESCE(SUM(
        m.quantidade * CASE
          WHEN i.custo_fonte IN ('nf', 'manual', 'catalogo') THEN COALESCE(i.valor_unidade, 0)
          ELSE 0
        END
      ), 0)::numeric AS valor
      FROM estoque_movimentos m
      JOIN insumos i ON i.id_insumo = m.id_insumo
      WHERE m.id_loja = $1
        AND m.tipo = 'entrada'
        AND COALESCE(m.referencia_tipo, '') <> 'estoque_nfe'
        AND COALESCE(i.entra_cmv, TRUE)
        AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) >= $2::date
        AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) < $3::date
    )
    SELECT (SELECT valor FROM nf) + (SELECT valor FROM man) AS compras
    `,
    [id, inicioMes, hoje],
  );

  const porInsumo = new Map();
  for (const row of insumoRows) {
    porInsumo.set(chaveInsumo(row.codigo), row);
  }
  const aCaminho = new Map();
  for (const row of transitoRows) aCaminho.set(chaveInsumo(row.codigo), num(row.qtd));
  const fornecedor = new Map();
  for (const row of fornRows) fornecedor.set(chaveInsumo(row.codigo), row.fornecedor || '');
  const porSolta = new Map();
  for (const key of porInsumo.keys()) {
    const solta = chaveSolta(key);
    if (solta && !porSolta.has(solta)) porSolta.set(solta, key);
  }
  const platlog = new Set();
  for (const row of platRows) {
    const key = porInsumo.has(chaveInsumo(row.codigo))
      ? chaveInsumo(row.codigo)
      : porSolta.get(chaveSolta(row.codigo));
    if (key) platlog.add(key);
  }
  for (const [key, ins] of porInsumo) {
    if (ins.vende_esupri === true) platlog.add(key);
  }

  const bruto = [];
  for (const c of consumoRows) {
    const key = chaveInsumo(c.codigo_insumo);
    const ins = porInsumo.get(key);
    if (!ins) continue;
    const blend = ritmoBlend({
      qAtual: num(c.q_atual),
      diasAtual: diasRitmo,
      q3m: num(c.q_3m),
      dias3m: 90,
      qAno: num(c.q_ano),
      diasAno: diasRitmo,
    });
    const saldo = num(ins.saldo);
    const caminho = aCaminho.get(key) || 0;
    const und = num(ins.und_convertida, 1) > 0 ? num(ins.und_convertida, 1) : 1;
    const cover = caixasParaCobrir({
      ritmo: blend.ritmo,
      diasCobertura,
      saldo,
      aCaminho: caminho,
      undConvertida: und,
    });
    const coberturaDias = blend.ritmo > 0 ? (saldo + caminho) / blend.ritmo : null;
    bruto.push({
      codigo: ins.codigo,
      descricao: ins.descricao,
      fornecedor: fornecedor.get(key) || '',
      ritmo_dia: round(blend.ritmo, 4),
      pesos: blend.pesos,
      consumo_atual: round(num(c.q_atual), 3),
      consumo_3m: round(num(c.q_3m), 3),
      consumo_ano: round(num(c.q_ano), 3),
      saldo_atual: round(saldo, 3),
      unidade: String(ins.unidade || 'und').trim().toLowerCase() || 'und',
      a_caminho: round(caminho, 3),
      cobertura_dias: coberturaDias == null ? null : round(coberturaDias, 1),
      und_convertida: round(und, 4),
      preco_nota: round(num(ins.preco_caixa), 2),
      preco_esupri: ins.preco_esupri != null ? round(num(ins.preco_esupri), 2) : null,
      vende_esupri: ins.vende_esupri === true ? true : ins.vende_esupri === false ? false : null,
      preco_caixa: ins.vende_esupri === false
        ? 0
        : ins.vende_esupri === true && num(ins.preco_esupri) > 0
          ? round(num(ins.preco_esupri), 2)
          : round(num(ins.preco_caixa), 2),
      custo_fonte: ins.custo_fonte || null,
      caixas: cover.caixas,
      necessidade: cover.necessidade,
      platlog: platlog.has(key),
    });
  }

  const jaNaLista = new Set(bruto.map((item) => chaveInsumo(item.codigo)));
  for (const key of platlog) {
    if (jaNaLista.has(key)) continue;
    const ins = porInsumo.get(key);
    if (!ins) continue;
    const saldo = num(ins.saldo);
    const caminho = aCaminho.get(key) || 0;
    const und = num(ins.und_convertida, 1) > 0 ? num(ins.und_convertida, 1) : 1;
    bruto.push({
      codigo: ins.codigo,
      descricao: ins.descricao,
      fornecedor: fornecedor.get(key) || 'platlog',
      ritmo_dia: 0,
      pesos: { atual: 0, tres_meses: 0, ano_passado: 0 },
      consumo_atual: 0,
      consumo_3m: 0,
      consumo_ano: 0,
      saldo_atual: round(saldo, 3),
      unidade: String(ins.unidade || 'und').trim().toLowerCase() || 'und',
      a_caminho: round(caminho, 3),
      cobertura_dias: null,
      und_convertida: round(und, 4),
      preco_nota: round(num(ins.preco_caixa), 2),
      preco_esupri: ins.preco_esupri != null ? round(num(ins.preco_esupri), 2) : null,
      vende_esupri: ins.vende_esupri === true ? true : ins.vende_esupri === false ? false : null,
      preco_caixa: ins.vende_esupri === false
        ? 0
        : ins.vende_esupri === true && num(ins.preco_esupri) > 0
          ? round(num(ins.preco_esupri), 2)
          : round(num(ins.preco_caixa), 2),
      custo_fonte: ins.custo_fonte || null,
      caixas: 0,
      necessidade: 0,
      platlog: true,
    });
  }

  const vendaMes = num(vendaRows[0]?.venda_mes);
  const venda28 = num(vendaRows[0]?.venda_28);
  let vendaProjetada = 0;
  let baseProjecao = 'mes';
  if (decorridos >= 7 && vendaMes > 0) {
    vendaProjetada = (vendaMes / decorridos) * diasMes;
  } else if (venda28 > 0) {
    vendaProjetada = (venda28 / 28) * diasMes;
    baseProjecao = '28_dias';
  }
  const comprasMes = num(compraRows[0]?.compras);
  const tetoMes = vendaProjetada > 0 ? vendaProjetada * meta : 0;
  const tetoRestante = Math.max(0, tetoMes - comprasMes);
  const cmpAtual = vendaMes > 0 ? comprasMes / vendaMes : null;
  const cmpAplicado = tetoMes > 0;

  const cortado = cmpAplicado
    ? aplicarTetoCmp(bruto, tetoRestante)
    : {
        itens: bruto.map((item) => ({
          ...item,
          caixas_pedidas: item.caixas,
          valor: item.preco_caixa > 0 ? round(item.caixas * item.preco_caixa, 2) : 0,
          cortado: false,
          motivo: item.preco_caixa > 0 ? null : 'sem_preco',
          sem_preco: !(item.preco_caixa > 0),
        })),
        restante: null,
      };

  const itens = cortado.itens
    .map((item) => ({
      codigo: item.codigo,
      descricao: item.descricao,
      fornecedor: item.fornecedor,
      ritmo_dia: item.ritmo_dia,
      pesos: item.pesos,
      consumo_atual: item.consumo_atual,
      consumo_3m: item.consumo_3m,
      consumo_ano: item.consumo_ano,
      saldo_atual: item.saldo_atual,
      unidade: item.unidade || 'und',
      a_caminho: item.a_caminho,
      cobertura_dias: item.cobertura_dias,
      und_convertida: item.und_convertida,
      preco_caixa: item.preco_caixa,
      preco_nota: item.preco_nota,
      preco_esupri: item.preco_esupri,
      vende_esupri: item.vende_esupri,
      custo_fonte: item.custo_fonte,
      necessidade: item.necessidade,
      caixas_calculo: item.caixas,
      caixas_pedidas: item.caixas_pedidas,
      pedido_sugerido: item.caixas_pedidas,
      pedido_ajustado: item.caixas_pedidas,
      valor: item.valor,
      cortado: Boolean(item.cortado),
      motivo: item.motivo || null,
      bloqueado: false,
      platlog: Boolean(item.platlog),
    }))
    .map((item) => segurarLinhaPedido(item))
    .filter((item) => item.platlog || item.ritmo_dia > 0 || item.a_caminho > 0)
    .sort((a, b) => {
      const da = a.cobertura_dias == null ? 9999 : a.cobertura_dias;
      const db = b.cobertura_dias == null ? 9999 : b.cobertura_dias;
      if (da !== db) return da - db;
      return b.valor - a.valor;
    });

  const valorPedido = round(
    itens.reduce((s, i) => s + num(i.valor), 0),
    2,
  );
  const bloqueio = lojaForaDoPilotoPedido({
    bk: loja.bk_number,
    nome: loja.name,
  });
  const bloqueados = itens.filter((i) => i.bloqueado).length;

  const rascunho = {
    id_loja: id,
    loja_nome: loja.name || '',
    bk_number: loja.bk_number || '',
    piloto_carrinho_bloqueado: Boolean(bloqueio),
    piloto_bloqueio: bloqueio ? bloqueio.nome : null,
    platlog_itens: itens.filter((i) => i.platlog).length,
    dias_cobertura: diasCobertura,
    dias_ciclo: diasAlvo,
    janela_compra: janelaCompra,
    estoque_seguranca_dias: segDias,
    janela_transito_dias: janelaTransito,
    periodos: {
      atual: { de: inicioAtual, ate: addDays(hoje, -1) },
      tres_meses: { de: inicio3m, ate: addDays(hoje, -1) },
      ano_passado: { de: inicioAno, ate: addDays(fimAno, -1) },
    },
    cmp: {
      meta_pct: round(meta * 100, 2),
      cmp_atual_pct: cmpAtual == null ? null : round(cmpAtual * 100, 2),
      venda_mes: round(vendaMes, 2),
      venda_projetada: round(vendaProjetada, 2),
      base_projecao: baseProjecao,
      compras_mes: round(comprasMes, 2),
      teto_mes: round(tetoMes, 2),
      teto_restante: round(tetoRestante, 2),
      valor_pedido: valorPedido,
      teto_aplicado: cmpAplicado,
      cortados: itens.filter((i) => i.cortado).length,
    },
    bloqueados,
    itens,
  };

  rascunho.simulacao = await gravarSimulacaoPedido(id, rascunho, {
    dias: diasAlvo,
    estoque_seguranca_dias: segDias,
    meta_cmp: meta,
  });
  return rascunho;
}

/** Guarda a simulação. O modo é sempre teste: esta tabela não representa pedido enviado. */
export async function gravarSimulacaoPedido(idLoja, rascunho, params) {
  const comCaixa = rascunho.itens.filter((i) => num(i.caixas_pedidas) > 0).length;
  try {
    const { rows } = await pool.query(
      `
      INSERT INTO estoque_pedido_simulacao (
        id_loja, modo, dias, estoque_seguranca_dias, meta_cmp,
        valor_pedido, itens_com_caixa, itens_bloqueados, resumo, itens
      )
      VALUES ($1, 'teste', $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
      RETURNING id_simulacao, criado_em
      `,
      [
        idLoja,
        params.dias,
        params.estoque_seguranca_dias,
        params.meta_cmp,
        num(rascunho.cmp?.valor_pedido),
        comCaixa,
        rascunho.bloqueados || 0,
        JSON.stringify({
          loja_nome: rascunho.loja_nome,
          bk_number: rascunho.bk_number,
          cmp: rascunho.cmp,
          periodos: rascunho.periodos,
          janela_compra: rascunho.janela_compra,
          piloto_carrinho_bloqueado: rascunho.piloto_carrinho_bloqueado,
        }),
        JSON.stringify(rascunho.itens),
      ],
    );
    return {
      id_simulacao: Number(rows[0].id_simulacao),
      criado_em: rows[0].criado_em,
      modo: 'teste',
    };
  } catch (e) {
    if (e.code === '42P01') return null;
    throw e;
  }
}

/** Grava o preço lido no eSupri. Não mexe no custo da nota. */
async function idsInsumoDoCodigo(idLoja, codigo) {
  const alvo = String(codigo || '').trim().toUpperCase();
  const norm = alvo.replace(/^0+/, '') || '0';
  const { rows } = await pool.query(
    `
    SELECT id_insumo, codigo
    FROM insumos
    WHERE id_loja = $1
      AND regexp_replace(upper(codigo), '^0+', '') = $2
    `,
    [idLoja, norm],
  );
  const exato = rows.filter((r) => String(r.codigo).trim().toUpperCase() === alvo);
  if (exato.length) return exato.map((r) => r.id_insumo);
  if (rows.length === 1) return [rows[0].id_insumo];
  return [];
}

export async function gravarPrecosEsupri(idLoja, { preenchidos = [], naoEncontrados = [] } = {}) {
  const id = Number(idLoja);
  for (const linha of preenchidos) {
    const preco = Number(linha.preco_portal);
    if (!(preco > 0) || !linha.codigo) continue;
    const ids = await idsInsumoDoCodigo(id, linha.codigo);
    if (!ids.length) continue;
    await pool.query(
      `
      UPDATE insumos
      SET preco_esupri = $3, vende_esupri = TRUE, atualizado_em = NOW()
      WHERE id_loja = $1 AND id_insumo = ANY($2::bigint[])
      `,
      [id, ids, preco],
    );
  }
  for (const linha of naoEncontrados) {
    if (!linha.codigo) continue;
    const ids = await idsInsumoDoCodigo(id, linha.codigo);
    if (!ids.length) continue;
    await pool.query(
      `
      UPDATE insumos
      SET preco_esupri = NULL, vende_esupri = FALSE, atualizado_em = NOW()
      WHERE id_loja = $1 AND id_insumo = ANY($2::bigint[])
      `,
      [id, ids],
    );
  }
}
