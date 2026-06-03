import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const cats = await pool.query(
      'SELECT * FROM categorias_checklist ORDER BY ordem'
    );
    const perguntas = await pool.query(
      'SELECT * FROM perguntas ORDER BY id_categoria, ordem'
    );
    const grouped = cats.rows.map((c) => ({
      ...c,
      perguntas: perguntas.rows.filter((p) => p.id_categoria === c.id_categoria),
    }));
    res.json(grouped);
  } catch (e) {
    next(e);
  }
});

export default router;
