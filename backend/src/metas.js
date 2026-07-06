import { pool } from './db.js';
import { temPermissao } from './permissoes.js';

export function podeGerenciarMetas(user) {
  return temPermissao(user, 'metas.gerenciar');
}

export function podeVerMetas(user) {
  return podeGerenciarMetas(user) || temPermissao(user, 'metas.ver');
}

export async function listarPeriodosMetas() {
  const { rows } = await pool.query(
    `SELECT id_periodo, ano, mes, titulo, observacao, criado_em
     FROM metas_periodos
     ORDER BY ano DESC, mes DESC`,
  );
  return rows;
}

async function carregarPaineis(idPeriodo) {
  const { rows: paineis } = await pool.query(
    `SELECT id_painel, codigo, titulo, tipo, ordem
     FROM metas_paineis
     WHERE id_periodo = $1
     ORDER BY ordem, id_painel`,
    [idPeriodo],
  );

  const resultado = [];
  for (const painel of paineis) {
    const [indicadores, lojas, realizados] = await Promise.all([
      pool.query(
        `SELECT i.id_indicador, i.codigo, i.nome, i.tipo_valor, pi.peso, pi.ordem
         FROM metas_painel_indicadores pi
         JOIN metas_indicadores i ON i.id_indicador = pi.id_indicador
         WHERE pi.id_painel = $1
         ORDER BY pi.ordem, i.nome`,
        [painel.id_painel],
      ),
      pool.query(
        `SELECT pl.id_loja, pl.rotulo_curto, pl.ordem, l.name AS nome_loja, l.bk_number
         FROM metas_painel_lojas pl
         JOIN lojas l ON l.id_loja = pl.id_loja
         WHERE pl.id_painel = $1
         ORDER BY pl.ordem, l.name`,
        [painel.id_painel],
      ),
      pool.query(
        `SELECT r.id_indicador, r.id_loja, r.valor_texto, r.valor_numero, r.atingiu, r.pontos_obtidos
         FROM metas_realizados r
         WHERE r.id_painel = $1`,
        [painel.id_painel],
      ),
    ]);

    const mapRealizado = new Map();
    for (const r of realizados.rows) {
      mapRealizado.set(`${r.id_indicador}-${r.id_loja ?? 'null'}`, r);
    }

    let subtotalPeso = 0;
    const linhasIndicadores = indicadores.rows.map((ind) => {
      subtotalPeso += Number(ind.peso) || 0;
      const celulas = lojas.rows.map((loja) => {
        const key = `${ind.id_indicador}-${loja.id_loja}`;
        const real = mapRealizado.get(key);
        return {
          id_loja: loja.id_loja,
          rotulo_curto: loja.rotulo_curto,
          nome_loja: loja.nome_loja,
          bk_number: loja.bk_number,
          valor_texto: real?.valor_texto ?? null,
          valor_numero: real?.valor_numero != null ? Number(real.valor_numero) : null,
          atingiu: real?.atingiu ?? null,
          pontos_obtidos: real?.pontos_obtidos ?? null,
        };
      });
      return {
        id_indicador: ind.id_indicador,
        codigo: ind.codigo,
        nome: ind.nome,
        peso: ind.peso,
        tipo_valor: ind.tipo_valor,
        celulas,
      };
    });

    resultado.push({
      ...painel,
      subtotal_peso: subtotalPeso,
      lojas: lojas.rows,
      indicadores: linhasIndicadores,
    });
  }
  return resultado;
}

async function carregarRankings(idPeriodo) {
  const { rows: indicadores } = await pool.query(
    `SELECT DISTINCT i.id_indicador, i.codigo, i.nome, i.meta_minima, i.ordem
     FROM metas_rankings r
     JOIN metas_indicadores i ON i.id_indicador = r.id_indicador
     WHERE r.id_periodo = $1
     ORDER BY i.ordem, i.nome`,
    [idPeriodo],
  );

  const grupos = [];
  for (const ind of indicadores) {
    const { rows } = await pool.query(
      `SELECT r.posicao, r.valor_numero, r.valor_texto, r.pontos, r.classe, r.destaque,
              r.nome_gestor, r.id_gestor, r.nome_loja_planilha, r.ordem_linha,
              l.id_loja, l.name AS nome_loja, l.bk_number,
              u.nome AS gestor_cadastro
       FROM metas_rankings r
       LEFT JOIN lojas l ON l.id_loja = r.id_loja
       LEFT JOIN usuarios u ON u.id_usuario = r.id_gestor
       WHERE r.id_periodo = $1 AND r.id_indicador = $2
       ORDER BY COALESCE(r.ordem_linha, 9999), COALESCE(r.posicao, 9999), r.id_ranking`,
      [idPeriodo, ind.id_indicador],
    );
    grupos.push({
      id_indicador: ind.id_indicador,
      codigo: ind.codigo,
      nome: ind.nome,
      meta_minima: ind.meta_minima != null ? Number(ind.meta_minima) : null,
      linhas: rows.map((row) => ({
        posicao: row.posicao,
        ordem_linha: row.ordem_linha,
        id_loja: row.id_loja,
        nome_loja: row.nome_loja || row.nome_loja_planilha,
        bk_number: row.bk_number,
        valor_numero: row.valor_numero != null ? Number(row.valor_numero) : null,
        valor_texto: row.valor_texto,
        pontos: row.pontos,
        classe: row.classe,
        destaque: row.destaque,
        nome_gestor: row.nome_gestor || row.gestor_cadastro,
      })),
    });
  }
  return grupos;
}

async function carregarPremios(idPeriodo) {
  const { rows } = await pool.query(
    `SELECT p.*, u.nome AS nome_usuario
     FROM metas_premios p
     LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
     WHERE p.id_periodo = $1
     ORDER BY p.nome`,
    [idPeriodo],
  );
  return rows.map((r) => ({
    id_premio: r.id_premio,
    id_usuario: r.id_usuario,
    nome: r.nome,
    premio_saude: r.premio_saude,
    premio_rev: r.premio_rev,
    valor_unitario: r.valor_unitario != null ? Number(r.valor_unitario) : null,
    subtotal: r.subtotal != null ? Number(r.subtotal) : null,
    total: r.total != null ? Number(r.total) : null,
    observacao: r.observacao,
  }));
}

export async function carregarMetasPeriodo(idPeriodo, user) {
  if (!podeVerMetas(user)) throw new Error('Sem permissão');

  const { rows } = await pool.query(
    `SELECT id_periodo, ano, mes, titulo, observacao
     FROM metas_periodos WHERE id_periodo = $1`,
    [idPeriodo],
  );
  if (!rows[0]) throw new Error('Período não encontrado');

  const [paineis, rankings, premios] = await Promise.all([
    carregarPaineis(idPeriodo),
    carregarRankings(idPeriodo),
    carregarPremios(idPeriodo),
  ]);

  return {
    periodo: rows[0],
    pode_editar: podeGerenciarMetas(user),
    paineis,
    rankings,
    premios,
  };
}

export async function salvarRealizadoMetas(user, { id_painel, id_indicador, id_loja, valor_texto, valor_numero, atingiu, pontos_obtidos }) {
  if (!podeGerenciarMetas(user)) throw new Error('Sem permissão para editar');

  const { rows: painel } = await pool.query(
    `SELECT id_periodo FROM metas_paineis WHERE id_painel = $1`,
    [id_painel],
  );
  if (!painel[0]) throw new Error('Painel não encontrado');

  const { rows } = await pool.query(
    `INSERT INTO metas_realizados (id_periodo, id_painel, id_indicador, id_loja, valor_texto, valor_numero, atingiu, pontos_obtidos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id_painel, id_indicador, id_loja) DO UPDATE SET
       valor_texto = EXCLUDED.valor_texto,
       valor_numero = EXCLUDED.valor_numero,
       atingiu = EXCLUDED.atingiu,
       pontos_obtidos = EXCLUDED.pontos_obtidos
     RETURNING *`,
    [
      painel[0].id_periodo,
      id_painel,
      id_indicador,
      id_loja || null,
      valor_texto ?? null,
      valor_numero ?? null,
      atingiu ?? null,
      pontos_obtidos ?? null,
    ],
  );
  return rows[0];
}
