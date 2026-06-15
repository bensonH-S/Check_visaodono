import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vw_metricas_dashboard LIMIT 1');
    const metricas = rows[0] || {};

    const ranking = await pool.query(`
      SELECT * FROM vw_ranking_lojas ORDER BY posicao_ranking LIMIT 5
    `);

    const ncs = await pool.query(`
      SELECT nc.*, l.name
      FROM nao_conformidades nc
      JOIN lojas l ON l.id_loja = nc.id_loja
      WHERE nc.status = 'Em aberto'
      ORDER BY
        CASE nc.gravidade WHEN 'Crítica' THEN 1 WHEN 'Moderada' THEN 2 ELSE 3 END,
        nc.data_cadastro DESC
      LIMIT 5
    `);

    const ncsGravidade = await pool.query(`
      SELECT gravidade, COUNT(*)::int AS total
      FROM nao_conformidades
      WHERE status = 'Em aberto'
      GROUP BY gravidade
      ORDER BY CASE gravidade WHEN 'Crítica' THEN 1 WHEN 'Moderada' THEN 2 ELSE 3 END
    `);

    res.json({
      metricas: {
        media_geral: Number(metricas.media_geral) || 0,
        visitas_mes: Number(metricas.visitas_mes) || 0,
        total_ncs_abertas: Number(metricas.total_ncs_abertas) || 0,
        ncs_criticas: Number(metricas.ncs_criticas) || 0,
        lojas_abaixo_75: Number(metricas.lojas_abaixo_75) || 0,
        lojas_ativas: Number(metricas.lojas_ativas) || 0,
      },
      ranking: ranking.rows,
      ncs_recentes: ncs.rows,
      ncs_por_gravidade: ncsGravidade.rows,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/ranking', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*,
        hn.nota AS nota_anterior
      FROM vw_ranking_lojas r
      LEFT JOIN LATERAL (
        SELECT nota FROM historico_notas h
        WHERE h.id_loja = r.id_loja
        ORDER BY data_registro DESC
        OFFSET 1 LIMIT 1
      ) hn ON TRUE
      ORDER BY r.posicao_ranking
    `);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
