/**
 * Relatório legível da saúde da baixa (portal).
 * Linguagem operacional — sem jargão de piloto/fator.
 */
import { pool } from '../db.js';

export const MOTIVO_PT = {
  INSUMO_NAO_CADASTRADO: {
    problema: 'Insumo sem cadastro ativo na loja',
    acao: 'Ativar o insumo, cadastrar, ou criar alias do código da ficha → código Meridian',
  },
  CONVERSAO_NAO_VALIDADA: {
    problema: 'Falta fator de conversão (unidade da ficha ≠ unidade do estoque)',
    acao: 'Cadastrar e validar o fator (ex.: 1 und = X kg)',
  },
  CONVERSAO_BLOQUEADA: {
    problema: 'Conversão bloqueada de propósito',
    acao: 'Revisar o bloqueio no cadastro de conversões',
  },
  QUANTIDADE_INVALIDA: {
    problema: 'Quantidade inválida na ficha/venda',
    acao: 'Corrigir quantidade na ficha ou na venda',
  },
  FORA_PILOTO: {
    problema: 'Ignorado pelo piloto antigo',
    acao: 'Piloto já está desligado — se ainda aparecer, atualizar a página',
  },
};

async function janelaObservacao(client = pool) {
  try {
    const { rows } = await client.query(`
      SELECT id, iniciado_em, previsto_fim, observacao
      FROM estoque_observacao_baixa
      WHERE ativo = TRUE
      ORDER BY id DESC LIMIT 1
    `);
    if (rows[0]) return rows[0];
  } catch (e) {
    if (e.code !== '42P01') throw e;
  }
  return {
    id: null,
    iniciado_em: new Date(Date.now() - 7 * 864e5),
    previsto_fim: null,
    observacao: 'Últimos 7 dias',
  };
}

/**
 * @param {{ id_loja?: number|null, escopo?: 'loja'|'rede' }} opts
 */
export async function montarSaudeBaixa(opts = {}) {
  const escopo = opts.escopo === 'rede' ? 'rede' : 'loja';
  const idLoja = opts.id_loja != null ? Number(opts.id_loja) : null;
  if (escopo === 'loja' && !idLoja) {
    const err = new Error('id_loja obrigatório');
    err.status = 400;
    throw err;
  }

  const janela = await janelaObservacao();
  const desde = janela.iniciado_em;

  const filtroLojaVenda = escopo === 'loja' ? 'AND v.id_loja = $2' : '';
  const filtroLojaPend = escopo === 'loja' ? 'AND p.id_loja = $2' : '';
  const paramsVenda = escopo === 'loja' ? [desde, idLoja] : [desde];
  const paramsPend = paramsVenda;

  const { rows: vendasRows } = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'processada')::int AS processada,
      COUNT(*) FILTER (WHERE status = 'parcial')::int AS parcial,
      COUNT(*) FILTER (WHERE status = 'erro')::int AS erro,
      COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendente
    FROM estoque_vendas v
    WHERE v.data_venda >= ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
      ${filtroLojaVenda}
  `,
    paramsVenda,
  );

  const { rows: semFichaRows } = await pool.query(
    `
    SELECT COUNT(*)::int AS n
    FROM estoque_venda_itens vi
    JOIN estoque_vendas v ON v.id_venda = vi.id_venda
    WHERE v.data_venda >= ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
      AND vi.sem_ficha = TRUE
      ${filtroLojaVenda}
  `,
    paramsVenda,
  );

  const { rows: motivos } = await pool.query(
    `
    SELECT p.motivo, COUNT(*)::int AS n, COUNT(DISTINCT p.codigo_insumo)::int AS skus
    FROM estoque_baixa_pendencias p
    WHERE p.criado_em >= $1
      ${filtroLojaPend}
    GROUP BY p.motivo
    ORDER BY n DESC
  `,
    paramsPend,
  );

  const { rows: topProblemas } = await pool.query(
    `
    SELECT
      p.codigo_insumo AS codigo,
      p.motivo,
      COALESCE(
        MAX(i.descricao) FILTER (WHERE i.descricao IS NOT NULL),
        MAX(fi.observacao),
        '(sem nome)'
      ) AS nome,
      COUNT(*)::int AS vezes,
      COUNT(DISTINCT p.id_loja)::int AS lojas,
      MAX(p.unidade_receita) AS unidade_receita,
      MAX(p.unidade_estoque) AS unidade_estoque,
      MAX(p.criado_em) AS ultima_vez
    FROM estoque_baixa_pendencias p
    LEFT JOIN insumos i ON i.id_insumo = p.id_insumo
    LEFT JOIN LATERAL (
      SELECT observacao FROM ficha_tecnica_itens
      WHERE codigo_insumo = p.codigo_insumo
      LIMIT 1
    ) fi ON TRUE
    WHERE p.criado_em >= $1
      ${filtroLojaPend}
    GROUP BY p.codigo_insumo, p.motivo
    ORDER BY vezes DESC
    LIMIT 50
  `,
    paramsPend,
  );

  const { rows: vendasProblema } = await pool.query(
    `
    SELECT
      v.id_venda,
      v.id_loja,
      v.data_venda,
      v.status,
      (
        SELECT string_agg(DISTINCT LEFT(vi.erro, 80), ' · ')
        FROM estoque_venda_itens vi
        WHERE vi.id_venda = v.id_venda AND vi.erro IS NOT NULL
      ) AS erros
    FROM estoque_vendas v
    WHERE v.data_venda >= ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
      AND v.status IN ('parcial', 'erro')
      ${filtroLojaVenda}
    ORDER BY v.data_venda DESC, v.id_venda DESC
    LIMIT 40
  `,
    paramsVenda,
  );

  let pilotoOff = true;
  if (escopo === 'loja') {
    const { rows } = await pool.query(
      `SELECT COALESCE(piloto_baixa, TRUE) AS piloto FROM lojas_estoque_perfil WHERE id_loja = $1`,
      [idLoja],
    );
    pilotoOff = rows[0] ? rows[0].piloto === false : false;
  } else {
    const { rows } = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE piloto_baixa = FALSE)::int AS off,
             COUNT(*)::int AS total
      FROM lojas_estoque_perfil
    `);
    pilotoOff = rows[0]?.off === rows[0]?.total;
  }

  const v = vendasRows[0] || {
    total: 0,
    processada: 0,
    parcial: 0,
    erro: 0,
    pendente: 0,
  };
  const taxa =
    v.total > 0 ? Math.round((1000 * v.processada) / v.total) / 10 : null;

  const problemas = topProblemas.map((r) => {
    const info = MOTIVO_PT[r.motivo] || {
      problema: r.motivo,
      acao: 'Investigar com o time técnico',
    };
    return {
      codigo: r.codigo,
      nome: r.nome,
      motivo: r.motivo,
      problema: info.problema,
      o_que_fazer: info.acao,
      vezes: r.vezes,
      lojas: r.lojas,
      unidade_receita: r.unidade_receita,
      unidade_estoque: r.unidade_estoque,
      ultima_vez: r.ultima_vez,
    };
  });

  return {
    escopo,
    id_loja: escopo === 'loja' ? idLoja : null,
    gerado_em: new Date().toISOString(),
    janela: {
      desde: janela.iniciado_em,
      previsto_fim: janela.previsto_fim,
      observacao: janela.observacao,
    },
    piloto_desligado: pilotoOff,
    resumo: {
      ...v,
      taxa_processada_pct: taxa,
      sem_ficha: semFichaRows[0]?.n || 0,
      pendencias: motivos.reduce((s, m) => s + Number(m.n), 0),
    },
    motivos: motivos.map((m) => ({
      motivo: m.motivo,
      problema: (MOTIVO_PT[m.motivo] || {}).problema || m.motivo,
      n: m.n,
      skus: m.skus,
    })),
    problemas,
    vendas_com_problema: vendasProblema,
  };
}

export function linhasExcelSaudeBaixa(data) {
  const resumo = [
    { Campo: 'Escopo', Valor: data.escopo === 'rede' ? 'Rede inteira' : `Loja ${data.id_loja}` },
    { Campo: 'Gerado em', Valor: data.gerado_em },
    { Campo: 'Desde', Valor: data.janela?.desde },
    { Campo: 'Revisão', Valor: data.janela?.previsto_fim },
    { Campo: 'Piloto desligado', Valor: data.piloto_desligado ? 'Sim' : 'Não' },
    { Campo: 'Vendas processadas (OK)', Valor: data.resumo.processada },
    { Campo: 'Vendas parciais (problema)', Valor: data.resumo.parcial },
    { Campo: 'Vendas com erro', Valor: data.resumo.erro },
    { Campo: 'Taxa OK %', Valor: data.resumo.taxa_processada_pct },
    { Campo: 'Itens sem ficha', Valor: data.resumo.sem_ficha },
    { Campo: 'Pendências (falhas)', Valor: data.resumo.pendencias },
  ];

  const problemas = (data.problemas || []).map((p) => ({
    Código: p.codigo,
    Nome: p.nome,
    Problema: p.problema,
    'O que fazer': p.o_que_fazer,
    Vezes: p.vezes,
    Lojas: p.lojas,
    'Unidade ficha': p.unidade_receita || '',
    'Unidade estoque': p.unidade_estoque || '',
    'Última vez': p.ultima_vez,
  }));

  const vendas = (data.vendas_com_problema || []).map((v) => ({
    'ID venda': v.id_venda,
    Loja: v.id_loja,
    Data: v.data_venda,
    Status: v.status,
    Erros: v.erros || '',
  }));

  return { resumo, problemas, vendas };
}
