import { Router } from 'express';
import {
  carregarGradeVisitas,
  copiarSemanaVisitas,
  listarSemanasVisitas,
  podeVerEscalaVisitas,
  salvarGradeVisitas,
  segundaFeiraDaSemana,
} from '../escalaVisitas.js';
import { auditar } from '../auditoriaHelpers.js';

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
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    const regiao = grade?.regiao?.nome || grade?.id_regiao || req.body?.id_regiao || '';
    await auditar(req, {
      modulo: 'escalas',
      acao: 'salvar_escala',
      entidade: 'escala_visitas',
      idReferencia: semana,
      descricao: `Salvou a escala de visitas${semana ? ` (semana ${semana})` : ''}${regiao ? ` — ${regiao}` : ''}`,
      detalhes: {
        semana_inicio: semana || null,
        id_regiao: grade?.id_regiao ?? req.body?.id_regiao ?? null,
        dias: Array.isArray(req.body?.dias) ? req.body.dias.length : null,
      },
    });
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
    await auditar(req, {
      modulo: 'escalas',
      acao: 'copiar_escala',
      entidade: 'escala_visitas',
      idReferencia: String(para),
      descricao: `Copiou a escala de visitas de ${de} para ${para}`,
      detalhes: { de, para, id_regiao: req.body?.id_regiao ?? null },
    });
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
