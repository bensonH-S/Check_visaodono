import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_usuario, nome, email, cargo, avatar_inicial, ativo
       FROM usuarios WHERE ativo = TRUE ORDER BY nome`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
