import { pool } from '../db.js';
import { SQL_PONTUACAO_RESPOSTA } from '../checklistPontuacao.js';

function dataVisitaIso(val) {
  if (val == null) return val;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function serializarVisita(row) {
  if (!row) return row;
  const meta = row.meta_visita && typeof row.meta_visita === 'object' ? row.meta_visita : {};
  return {
    ...row,
    data_visita: dataVisitaIso(row.data_visita),
    meta_visita: meta,
  };
}

/** Carrega detalhe completo da visita (inclui foto_url nas respostas para PDF). */
export async function carregarVisitaDetalhe(idVisita) {
  const visita = await pool.query(
    `SELECT v.*, l.name, l.bk_number, l.city, l.neighborhood, l.state, u.nome AS nome_usuario,
            tc.codigo AS tipo_checklist_codigo, tc.nome AS tipo_checklist_nome
     FROM visitas v
     JOIN lojas l ON l.id_loja = v.id_loja
     JOIN usuarios u ON u.id_usuario = v.id_usuario
     LEFT JOIN tipos_checklist tc ON tc.id_tipo_checklist = v.id_tipo_checklist
     WHERE v.id_visita = $1`,
    [idVisita],
  );
  if (!visita.rows[0]) return null;

  const respostas = await pool.query(
    `SELECT r.*, p.codigo, p.texto, p.tipo_resposta, p.sim_indica_problema, p.id_categoria,
            c.nome AS categoria
     FROM respostas r
     JOIN perguntas p ON p.id_pergunta = r.id_pergunta
     JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
     WHERE r.id_visita = $1
     ORDER BY c.ordem, p.ordem`,
    [idVisita],
  );

  const porCategoria = await pool.query(
    `SELECT c.nome AS categoria,
        COALESCE(ROUND(AVG(
          (${SQL_PONTUACAO_RESPOSTA}) * p.peso
        )::numeric, 0), 0) AS percentual
       FROM respostas r
       JOIN perguntas p ON p.id_pergunta = r.id_pergunta
       JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
       WHERE r.id_visita = $1
       GROUP BY c.id_categoria, c.nome, c.ordem
       ORDER BY c.ordem`,
    [idVisita],
  );

  const ncs = await pool.query(
    `SELECT descricao, gravidade, area FROM nao_conformidades WHERE id_visita = $1 ORDER BY data_cadastro DESC`,
    [idVisita],
  );

  const historico = await pool.query(
    `SELECT nota, data_registro FROM historico_notas
     WHERE id_loja = $1 ORDER BY data_registro DESC LIMIT 2`,
    [visita.rows[0].id_loja],
  );

  return {
    visita: serializarVisita(visita.rows[0]),
    respostas: respostas.rows,
    desempenho_categorias: porCategoria.rows,
    nao_conformidades: ncs.rows,
    historico_notas: historico.rows,
  };
}
