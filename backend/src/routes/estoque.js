import { Router } from 'express';
import fs from 'fs';
import { pool } from '../db.js';
import { requirePermissao } from '../permissoes.js';
import { usuarioPodeLojaEstoque } from '../lojasUsuario.js';
import { auditar } from '../auditoriaHelpers.js';
import { ajustarSaldoPorContagem } from '../services/estoqueMotor.js';
import { calcularQtdContagem, flagsContagemDiaria } from '../services/estoqueContagem.js';
import { parseNfeXml } from '../services/nfeXml.js';
import estoqueOperacional from './estoqueOperacional.js';
import { parsePaginacaoOffset, montarEnvelopeOffset } from '../paginacao.js';

const router = Router();

const permProdutos = requirePermissao('estoque.produtos');
const permProdutosOuOp = requirePermissao('estoque.produtos', 'estoque.operacional', 'estoque.break');
const permConferencia = requirePermissao('estoque.conferencia');
const permResumoMes = requirePermissao('estoque.conferencia', 'estoque.break', 'estoque.operacional');
const permReabrirContagem = requirePermissao('estoque.conferencia.reabrir');
const verModulo = requirePermissao(
  'estoque.produtos',
  'estoque.conferencia',
  'estoque.operacional',
  'estoque.break',
);

router.use(estoqueOperacional);

router.get('/lojas', verModulo, async (req, res, next) => {
  try {
    const ids = req.user?.lojas_ids_estoque;
    if (!Array.isArray(ids) || !ids.length) return res.json([]);
    const { ativas, operacionais } = req.query;
    const params = [ids];
    let q = 'SELECT * FROM lojas WHERE id_loja = ANY($1::int[])';
    if (ativas === '1' || ativas === 'true') q += ' AND is_active = TRUE';
    if (operacionais === '1' || operacionais === 'true') q += ' AND bk_number IS NOT NULL';
    q += ' ORDER BY name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function unidadeMaiuscula(v) {
  return String(v || 'UND').trim().toUpperCase() || 'UND';
}

function parseIdLoja(src) {
  const id = Number(src);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function acessoLoja(req, idLoja) {
  if (!idLoja) return { status: 400, error: 'Selecione a loja' };
  if (!usuarioPodeLojaEstoque(req.user, idLoja)) {
    return { status: 403, error: 'Sem acesso a esta loja' };
  }
  return null;
}

function hojeISOBrasil() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function tituloConferencia(dataISO, tipo = 'completa') {
  const [y, m, d] = String(dataISO || '').split('-');
  const dataLabel = y && m && d ? `${d}/${m}/${y}` : null;
  if (tipo === 'diaria') {
    return dataLabel ? `Diária ${dataLabel}` : 'Contagem diária';
  }
  if (tipo === 'critica_semanal') {
    return dataLabel ? `Semanal mix/latas ${dataLabel}` : 'Contagem semanal (mix e latas)';
  }
  if (!dataLabel) return 'Conferência de estoque';
  return `Conferência ${dataLabel}`;
}

function normalizarTipoContagem(raw) {
  const t = String(raw || 'completa').trim().toLowerCase();
  if (t === 'diaria' || t === 'diario' || t === 'dia') return 'diaria';
  if (t === 'critica_semanal' || t === 'semanal' || t === 'critica') return 'critica_semanal';
  return 'completa';
}

function filtroItensPorTipo(tipoContagem) {
  if (tipoContagem === 'diaria') return ' AND p.contagem_diaria = TRUE';
  if (tipoContagem === 'critica_semanal') return ' AND p.contagem_critica = TRUE';
  return '';
}

function erroSemItensTipo(tipoContagem) {
  if (tipoContagem === 'diaria') {
    return 'Nenhum item de contagem diária nesta loja (giro do cadastro: carnes, frango, queijo, bacon, pão, batata, óleo, copos)';
  }
  if (tipoContagem === 'critica_semanal') {
    return 'Nenhum item da semanal nesta loja (mix e latas)';
  }
  return null;
}

async function criarContagemComItens(
  client,
  { id_loja, data_contagem, titulo, observacao, idUsuario, usarUltimo, tipo = 'completa' },
) {
  if (!id_loja) throw Object.assign(new Error('Loja obrigatória'), { status: 400 });
  const tipoContagem = normalizarTipoContagem(tipo);
  const filtroItens = filtroItensPorTipo(tipoContagem);
  const erroVazio = erroSemItensTipo(tipoContagem);

  const { rows: cont } = await client.query(
    `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, criado_por, tipo)
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, 'aberta', $4, $5, $6)
     RETURNING id_contagem`,
    [id_loja, data_contagem, titulo, observacao, idUsuario || null, tipoContagem],
  );
  const idContagem = cont[0].id_contagem;

  if (usarUltimo !== false) {
    const { rowCount } = await client.query(
      `INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
       SELECT $1, p.id_insumo,
              COALESCE(s.quantidade, u.estoque, 0),
              NULL
       FROM insumos p
       LEFT JOIN estoque_saldos s
         ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
       LEFT JOIN (
         SELECT DISTINCT ON (i.id_insumo)
           i.id_insumo,
           COALESCE(i.estoque_contado, i.estoque_sistema, 0) AS estoque
         FROM estoque_itens i
         JOIN estoque_contagens c ON c.id_contagem = i.id_contagem
         WHERE c.status = 'finalizada'
           AND c.id_loja = $2
         ORDER BY i.id_insumo, c.data_contagem DESC, c.id_contagem DESC
       ) u ON u.id_insumo = p.id_insumo
       WHERE p.ativo = TRUE AND p.id_loja = $2${filtroItens}
       ORDER BY p.secao_contagem NULLS LAST, p.ordem_contagem NULLS LAST, p.descricao`,
      [idContagem, id_loja],
    );
    if (erroVazio && !rowCount) {
      throw Object.assign(new Error(erroVazio), { status: 400 });
    }
  } else {
    const { rowCount } = await client.query(
      `INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
       SELECT $1, p.id_insumo, 0, NULL
       FROM insumos p
       WHERE p.ativo = TRUE AND p.id_loja = $2${filtroItens}
       ORDER BY p.secao_contagem NULLS LAST, p.ordem_contagem NULLS LAST, p.descricao`,
      [idContagem, id_loja],
    );
    if (erroVazio && !rowCount) {
      throw Object.assign(new Error(erroVazio), { status: 400 });
    }
  }
  return idContagem;
}

function flagBool(v, fallback = true) {
  if (v === null || v === undefined) return fallback;
  return v !== false && v !== 'f' && v !== 0 && v !== '0';
}

function mapProduto(row) {
  const id_insumo = row.id_insumo ?? row.id_produto;
  return {
    id_insumo,
    id_produto: id_insumo, // alias de transição (frontend antigo)
    id_loja: row.id_loja != null ? Number(row.id_loja) : null,
    codigo: row.codigo,
    descricao: row.descricao,
    unidade_contagem: unidadeMaiuscula(row.unidade_contagem),
    preco_caixa: row.preco_caixa != null ? Number(row.preco_caixa) : 0,
    und_convertida: row.und_convertida != null ? Number(row.und_convertida) : 1,
    und_parcial: row.und_parcial != null ? Number(row.und_parcial) : 1,
    valor_unidade: row.valor_unidade != null ? Number(row.valor_unidade) : 0,
    /** nf | catalogo | manual — fontes que o CMV aceita (planilha/null não). */
    custo_fonte: row.custo_fonte != null ? String(row.custo_fonte) : null,
    permite_contagem_caixa: flagBool(row.permite_contagem_caixa, true),
    permite_contagem_pc_fd: flagBool(row.permite_contagem_pc_fd, true),
    permite_contagem_kg_und: flagBool(row.permite_contagem_kg_und, true),
    entra_cmv: flagBool(row.entra_cmv, true),
    secao_contagem: row.secao_contagem != null ? String(row.secao_contagem) : null,
    ordem_contagem: row.ordem_contagem != null ? Number(row.ordem_contagem) : null,
    ativo: row.ativo !== false,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

function mapItem(row) {
  const estoque_sistema = num(row.estoque_sistema);
  const und_convertida = num(row.und_convertida, 1);
  const und_parcial = num(row.und_parcial, 1);
  const permite_contagem_caixa = flagBool(row.permite_contagem_caixa, true);
  const permite_contagem_pc_fd = flagBool(row.permite_contagem_pc_fd, true);
  const permite_contagem_kg_und = flagBool(row.permite_contagem_kg_und, true);
  const entra_cmv = flagBool(row.entra_cmv, true);
  const secao_contagem = row.secao_contagem != null ? String(row.secao_contagem) : null;
  const ordem_contagem = row.ordem_contagem != null ? Number(row.ordem_contagem) : null;

  let contagem_caixa =
    row.contagem_caixa == null || row.contagem_caixa === ''
      ? null
      : num(row.contagem_caixa);
  let contagem_pc_fd =
    row.contagem_pc_fd == null || row.contagem_pc_fd === ''
      ? null
      : num(row.contagem_pc_fd);
  let contagem_kg_und =
    row.contagem_kg_und == null || row.contagem_kg_und === ''
      ? null
      : num(row.contagem_kg_und);

  if (!permite_contagem_caixa) contagem_caixa = null;
  if (!permite_contagem_pc_fd) contagem_pc_fd = null;
  if (!permite_contagem_kg_und) contagem_kg_und = null;

  let estoque_contado =
    row.estoque_contado == null || row.estoque_contado === ''
      ? null
      : num(row.estoque_contado);

  // Preferência: recalcular QTD pelos 3 campos Terraço quando houver entrada
  const qtdCalc = calcularQtdContagem({
    contagem_caixa,
    contagem_pc_fd,
    contagem_kg_und,
    und_convertida,
    und_parcial,
    permite_contagem_caixa,
    permite_contagem_pc_fd,
    permite_contagem_kg_und,
  });
  if (qtdCalc != null) estoque_contado = qtdCalc;

  const valor_unidade = num(row.valor_unidade);
  const qtd = estoque_contado ?? 0;
  const valor_estoque = Math.round(qtd * valor_unidade * 100) / 100;
  const diferenca = estoque_contado == null ? null : estoque_contado - estoque_sistema;
  const id_insumo = row.id_insumo ?? row.id_produto;
  return {
    id_item: row.id_item,
    id_insumo,
    id_produto: id_insumo, // alias de transição
    codigo: row.codigo,
    descricao: row.descricao,
    unidade_contagem: unidadeMaiuscula(row.unidade_contagem),
    preco_caixa: num(row.preco_caixa),
    und_convertida,
    und_parcial,
    valor_unidade,
    permite_contagem_caixa,
    permite_contagem_pc_fd,
    permite_contagem_kg_und,
    entra_cmv,
    secao_contagem,
    ordem_contagem,
    estoque_sistema,
    contagem_caixa,
    contagem_pc_fd,
    contagem_kg_und,
    estoque_contado,
    diferenca,
    valor_estoque: estoque_contado == null ? null : valor_estoque,
  };
}

function primeiroDiaMes(iso) {
  const s = String(iso || '').slice(0, 10);
  return s.length >= 7 ? `${s.slice(0, 7)}-01` : s;
}

function round2(v) {
  if (v == null || Number.isNaN(Number(v))) return null;
  return Math.round(Number(v) * 100) / 100;
}

let schemaNfeVencimentoPromise = null;

async function garantirSchemaNfeVencimento() {
  if (!schemaNfeVencimentoPromise) {
    schemaNfeVencimentoPromise = (async () => {
      await pool.query(
        `ALTER TABLE estoque_nfe ADD COLUMN IF NOT EXISTS data_vencimento DATE`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_estoque_nfe_loja_vencimento
         ON estoque_nfe (id_loja, data_vencimento)`,
      );
      const { rows } = await pool.query(
        `SELECT id_nfe, xml_path FROM estoque_nfe
         WHERE data_vencimento IS NULL
           AND xml_path IS NOT NULL AND xml_path <> ''`,
      );
      for (const r of rows) {
        try {
          if (!/\.xml$/i.test(r.xml_path) || !fs.existsSync(r.xml_path)) continue;
          const xml = fs.readFileSync(r.xml_path, 'utf8');
          const venc = parseNfeXml(xml).data_vencimento;
          if (!venc) continue;
          await pool.query(
            `UPDATE estoque_nfe SET data_vencimento = $2::date WHERE id_nfe = $1`,
            [r.id_nfe, venc],
          );
        } catch {
          /* XML antigo ou caminho do hub diferente — ignora */
        }
      }
    })().catch((e) => {
      schemaNfeVencimentoPromise = null;
      throw e;
    });
  }
  return schemaNfeVencimentoPromise;
}

/**
 * Totais do mês para os cards: break (custo dos insumos), desperdício,
 * compras (NFs com vencimento no mês, todos os fornecedores, com ou sem entrada)
 * e CMV em andamento.
 * Valor atual = EI + compras − saídas — não usa saldo vivo negativo.
 */
async function resumoMesLoja(idLoja, dataRef) {
  if (!idLoja) {
    return {
      valor_break_mes: null,
      valor_desperdicio_mes: null,
      valor_compras_mes: null,
      cmv_teorico_pct: null,
      valor_atual_loja: null,
    };
  }
  const hoje = dataRef || hojeISOBrasil();
  await garantirSchemaNfeVencimento();
  const inicioMes = primeiroDiaMes(hoje);
  const inicio = await valorInicialMes(idLoja, hoje);
  const de = inicio.data_inicial_mes || inicioMes;
  const ei = inicio.valor_inicial_mes;

  const { rows: perdas } = await pool.query(
    `SELECT
       COALESCE(SUM(ABS(m.quantidade) * COALESCE(i.valor_unidade, 0))
         FILTER (WHERE COALESCE(b.tipo, 'refeicao') IN ('refeicao', 'outro')), 0)::numeric AS break_valor,
       COALESCE(SUM(ABS(m.quantidade) * COALESCE(i.valor_unidade, 0))
         FILTER (WHERE b.tipo IN ('desperdicio_completo', 'desperdicio_incompleto')), 0)::numeric AS desperdicio_valor
     FROM estoque_break b
     JOIN estoque_movimentos m
       ON m.referencia_tipo = 'estoque_break'
      AND m.referencia_id = b.id_break
      AND m.id_loja = b.id_loja
     JOIN insumos i ON i.id_insumo = m.id_insumo
     WHERE b.id_loja = $1
       AND b.data_break >= $2::date
       AND b.data_break <= $3::date`,
    [idLoja, de, hoje],
  );

  const { rows: comprasNf } = await pool.query(
    `SELECT
       COALESCE(SUM(valor_total) FILTER (WHERE d >= $2::date AND d <= $4::date), 0)::numeric AS compras_mes,
       COALESCE(SUM(valor_total) FILTER (WHERE d >= $3::date AND d <= $4::date), 0)::numeric AS compras_apos_ei
     FROM (
       SELECT n.valor_total,
              COALESCE(n.data_vencimento, n.emissao::date) AS d
       FROM estoque_nfe n
       WHERE n.id_loja = $1
         AND COALESCE(n.status, '') <> 'erro'
     ) x`,
    [idLoja, inicioMes, de, hoje],
  );

  const { rows: comprasManuais } = await pool.query(
    `SELECT
       COALESCE(SUM(v) FILTER (WHERE d >= $2::date AND d <= $4::date), 0)::numeric AS compras_mes,
       COALESCE(SUM(v) FILTER (WHERE d >= $3::date AND d <= $4::date), 0)::numeric AS compras_apos_ei
     FROM (
       SELECT m.quantidade * COALESCE(i.valor_unidade, 0) AS v,
              COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) AS d
       FROM estoque_movimentos m
       JOIN insumos i ON i.id_insumo = m.id_insumo
       WHERE m.id_loja = $1
         AND m.tipo = 'entrada'
         AND COALESCE(m.referencia_tipo, '') <> 'estoque_nfe'
         AND COALESCE(i.entra_cmv, TRUE)
     ) x`,
    [idLoja, inicioMes, de, hoje],
  );

  const { rows: saidas } = await pool.query(
    `SELECT COALESCE(SUM(
       ABS(m.quantidade) * COALESCE(i.valor_unidade, 0)
     ) FILTER (WHERE m.tipo = 'venda'), 0)::numeric AS venda_custo,
     COALESCE(SUM(
       ABS(m.quantidade) * COALESCE(i.valor_unidade, 0)
     ) FILTER (WHERE m.tipo = 'break'), 0)::numeric AS perdas_custo
     FROM estoque_movimentos m
     JOIN insumos i ON i.id_insumo = m.id_insumo
     WHERE m.id_loja = $1
       AND m.tipo IN ('venda', 'break')
       AND COALESCE(i.entra_cmv, TRUE)
       AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) >= $2::date
       AND COALESCE(m.data_movimento, (m.criado_em AT TIME ZONE 'America/Sao_Paulo')::date) <= $3::date`,
    [idLoja, de, hoje],
  );

  const { rows: vendas } = await pool.query(
    `SELECT COALESCE(SUM(vi.venda_liquida), 0)::numeric AS venda
     FROM estoque_vendas v
     JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
     WHERE v.id_loja = $1
       AND v.data_venda >= $2::date
       AND v.data_venda <= $3::date`,
    [idLoja, de, hoje],
  );

  const { rows: liveRows } = await pool.query(
    `SELECT ROUND(SUM(
       COALESCE(s.quantidade, 0) * COALESCE(p.valor_unidade, 0)
     )::numeric, 2) AS total,
     COUNT(*) FILTER (WHERE s.id_insumo IS NOT NULL)::int AS n_saldos
     FROM insumos p
     LEFT JOIN estoque_saldos s
       ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
     WHERE p.id_loja = $1
       AND p.ativo = TRUE
       AND COALESCE(p.entra_cmv, TRUE)`,
    [idLoja],
  );

  const breakValor = Number(perdas[0]?.break_valor || 0);
  const desperdicioValor = Number(perdas[0]?.desperdicio_valor || 0);
  const comprasMes = round2(
    Number(comprasNf[0]?.compras_mes || 0) + Number(comprasManuais[0]?.compras_mes || 0),
  );
  const comprasAposEi = round2(
    Number(comprasNf[0]?.compras_apos_ei || 0) + Number(comprasManuais[0]?.compras_apos_ei || 0),
  );
  const saidasValor =
    Number(saidas[0]?.venda_custo || 0) + Number(saidas[0]?.perdas_custo || 0);
  const venda = Number(vendas[0]?.venda || 0);
  const live = liveRows[0]?.n_saldos ? Number(liveRows[0].total) : null;

  let valorAtual = null;
  if (ei != null) {
    valorAtual = round2(ei + comprasAposEi - saidasValor);
  } else if (live != null && live >= 0) {
    valorAtual = round2(live);
  }
  if (valorAtual != null && valorAtual < 0) valorAtual = 0;

  let cmvPct = null;
  if (venda > 0 && ei != null && valorAtual != null) {
    cmvPct = Math.round(((ei + comprasAposEi - valorAtual) / venda) * 10000) / 100;
  } else if (venda > 0 && saidasValor > 0) {
    cmvPct = Math.round((saidasValor / venda) * 10000) / 100;
  }

  return {
    valor_break_mes: round2(breakValor) ?? 0,
    valor_desperdicio_mes: round2(desperdicioValor) ?? 0,
    valor_compras_mes: comprasMes ?? 0,
    cmv_teorico_pct: cmvPct,
    valor_atual_loja: valorAtual,
  };
}

/** Valor da 1ª contagem completa finalizada do mês (início do estoque do mês). */
async function valorInicialMes(idLoja, dataRef) {
  if (!idLoja) return { valor_inicial_mes: null, data_inicial_mes: null, id_contagem_inicial: null };
  const { rows } = await pool.query(
    `SELECT c.id_contagem, c.data_contagem,
            COALESCE(
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
            ) AS total_valor
     FROM estoque_contagens c
     WHERE c.id_loja = $1
       AND c.status = 'finalizada'
       AND COALESCE(c.tipo, 'completa') = 'completa'
       AND date_trunc('month', c.data_contagem) = date_trunc('month', $2::date)
     ORDER BY c.data_contagem ASC, c.id_contagem ASC
     LIMIT 1`,
    [idLoja, dataRef || hojeISOBrasil()],
  );
  if (!rows.length) {
    return { valor_inicial_mes: null, data_inicial_mes: null, id_contagem_inicial: null };
  }
  return {
    valor_inicial_mes: rows[0].total_valor != null ? Number(rows[0].total_valor) : null,
    data_inicial_mes: rows[0].data_contagem,
    id_contagem_inicial: rows[0].id_contagem,
  };
}

async function carregarContagem(id) {
  const { rows: contagens } = await pool.query(
    `SELECT c.*, l.name AS loja_nome, l.bk_number AS loja_codigo,
            u.nome AS criado_por_nome
     FROM estoque_contagens c
     LEFT JOIN lojas l ON l.id_loja = c.id_loja
     LEFT JOIN usuarios u ON u.id_usuario = c.criado_por
     WHERE c.id_contagem = $1`,
    [id],
  );
  if (!contagens.length) return null;

  const { rows: itens } = await pool.query(
    `SELECT i.id_item, i.id_insumo, i.estoque_sistema, i.estoque_contado,
            i.contagem_caixa, i.contagem_pc_fd, i.contagem_kg_und,
            p.codigo, p.descricao, p.unidade_contagem, p.preco_caixa,
            p.und_convertida, COALESCE(p.und_parcial, 1) AS und_parcial, p.valor_unidade,
            COALESCE(p.permite_contagem_caixa, TRUE) AS permite_contagem_caixa,
            COALESCE(p.permite_contagem_pc_fd, TRUE) AS permite_contagem_pc_fd,
            COALESCE(p.permite_contagem_kg_und, TRUE) AS permite_contagem_kg_und,
            COALESCE(p.entra_cmv, TRUE) AS entra_cmv,
            p.secao_contagem,
            p.ordem_contagem
     FROM estoque_itens i
     JOIN insumos p ON p.id_insumo = i.id_insumo
     WHERE i.id_contagem = $1
     ORDER BY p.secao_contagem NULLS LAST, p.ordem_contagem NULLS LAST, p.descricao, i.id_item`,
    [id],
  );

  const mapped = itens.map(mapItem);
  const comContagem = mapped.filter((i) => i.estoque_contado != null);
  /** TOTAL do topo = soma CMV (planilha SUM I7:I231). */
  const total_valor =
    Math.round(
      comContagem
        .filter((i) => i.entra_cmv)
        .reduce((s, i) => s + (i.valor_estoque || 0), 0) * 100,
    ) / 100;
  const total_diferenca =
    Math.round(comContagem.reduce((s, i) => s + (i.diferenca || 0), 0) * 1000) / 1000;
  const divergencias = comContagem.filter((i) => i.diferenca !== 0).length;
  const pendentes = mapped.filter((i) => i.estoque_contado == null).length;

  const c = contagens[0];
  const [inicioMes, resumoMes] = await Promise.all([
    valorInicialMes(c.id_loja, c.data_contagem || hojeISOBrasil()),
    resumoMesLoja(c.id_loja, hojeISOBrasil()),
  ]);
  return {
    id_contagem: c.id_contagem,
    id_loja: c.id_loja,
    loja_nome: c.loja_nome,
    loja_codigo: c.loja_codigo,
    data_contagem: c.data_contagem,
    titulo: c.titulo,
    tipo: c.tipo || 'completa',
    status: c.status,
    observacao: c.observacao,
    total_valor,
    valor_atual: total_valor,
    ...inicioMes,
    ...resumoMes,
    total_diferenca,
    divergencias,
    pendentes,
    itens_total: mapped.length,
    criado_por: c.criado_por,
    criado_por_nome: c.criado_por_nome,
    criado_em: c.criado_em,
    finalizado_em: c.finalizado_em,
    itens: mapped,
  };
}

// ── Insumos (cadastro por loja; tabela insumos) ─────────────────────────────
// Paths primários: /insumos ; aliases /produtos para compatibilidade.

async function listarInsumos(req, res, next) {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const q = String(req.query.q || '').trim();
    const ativos = req.query.ativos;
    const params = [idLoja];
    const where = ['id_loja = $1'];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(codigo ILIKE $${params.length} OR descricao ILIKE $${params.length})`);
    }
    if (ativos === '1') where.push('ativo = TRUE');
    if (ativos === '0') where.push('ativo = FALSE');

    const paginacao = parsePaginacaoOffset(req, { defaultPageSize: 50, maxPageSize: 200 });

    if (!paginacao.ativo) {
      const { rows } = await pool.query(
        `SELECT * FROM insumos
         WHERE ${where.join(' AND ')}
         ORDER BY descricao`,
        params,
      );
      return res.json(rows.map(mapProduto));
    }

    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM insumos WHERE ${where.join(' AND ')}`,
      params,
    );
    const paramsPagina = [...params, paginacao.pageSize, paginacao.offset];
    const { rows } = await pool.query(
      `SELECT * FROM insumos
       WHERE ${where.join(' AND ')}
       ORDER BY descricao
       LIMIT $${paramsPagina.length - 1} OFFSET $${paramsPagina.length}`,
      paramsPagina,
    );
    res.json(
      montarEnvelopeOffset(rows.map(mapProduto), {
        page: paginacao.page,
        pageSize: paginacao.pageSize,
        total: totalRows[0].total,
      }),
    );
  } catch (e) {
    next(e);
  }
}

async function criarInsumo(req, res, next) {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const codigo = String(req.body?.codigo || '').trim().toUpperCase();
    const descricao = String(req.body?.descricao || '').trim();
    const unidade_contagem = unidadeMaiuscula(req.body?.unidade_contagem);
    const preco_caixa = num(req.body?.preco_caixa);
    const und_convertida = num(req.body?.und_convertida, 1);
    const und_parcial = num(req.body?.und_parcial, 1);
    if (!codigo) return res.status(400).json({ error: 'Informe o código do insumo' });
    if (descricao.length < 2) {
      return res.status(400).json({ error: 'Informe a descrição do insumo (mín. 2 caracteres)' });
    }
    if (und_convertida <= 0) {
      return res.status(400).json({ error: 'UND convertida deve ser maior que zero' });
    }
    if (und_parcial <= 0) {
      return res.status(400).json({ error: 'UND parcial (PC/FD) deve ser maior que zero' });
    }

    const diaria = flagsContagemDiaria(descricao);
    const { rows } = await pool.query(
      `INSERT INTO insumos (id_loja, codigo, descricao, unidade_contagem, preco_caixa, und_convertida, und_parcial, ativo, contagem_diaria, grupo_diario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9)
       RETURNING *`,
      [
        idLoja,
        codigo,
        descricao,
        unidade_contagem,
        preco_caixa,
        und_convertida,
        und_parcial,
        diaria.contagem_diaria,
        diaria.grupo_diario,
      ],
    );
    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'insumo',
      idReferencia: rows[0].id_insumo,
      descricao: `Insumo criado (loja ${idLoja}): ${codigo} — ${descricao}`,
    });
    res.status(201).json(mapProduto(rows[0]));
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Já existe um insumo com este código nesta loja' });
    }
    next(e);
  }
}

async function atualizarInsumo(req, res, next) {
  try {
    const id = Number(req.params.id);
    const atual = await pool.query('SELECT * FROM insumos WHERE id_insumo = $1', [id]);
    if (!atual.rows.length) return res.status(404).json({ error: 'Insumo não encontrado' });

    const prev = atual.rows[0];
    const bloqueio = acessoLoja(req, prev.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const codigo =
      req.body?.codigo != null ? String(req.body.codigo).trim().toUpperCase() : prev.codigo;
    const descricao =
      req.body?.descricao != null ? String(req.body.descricao).trim() : prev.descricao;
    const unidade_contagem =
      req.body?.unidade_contagem != null
        ? unidadeMaiuscula(req.body.unidade_contagem)
        : unidadeMaiuscula(prev.unidade_contagem);
    const preco_caixa =
      req.body?.preco_caixa != null ? num(req.body.preco_caixa) : num(prev.preco_caixa);
    const und_convertida =
      req.body?.und_convertida != null
        ? num(req.body.und_convertida, 1)
        : num(prev.und_convertida, 1);
    const und_parcial =
      req.body?.und_parcial != null
        ? num(req.body.und_parcial, 1)
        : num(prev.und_parcial, 1);
    const ativo = req.body?.ativo != null ? !!req.body.ativo : prev.ativo !== false;

    if (!codigo) return res.status(400).json({ error: 'Informe o código do insumo' });
    if (descricao.length < 2) return res.status(400).json({ error: 'Informe a descrição do insumo' });
    if (und_convertida <= 0) {
      return res.status(400).json({ error: 'UND convertida deve ser maior que zero' });
    }
    if (und_parcial <= 0) {
      return res.status(400).json({ error: 'UND parcial (PC/FD) deve ser maior que zero' });
    }

    const diaria = flagsContagemDiaria(descricao);
    const { rows } = await pool.query(
      `UPDATE insumos
       SET codigo = $1, descricao = $2, unidade_contagem = $3,
           preco_caixa = $4, und_convertida = $5, und_parcial = $6,
           ativo = $7, contagem_diaria = $8, grupo_diario = $9, atualizado_em = NOW()
       WHERE id_insumo = $10 AND id_loja = $11
       RETURNING *`,
      [
        codigo,
        descricao,
        unidade_contagem,
        preco_caixa,
        und_convertida,
        und_parcial,
        ativo,
        diaria.contagem_diaria,
        diaria.grupo_diario,
        id,
        prev.id_loja,
      ],
    );
    await auditar(req, {
      modulo: 'estoque',
      acao: 'atualizar',
      entidade: 'insumo',
      idReferencia: id,
      descricao: `Insumo atualizado (loja ${prev.id_loja}): ${codigo}`,
    });
    res.json(mapProduto(rows[0]));
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Já existe um insumo com este código nesta loja' });
    }
    next(e);
  }
}

router.get('/insumos', permProdutosOuOp, listarInsumos);
router.get('/produtos', permProdutosOuOp, listarInsumos);
router.post('/insumos', permProdutos, criarInsumo);
router.post('/produtos', permProdutos, criarInsumo);
router.patch('/insumos/:id', permProdutos, atualizarInsumo);
router.patch('/produtos/:id', permProdutos, atualizarInsumo);

// ── Contagens / conferência (por loja) ─────────────────────────────────────

router.get('/resumo-mes', permResumoMes, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    const hoje = hojeISOBrasil();
    const [inicioMes, resumoMes] = await Promise.all([
      valorInicialMes(idLoja, hoje),
      resumoMesLoja(idLoja, hoje),
    ]);
    res.json({
      id_loja: idLoja,
      de: primeiroDiaMes(hoje),
      ate: hoje,
      valor_inicial_mes: inicioMes.valor_inicial_mes,
      data_inicial_mes: inicioMes.data_inicial_mes,
      ...resumoMes,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/contagens', permConferencia, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const paginacao = parsePaginacaoOffset(req, { defaultPageSize: 100, maxPageSize: 200 });
    const limite = paginacao.ativo ? paginacao.pageSize : 100;
    const paramsQuery = paginacao.ativo ? [idLoja, limite, paginacao.offset] : [idLoja];
    const clausulaLimit = paginacao.ativo ? 'LIMIT $2 OFFSET $3' : 'LIMIT 100';

    const { rows } = await pool.query(
      `SELECT c.id_contagem, c.id_loja, c.data_contagem, c.titulo, c.status,
              COALESCE(c.tipo, 'completa') AS tipo,
              c.observacao, c.criado_em, c.finalizado_em,
              c.criado_por, u.nome AS criado_por_nome,
              l.name AS loja_nome, l.bk_number AS loja_codigo,
              COALESCE(
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
              (SELECT COUNT(*)::int FROM estoque_itens i WHERE i.id_contagem = c.id_contagem) AS itens_total,
              (SELECT COUNT(*)::int FROM estoque_itens i
               WHERE i.id_contagem = c.id_contagem AND i.estoque_contado IS NULL) AS pendentes,
              (SELECT COUNT(*)::int FROM estoque_itens i
               WHERE i.id_contagem = c.id_contagem
                 AND i.estoque_contado IS NOT NULL
                 AND i.estoque_contado <> i.estoque_sistema) AS divergencias
       FROM estoque_contagens c
       LEFT JOIN lojas l ON l.id_loja = c.id_loja
       LEFT JOIN usuarios u ON u.id_usuario = c.criado_por
       WHERE c.id_loja = $1
       ORDER BY c.data_contagem DESC NULLS LAST, c.criado_em DESC, c.id_contagem DESC
       ${clausulaLimit}`,
      paramsQuery,
    );
    const [inicioMes, resumoMes] = await Promise.all([
      valorInicialMes(idLoja, hojeISOBrasil()),
      resumoMesLoja(idLoja, hojeISOBrasil()),
    ]);
    const mapeadas = rows.map((r) => ({
      ...r,
      total_valor: r.total_valor != null ? Number(r.total_valor) : null,
      valor_atual: r.total_valor != null ? Number(r.total_valor) : null,
      valor_inicial_mes: inicioMes.valor_inicial_mes,
      data_inicial_mes: inicioMes.data_inicial_mes,
      ...resumoMes,
    }));

    if (!paginacao.ativo) return res.json(mapeadas);

    const { rows: totalRows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM estoque_contagens WHERE id_loja = $1',
      [idLoja],
    );
    res.json(
      montarEnvelopeOffset(mapeadas, {
        page: paginacao.page,
        pageSize: paginacao.pageSize,
        total: totalRows[0].total,
      }),
    );
  } catch (e) {
    next(e);
  }
});

/** Retorna a conferência aberta da loja, ou a mais recente. */
router.get('/contagens/atual', permConferencia, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const hoje = hojeISOBrasil();
    const metaBase = { hoje, id_loja: idLoja };

    const { rows: abertas } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE status = 'aberta' AND id_loja = $1
       ORDER BY criado_em DESC, id_contagem DESC
       LIMIT 1`,
      [idLoja],
    );
    if (abertas.length) {
      const detalhe = await carregarContagem(abertas[0].id_contagem);
      return res.json({ ...detalhe, meta: { ...metaBase, iniciada_agora: false } });
    }

    const { rows: ultima } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE id_loja = $1
       ORDER BY COALESCE(finalizado_em, criado_em) DESC, id_contagem DESC
       LIMIT 1`,
      [idLoja],
    );
    if (ultima.length) {
      const detalhe = await carregarContagem(ultima[0].id_contagem);
      return res.json({ ...detalhe, meta: { ...metaBase, iniciada_agora: false } });
    }

    res.json({
      id_contagem: null,
      id_loja: idLoja,
      itens: [],
      meta: { ...metaBase, iniciada_agora: false },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/contagens/:id', permConferencia, async (req, res, next) => {
  try {
    const detalhe = await carregarContagem(Number(req.params.id));
    if (!detalhe) return res.status(404).json({ error: 'Contagem não encontrada' });
    const bloqueio = acessoLoja(req, detalhe.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    res.json(detalhe);
  } catch (e) {
    next(e);
  }
});

router.post('/contagens', permConferencia, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id_loja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const data_contagem = String(req.body?.data_contagem || '').trim() || null;
    const tipo = normalizarTipoContagem(req.body?.tipo);
    const titulo =
      String(req.body?.titulo || '').trim() ||
      tituloConferencia(data_contagem || hojeISOBrasil(), tipo);
    const observacao =
      req.body?.observacao != null ? String(req.body.observacao).trim() || null : null;
    const usarUltimo = req.body?.usar_ultimo_estoque !== false;
    const reutilizarAberta = req.body?.reutilizar_aberta !== false;

    if (reutilizarAberta) {
      const { rows: abertas } = await pool.query(
        `SELECT id_contagem FROM estoque_contagens
         WHERE status = 'aberta' AND id_loja = $1 AND COALESCE(tipo, 'completa') = $2
         ORDER BY criado_em DESC, id_contagem DESC
         LIMIT 1`,
        [id_loja, tipo],
      );
      if (abertas.length) {
        return res.json(await carregarContagem(abertas[0].id_contagem));
      }
    }

    await client.query('BEGIN');
    const idContagem = await criarContagemComItens(client, {
      id_loja,
      data_contagem,
      titulo,
      observacao,
      idUsuario: req.user?.id_usuario || req.user?.sub,
      usarUltimo,
      tipo,
    });
    await client.query('COMMIT');
    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'estoque_contagem',
      idReferencia: idContagem,
      descricao: `Contagem ${tipo} criada (#${idContagem}) loja ${id_loja}`,
    });

    res.status(201).json(await carregarContagem(idContagem));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  } finally {
    client.release();
  }
});

router.post('/contagens/iniciar-sabado', permConferencia, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const hoje = hojeISOBrasil();
    const idUsuario = req.user?.id_usuario || req.user?.sub || null;
    const tipo = normalizarTipoContagem(req.body?.tipo || 'critica_semanal');
    const metaBase = { hoje, id_loja: idLoja, tipo };

    const { rows: abertas } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE status = 'aberta' AND id_loja = $1 AND COALESCE(tipo, 'completa') = $2
       ORDER BY criado_em DESC, id_contagem DESC
       LIMIT 1`,
      [idLoja, tipo],
    );
    if (abertas.length) {
      const detalhe = await carregarContagem(abertas[0].id_contagem);
      return res.json({ ...detalhe, meta: { ...metaBase, iniciada_agora: false } });
    }

    await client.query('BEGIN');
    const idContagem = await criarContagemComItens(client, {
      id_loja: idLoja,
      data_contagem: hoje,
      titulo: tituloConferencia(hoje, tipo),
      observacao: null,
      idUsuario,
      usarUltimo: true,
      tipo,
    });
    await client.query('COMMIT');
    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'estoque_contagem',
      idReferencia: idContagem,
      descricao: `Conferência ${tipo} iniciada (#${idContagem}) loja ${idLoja} em ${hoje}`,
    });
    const detalhe = await carregarContagem(idContagem);
    res.status(201).json({ ...detalhe, meta: { ...metaBase, iniciada_agora: true } });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  } finally {
    client.release();
  }
});

router.put('/contagens/:id/itens', permConferencia, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows: cont } = await pool.query(
      'SELECT id_contagem, id_loja, status FROM estoque_contagens WHERE id_contagem = $1',
      [id],
    );
    if (!cont.length) return res.status(404).json({ error: 'Contagem não encontrada' });
    const bloqueio = acessoLoja(req, cont[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    if (cont[0].status === 'finalizada') {
      return res.status(400).json({ error: 'Contagem finalizada — não pode ser editada' });
    }

    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!itens.length) return res.status(400).json({ error: 'Envie ao menos um item' });

    const { rows: fatoresRows } = await pool.query(
      `SELECT i.id_item, p.und_convertida, COALESCE(p.und_parcial, 1) AS und_parcial,
              COALESCE(p.permite_contagem_caixa, TRUE) AS permite_contagem_caixa,
              COALESCE(p.permite_contagem_pc_fd, TRUE) AS permite_contagem_pc_fd,
              COALESCE(p.permite_contagem_kg_und, TRUE) AS permite_contagem_kg_und
       FROM estoque_itens i
       JOIN insumos p ON p.id_insumo = i.id_insumo
       WHERE i.id_contagem = $1`,
      [id],
    );
    const fatores = new Map(fatoresRows.map((r) => [Number(r.id_item), r]));

    const ids = [];
    const contados = [];
    const caixas = [];
    const pcs = [];
    const kgs = [];
    const sistemas = [];
    let temSistema = false;
    for (const item of itens) {
      const idItem = Number(item.id_item);
      if (!idItem) continue;
      const fat = fatores.get(idItem) || {
        und_convertida: 1,
        und_parcial: 1,
        permite_contagem_caixa: true,
        permite_contagem_pc_fd: true,
        permite_contagem_kg_und: true,
      };
      const permiteCaixa = flagBool(fat.permite_contagem_caixa, true);
      const permitePc = flagBool(fat.permite_contagem_pc_fd, true);
      const permiteKg = flagBool(fat.permite_contagem_kg_und, true);

      const temTerraco =
        item.contagem_caixa !== undefined ||
        item.contagem_pc_fd !== undefined ||
        item.contagem_kg_und !== undefined;

      let caixa = null;
      let pc = null;
      let kg = null;
      let contado = null;

      if (temTerraco) {
        caixa = !permiteCaixa
          ? null
          : item.contagem_caixa === null || item.contagem_caixa === ''
            ? null
            : num(item.contagem_caixa);
        pc = !permitePc
          ? null
          : item.contagem_pc_fd === null || item.contagem_pc_fd === ''
            ? null
            : num(item.contagem_pc_fd);
        kg = !permiteKg
          ? null
          : item.contagem_kg_und === null || item.contagem_kg_und === ''
            ? null
            : num(item.contagem_kg_und);
        contado = calcularQtdContagem({
          contagem_caixa: caixa,
          contagem_pc_fd: pc,
          contagem_kg_und: kg,
          und_convertida: fat.und_convertida,
          und_parcial: fat.und_parcial,
          permite_contagem_caixa: permiteCaixa,
          permite_contagem_pc_fd: permitePc,
          permite_contagem_kg_und: permiteKg,
        });
      } else if (item.estoque_contado !== undefined) {
        // Compat: API antiga com um único campo QTD
        contado =
          item.estoque_contado === null || item.estoque_contado === ''
            ? null
            : num(item.estoque_contado);
        if (contado != null && permiteKg) kg = contado;
      }

      ids.push(idItem);
      contados.push(contado);
      caixas.push(caixa);
      pcs.push(pc);
      kgs.push(kg);
      if (item.estoque_sistema !== undefined) {
        temSistema = true;
        sistemas.push(num(item.estoque_sistema));
      } else {
        sistemas.push(null);
      }
    }

    if (!ids.length) return res.status(400).json({ error: 'Nenhum item válido' });

    if (temSistema) {
      await pool.query(
        `UPDATE estoque_itens AS ei
         SET estoque_contado = v.contado,
             contagem_caixa = v.caixa,
             contagem_pc_fd = v.pc,
             contagem_kg_und = v.kg,
             estoque_sistema = COALESCE(v.sistema, ei.estoque_sistema)
         FROM unnest(
           $1::int[], $2::numeric[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[]
         ) AS v(id_item, contado, caixa, pc, kg, sistema)
         WHERE ei.id_item = v.id_item AND ei.id_contagem = $7`,
        [ids, contados, caixas, pcs, kgs, sistemas, id],
      );
    } else {
      await pool.query(
        `UPDATE estoque_itens AS ei
         SET estoque_contado = v.contado,
             contagem_caixa = v.caixa,
             contagem_pc_fd = v.pc,
             contagem_kg_und = v.kg
         FROM unnest(
           $1::int[], $2::numeric[], $3::numeric[], $4::numeric[], $5::numeric[]
         ) AS v(id_item, contado, caixa, pc, kg)
         WHERE ei.id_item = v.id_item AND ei.id_contagem = $6`,
        [ids, contados, caixas, pcs, kgs, id],
      );
    }

    res.json(await carregarContagem(id));
  } catch (e) {
    next(e);
  }
});

router.post('/contagens/:id/finalizar', permConferencia, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const detalhe = await carregarContagem(id);
    if (!detalhe) return res.status(404).json({ error: 'Contagem não encontrada' });
    const bloqueio = acessoLoja(req, detalhe.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    if (detalhe.status === 'finalizada') {
      return res.status(400).json({ error: 'Contagem já finalizada' });
    }
    if (detalhe.pendentes > 0) {
      return res.status(400).json({
        error: `Ainda há ${detalhe.pendentes} insumo(s) sem contagem. Preencha todos ou informe 0.`,
      });
    }

    const idUsuario = req.user?.id_usuario || req.user?.sub || null;
    await client.query('BEGIN');
    await client.query(
      `UPDATE estoque_contagens
       SET status = 'finalizada', total_valor = $1, finalizado_em = NOW()
       WHERE id_contagem = $2`,
      [detalhe.total_valor, id],
    );
    await ajustarSaldoPorContagem(client, id, idUsuario);
    await client.query('COMMIT');

    await auditar(req, {
      modulo: 'estoque',
      acao: 'finalizar',
      entidade: 'estoque_contagem',
      idReferencia: id,
      descricao: `Contagem #${id} finalizada — total R$ ${detalhe.total_valor}`,
    });

    res.json(await carregarContagem(id));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

/**
 * Reabre conferência finalizada para edição — permissão estoque.conferencia.reabrir.
 * Não reverte saldos já ajustados; ao finalizar de novo o motor recalcula o delta.
 */
router.patch('/contagens/:id/reabrir', permReabrirContagem, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT id_contagem, id_loja, status, titulo, COALESCE(tipo, 'completa') AS tipo
       FROM estoque_contagens WHERE id_contagem = $1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Contagem não encontrada' });
    const cont = rows[0];
    const bloqueio = acessoLoja(req, cont.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    if (cont.status !== 'finalizada') {
      return res.status(400).json({ error: 'Só é possível reabrir contagem finalizada' });
    }

    const { rows: outrasAbertas } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE id_loja = $1 AND status = 'aberta' AND id_contagem <> $2
         AND COALESCE(tipo, 'completa') = $3
       LIMIT 1`,
      [cont.id_loja, id, cont.tipo || 'completa'],
    );
    if (outrasAbertas.length) {
      return res.status(400).json({
        error: `Já existe conferência aberta (#${outrasAbertas[0].id_contagem}). Finalize ou exclua antes de reabrir esta.`,
      });
    }

    await pool.query(
      `UPDATE estoque_contagens
       SET status = 'aberta', finalizado_em = NULL
       WHERE id_contagem = $1`,
      [id],
    );

    await auditar(req, {
      modulo: 'estoque',
      acao: 'reabrir',
      entidade: 'estoque_contagem',
      idReferencia: id,
      descricao: `Contagem #${id} reaberta (${cont.titulo || 'sem título'})`,
    });

    res.json(await carregarContagem(id));
  } catch (e) {
    next(e);
  }
});

router.delete('/contagens/:id', permConferencia, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      'SELECT id_contagem, id_loja, titulo, status FROM estoque_contagens WHERE id_contagem = $1',
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Contagem não encontrada' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    await pool.query('DELETE FROM estoque_contagens WHERE id_contagem = $1', [id]);
    await auditar(req, {
      modulo: 'estoque',
      acao: 'excluir',
      entidade: 'estoque_contagem',
      idReferencia: id,
      descricao: `Contagem #${id} excluída (${rows[0].titulo || rows[0].status})`,
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.get('/resumo', verModulo, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const [{ rows: prod }, { rows: cont }] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE ativo)::int AS ativos
         FROM insumos WHERE id_loja = $1`,
        [idLoja],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'aberta')::int AS abertas,
                COUNT(*) FILTER (WHERE status = 'finalizada')::int AS finalizadas
         FROM estoque_contagens WHERE id_loja = $1`,
        [idLoja],
      ),
    ]);
    res.json({
      id_loja: idLoja,
      insumos: prod[0],
      produtos: prod[0], // alias de transição
      contagens: cont[0],
    });
  } catch (e) {
    next(e);
  }
});

export default router;
