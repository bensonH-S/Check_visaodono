import { Router } from 'express';
import {
  carregarMetasPeriodo,
  listarPeriodosMetas,
  podeVerMetas,
  salvarPremioMetas,
  salvarRankingMetas,
  salvarRealizadoMetas,
} from '../metas.js';

const router = Router();

router.get('/periodos', async (req, res, next) => {
  try {
    if (!podeVerMetas(req.user)) {
      return res.status(403).json({ error: 'Sem permissão para ver metas' });
    }
    const periodos = await listarPeriodosMetas();
    res.json(periodos);
  } catch (e) {
    next(e);
  }
});

router.get('/periodos/:id', async (req, res, next) => {
  try {
    const data = await carregarMetasPeriodo(Number(req.params.id), req.user);
    res.json(data);
  } catch (e) {
    if (e.message.includes('Sem permissão') || e.message.includes('não encontrado')) {
      return res.status(e.message.includes('Sem permissão') ? 403 : 404).json({ error: e.message });
    }
    next(e);
  }
});

router.put('/realizados', async (req, res, next) => {
  try {
    const row = await salvarRealizadoMetas(req.user, req.body || {});
    res.json(row);
  } catch (e) {
    if (e.message.includes('Sem permissão')) {
      return res.status(403).json({ error: e.message });
    }
    next(e);
  }
});

router.put('/rankings', async (req, res, next) => {
  try {
    const row = await salvarRankingMetas(req.user, req.body || {});
    res.json(row);
  } catch (e) {
    if (e.message.includes('Sem permissão') || e.message.includes('não encontrado')) {
      return res.status(e.message.includes('Sem permissão') ? 403 : 404).json({ error: e.message });
    }
    next(e);
  }
});

router.put('/premios', async (req, res, next) => {
  try {
    const row = await salvarPremioMetas(req.user, req.body || {});
    res.json(row);
  } catch (e) {
    if (e.message.includes('Sem permissão') || e.message.includes('não encontrado')) {
      return res.status(e.message.includes('Sem permissão') ? 403 : 404).json({ error: e.message });
    }
    next(e);
  }
});

export default router;
