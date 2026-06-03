import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { status, loja } = req.query;
    let q = `
      SELECT nc.*, l.name
      FROM nao_conformidades nc
      JOIN lojas l ON l.id_loja = nc.id_loja
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      params.push(status);
      q += ` AND nc.status = $${params.length}::status_nc`;
    }
    if (loja) {
      params.push(loja);
      q += ` AND nc.id_loja = $${params.length}`;
    }
    q += ' ORDER BY nc.data_cadastro DESC, nc.id_nc DESC';
    const { rows } = await pool.query(q, params);

    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Em aberto') AS total_aberto,
        COUNT(*) FILTER (WHERE status = 'Em aberto' AND gravidade = 'Crítica') AS criticas
      FROM nao_conformidades
    `);

    res.json({ items: rows, stats: stats.rows[0] });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      id_loja,
      id_visita,
      area,
      descricao,
      gravidade,
      prazo_resolucao,
      responsavel,
    } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO nao_conformidades
        (id_loja, id_visita, area, descricao, gravidade, prazo_resolucao, responsavel)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'Moderada')::gravidade_nc, $6, $7)
       RETURNING *`,
      [id_loja, id_visita, area, descricao, gravidade, prazo_resolucao, responsavel]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { status, gravidade, responsavel, prazo_resolucao } = req.body;
    const { rows } = await pool.query(
      `UPDATE nao_conformidades SET
         status = COALESCE($2::status_nc, status),
         gravidade = COALESCE($3::gravidade_nc, gravidade),
         responsavel = COALESCE($4, responsavel),
         prazo_resolucao = COALESCE($5, prazo_resolucao)
       WHERE id_nc = $1 RETURNING *`,
      [req.params.id, status, gravidade, responsavel, prazo_resolucao]
    );
    if (!rows[0]) return res.status(404).json({ error: 'NC não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
