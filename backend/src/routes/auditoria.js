import { Router } from 'express';
import { pool } from '../db.js';
import { listarAuditoria } from '../services/auditoria.js';

const router = Router();

const CARGOS_AUDITORIA = new Set(['administrador', 'ceo', 'diretor']);

async function requireCargoAuditoria(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(u.cargo_aprovacao, u.perfil::text) AS cargo
       FROM usuarios u WHERE u.id_usuario = $1 AND u.ativo = TRUE`,
      [req.user.sub],
    );
    const cargo = String(rows[0]?.cargo || '').toLowerCase();
    if (CARGOS_AUDITORIA.has(cargo)) return next();
    return res.status(403).json({ error: 'Sem permissão para auditoria do sistema' });
  } catch (e) {
    next(e);
  }
}

router.get('/eventos', requireCargoAuditoria, async (req, res, next) => {
  try {
    const { limite, offset, modulo } = req.query;
    const eventos = await listarAuditoria({ limite, offset, modulo });
    res.json(eventos);
  } catch (e) {
    next(e);
  }
});

export default router;
