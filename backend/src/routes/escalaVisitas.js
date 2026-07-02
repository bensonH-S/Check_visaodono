import { Router } from 'express';
import {
  carregarGradeVisitas,
  copiarSemanaVisitas,
  listarSemanasVisitas,
  podeVerEscalaVisitas,
  salvarGradeVisitas,
  segundaFeiraDaSemana,
} from '../escalaVisitas.js';

const router = Router();

router.get('/semana', async (req, res, next) => {
  try {
    if (!podeVerEscalaVisitas(req.user)) {
      return res.status(403).json({ error: 'Sem permissão para ver a escala de visitas' });
    }
    const semana_inicio = req.query.semana_inicio
      ? segundaFeiraDaSemana(String(req.query.semana_inicio))
      : segundaFeiraDaSemana(new Date());
    const id_regiao = req.query.id_regiao ? Number(req.query.id_regiao) : null;
    const grade = await carregarGradeVisitas(req.user, { semana_inicio, id_regiao });
    res.json(grade);
  } catch (e) {
    if (e.message.includes('Sem permissão') || e.message.includes('Sem acesso')) {
      return res.status(403).json({ error: e.message });
    }
    if (e.message.includes('Data inválida')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

router.put('/semana', async (req, res, next) => {
  try {
    const grade = await salvarGradeVisitas(req.user, req.body || {});
    res.json(grade);
  } catch (e) {
    if (e.message.includes('Sem permissão')) {
      return res.status(403).json({ error: e.message });
    }
    next(e);
  }
});

router.post('/semana/copiar', async (req, res, next) => {
  try {
    const { de, para } = req.body || {};
    if (!de || !para) {
      return res.status(400).json({ error: 'Informe as semanas de origem (de) e destino (para)' });
    }
    const grade = await copiarSemanaVisitas(req.user, { de, para });
    res.json(grade);
  } catch (e) {
    if (e.message.includes('Sem permissão')) {
      return res.status(403).json({ error: e.message });
    }
    if (e.message.includes('Semanas iguais')) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

router.get('/semanas', async (req, res, next) => {
  try {
    const semanas = await listarSemanasVisitas(req.user);
    res.json(semanas);
  } catch (e) {
    if (e.message.includes('Sem permissão')) {
      return res.status(403).json({ error: e.message });
    }
    next(e);
  }
});

export default router;
