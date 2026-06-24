import { Router } from 'express';
import { listarAuditoria } from '../services/auditoria.js';
import { requirePermissao } from '../permissoes.js';

const router = Router();

router.get('/eventos', requirePermissao('configuracoes.auditoria'), async (req, res, next) => {
  try {
    const { limite, offset, modulo } = req.query;
    const eventos = await listarAuditoria({ limite, offset, modulo });
    res.json(eventos);
  } catch (e) {
    next(e);
  }
});

export default router;
