import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { loja, status } = req.query;
    let q = `
      SELECT v.*, l.name, l.bk_number, u.nome AS nome_usuario,
        (SELECT COUNT(*)::int FROM nao_conformidades nc
         WHERE nc.id_visita = v.id_visita AND nc.status = 'Em aberto') AS nc_abertas
      FROM visitas v
      JOIN lojas l ON l.id_loja = v.id_loja
      JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE 1=1
    `;
    const params = [];
    if (loja) {
      params.push(loja);
      q += ` AND v.id_loja = $${params.length}`;
    }
    if (status) {
      params.push(status);
      q += ` AND v.status = $${params.length}::status_visita`;
    }
    q += ' ORDER BY v.data_visita DESC, v.id_visita DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const visita = await pool.query(
      `SELECT v.*, l.name, l.bk_number, l.city, l.neighborhood, u.nome AS nome_usuario
       FROM visitas v
       JOIN lojas l ON l.id_loja = v.id_loja
       JOIN usuarios u ON u.id_usuario = v.id_usuario
       WHERE v.id_visita = $1`,
      [req.params.id]
    );
    if (!visita.rows[0]) return res.status(404).json({ error: 'Visita não encontrada' });

    const respostas = await pool.query(
      `SELECT r.*, p.texto, p.id_categoria, c.nome AS categoria
       FROM respostas r
       JOIN perguntas p ON p.id_pergunta = r.id_pergunta
       JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
       WHERE r.id_visita = $1
       ORDER BY c.ordem, p.ordem`,
      [req.params.id]
    );

    const porCategoria = await pool.query(
      `SELECT c.nome AS categoria,
        ROUND(AVG(
          CASE r.resposta WHEN 'Sim' THEN 100 WHEN 'Não' THEN 0 ELSE 50 END
          * p.peso
        )::numeric, 0) AS percentual
       FROM respostas r
       JOIN perguntas p ON p.id_pergunta = r.id_pergunta
       JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
       WHERE r.id_visita = $1
       GROUP BY c.id_categoria, c.nome, c.ordem
       ORDER BY c.ordem`,
      [req.params.id]
    );

    const ncs = await pool.query(
      `SELECT * FROM nao_conformidades WHERE id_visita = $1 ORDER BY data_cadastro DESC`,
      [req.params.id]
    );

    const historico = await pool.query(
      `SELECT nota, data_registro FROM historico_notas
       WHERE id_loja = $1 ORDER BY data_registro DESC LIMIT 2`,
      [visita.rows[0].id_loja]
    );

    res.json({
      visita: visita.rows[0],
      respostas: respostas.rows,
      desempenho_categorias: porCategoria.rows,
      nao_conformidades: ncs.rows,
      historico_notas: historico.rows,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id_loja, id_usuario, data_visita, hora_inicio } = req.body;
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO visitas (id_loja, id_usuario, data_visita, hora_inicio, status)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, 'Rascunho')
       RETURNING *`,
      [id_loja, id_usuario, data_visita, hora_inicio]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.post('/:id/respostas', async (req, res, next) => {
  try {
    const { respostas } = req.body;
    if (!Array.isArray(respostas) || !respostas.length) {
      return res.status(400).json({ error: 'Lista de respostas obrigatória' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of respostas) {
        await client.query(
          `INSERT INTO respostas (id_visita, id_pergunta, resposta, observacao, foto_url)
           VALUES ($1, $2, $3::resposta_checklist, $4, $5)
           ON CONFLICT (id_visita, id_pergunta)
           DO UPDATE SET resposta = EXCLUDED.resposta,
             observacao = EXCLUDED.observacao,
             foto_url = EXCLUDED.foto_url`,
          [req.params.id, r.id_pergunta, r.resposta, r.observacao || null, r.foto_url || null]
        );
      }
      await client.query('COMMIT');
      const detail = await pool.query('SELECT * FROM visitas WHERE id_visita = $1', [
        req.params.id,
      ]);
      res.json(detail.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/finalizar', async (req, res, next) => {
  try {
    const { hora_fim, duracao_minutos, observacoes_gerais } = req.body;
    const { rows } = await pool.query(
      `UPDATE visitas SET
         status = 'Finalizada',
         hora_fim = COALESCE($2, hora_fim),
         duracao_minutos = COALESCE($3, duracao_minutos),
         observacoes_gerais = COALESCE($4, observacoes_gerais),
         updated_at = NOW()
       WHERE id_visita = $1
       RETURNING *`,
      [req.params.id, hora_fim, duracao_minutos, observacoes_gerais]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Visita não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
