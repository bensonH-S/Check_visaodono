import { Router } from 'express';
import {
  listarNotificacoesPortal,
  marcarLida,
  marcarTodasLidas,
} from '../services/portalNotificacoes.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await listarNotificacoesPortal(req.user));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/lida', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (String(id).startsWith('pag-')) {
      return res.json({ ok: true });
    }
    await marcarLida(req.user.sub, id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post('/lidas', async (req, res, next) => {
  try {
    await marcarTodasLidas(req.user.sub);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
