import { Router } from 'express';
import { listarAuditoria } from '../services/auditoria.js';
import { requirePermissao } from '../permissoes.js';
import { pool } from '../db.js';

const router = Router();

router.get('/eventos', requirePermissao('configuracoes.auditoria'), async (req, res, next) => {
  try {
    const { limite, offset, modulo, id_usuario, q } = req.query;
    const eventos = await listarAuditoria({
      limite,
      offset,
      modulo,
      idUsuario: id_usuario,
      q,
    });
    res.json(eventos);
  } catch (e) {
    next(e);
  }
});

/** Lista enxuta de usuários para filtro da tela de auditoria. */
router.get('/usuarios-filtro', requirePermissao('configuracoes.auditoria'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_usuario, nome, email, ativo
       FROM usuarios
       ORDER BY ativo DESC, nome ASC
       LIMIT 500`,
    );
    res.json(
      rows.map((u) => ({
        id_usuario: u.id_usuario,
        nome: u.nome,
        email: u.email,
        ativo: u.ativo,
      })),
    );
  } catch (e) {
    next(e);
  }
});

export default router;
