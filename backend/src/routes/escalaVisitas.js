import { Router } from 'express';
import {
  aprovarEscalaDelivery,
  aprovarEscalaRegiao,
  carregarGradeVisitas,
  copiarSemanaVisitas,
  devolverEscalaDelivery,
  devolverEscalaRegiao,
  limparEscalaDelivery,
  limparEscalaRegiao,
  listarNotificacoesEscala,
  listarSemanasVisitas,
  marcarNotificacoesEscalaLidas,
  podeVerEscalaVisitas,
  salvarGradeVisitas,
  segundaFeiraDaSemana,
  submeterEscalaDelivery,
  submeterEscalaRegiao,
} from '../escalaVisitas.js';
import { auditar } from '../auditoriaHelpers.js';

const router = Router();

function erroHttp(e, res, next) {
  const msg = e.message || 'Erro';
  if (
    msg.includes('Sem permissão') ||
    msg.includes('Sem acesso') ||
    msg.includes('bloqueada') ||
    msg.includes('bloqueado') ||
    msg.includes('só pode ser editado')
  ) {
    return res.status(403).json({ error: msg });
  }
  if (
    msg.includes('Data inválida') ||
    msg.includes('Informe') ||
    msg.includes('Só é possível') ||
    msg.includes('Semanas iguais') ||
    msg.includes('Delivery') ||
    msg.includes('Envio') ||
    msg.includes('Não há')
  ) {
    return res.status(400).json({ error: msg });
  }
  return next(e);
}

router.get('/semana', async (req, res, next) => {
  try {
    if (!podeVerEscalaVisitas(req.user)) {
      return res.status(403).json({ error: 'Sem permissão para ver a escala de visitas' });
    }
    const semana_inicio = req.query.semana_inicio
      ? segundaFeiraDaSemana(String(req.query.semana_inicio))
      : segundaFeiraDaSemana(new Date());
    const id_regiao = req.query.id_regiao ? Number(req.query.id_regiao) : null;
    const id_envio = req.query.id_envio ? Number(req.query.id_envio) : null;
    const id_usuario_envio = req.query.id_usuario_envio ? Number(req.query.id_usuario_envio) : null;
    const grade = await carregarGradeVisitas(req.user, {
      semana_inicio,
      id_regiao,
      id_envio: Number.isFinite(id_envio) && id_envio > 0 ? id_envio : null,
      id_usuario_envio:
        Number.isFinite(id_usuario_envio) && id_usuario_envio > 0 ? id_usuario_envio : null,
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
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
    return erroHttp(e, res, next);
  }
});

router.post('/semana/submeter', async (req, res, next) => {
  try {
    const grade = await submeterEscalaRegiao(req.user, req.body || {});
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    const idRegiao = req.body?.id_regiao ?? null;
    await auditar(req, {
      modulo: 'escalas',
      acao: 'submeter_escala',
      entidade: 'escala_visitas_regiao',
      idReferencia: semana,
      descricao: `Enviou escala de visitas para aprovação${semana ? ` (semana ${semana})` : ''}${idRegiao ? ` — região #${idRegiao}` : ''}`,
      detalhes: { semana_inicio: semana || null, id_regiao: idRegiao },
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.post('/semana/aprovar', async (req, res, next) => {
  try {
    const grade = await aprovarEscalaRegiao(req.user, req.body || {});
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    const idRegiao = req.body?.id_regiao ?? null;
    await auditar(req, {
      modulo: 'escalas',
      acao: 'aprovar_escala',
      entidade: 'escala_visitas_regiao',
      idReferencia: semana,
      descricao: `Aprovou escala de visitas${semana ? ` (semana ${semana})` : ''}${idRegiao ? ` — região #${idRegiao}` : ''}`,
      detalhes: {
        semana_inicio: semana || null,
        id_regiao: idRegiao,
        comentario: req.body?.comentario ?? null,
      },
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.post('/semana/devolver', async (req, res, next) => {
  try {
    const grade = await devolverEscalaRegiao(req.user, req.body || {});
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    const idRegiao = req.body?.id_regiao ?? null;
    await auditar(req, {
      modulo: 'escalas',
      acao: 'devolver_escala',
      entidade: 'escala_visitas_regiao',
      idReferencia: semana,
      descricao: `Devolveu escala de visitas${semana ? ` (semana ${semana})` : ''}${idRegiao ? ` — região #${idRegiao}` : ''}`,
      detalhes: {
        semana_inicio: semana || null,
        id_regiao: idRegiao,
        comentario: req.body?.comentario ?? null,
      },
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.post('/semana/delivery/submeter', async (req, res, next) => {
  try {
    const grade = await submeterEscalaDelivery(req.user, req.body || {});
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    await auditar(req, {
      modulo: 'escalas',
      acao: 'submeter_delivery',
      entidade: 'escala_visitas_delivery',
      idReferencia: semana,
      descricao: `Enviou escala de delivery para aprovação${semana ? ` (semana ${semana})` : ''}`,
      detalhes: { semana_inicio: semana || null },
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.post('/semana/delivery/aprovar', async (req, res, next) => {
  try {
    const grade = await aprovarEscalaDelivery(req.user, req.body || {});
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    await auditar(req, {
      modulo: 'escalas',
      acao: 'aprovar_delivery',
      entidade: 'escala_visitas_delivery',
      idReferencia: semana,
      descricao: `Aprovou escala de delivery${semana ? ` (semana ${semana})` : ''}`,
      detalhes: { semana_inicio: semana || null, comentario: req.body?.comentario ?? null },
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.post('/semana/delivery/devolver', async (req, res, next) => {
  try {
    const grade = await devolverEscalaDelivery(req.user, req.body || {});
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    await auditar(req, {
      modulo: 'escalas',
      acao: 'devolver_delivery',
      entidade: 'escala_visitas_delivery',
      idReferencia: semana,
      descricao: `Devolveu escala de delivery${semana ? ` (semana ${semana})` : ''}`,
      detalhes: { semana_inicio: semana || null, comentario: req.body?.comentario ?? null },
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.post('/semana/limpar', async (req, res, next) => {
  try {
    const grade = await limparEscalaRegiao(req.user, req.body || {});
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    const idRegiao = req.body?.id_regiao ?? null;
    await auditar(req, {
      modulo: 'escalas',
      acao: 'limpar_escala_regiao',
      entidade: 'escala_visitas_regiao',
      idReferencia: semana,
      descricao: `Excluiu escala de visitas${semana ? ` (semana ${semana})` : ''}${idRegiao ? ` — região #${idRegiao}` : ''}`,
      detalhes: { semana_inicio: semana || null, id_regiao: idRegiao },
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.post('/semana/delivery/limpar', async (req, res, next) => {
  try {
    const grade = await limparEscalaDelivery(req.user, req.body || {});
    const semana = grade?.semana_inicio || req.body?.semana_inicio || '';
    await auditar(req, {
      modulo: 'escalas',
      acao: 'limpar_escala_delivery',
      entidade: 'escala_visitas_delivery',
      idReferencia: semana,
      descricao: `Excluiu escala de delivery${semana ? ` (semana ${semana})` : ''}`,
      detalhes: { semana_inicio: semana || null },
    });
    res.json(grade);
  } catch (e) {
    return erroHttp(e, res, next);
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
    return erroHttp(e, res, next);
  }
});

router.get('/semanas', async (req, res, next) => {
  try {
    const semanas = await listarSemanasVisitas(req.user);
    res.json(semanas);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.get('/notificacoes', async (req, res, next) => {
  try {
    const lista = await listarNotificacoesEscala(req.user, {
      apenas_nao_lidas: req.query.nao_lidas === '1' || req.query.nao_lidas === 'true',
    });
    res.json(lista);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

router.patch('/notificacoes/lidas', async (req, res, next) => {
  try {
    const out = await marcarNotificacoesEscalaLidas(req.user, {
      id_notificacao: req.body?.id_notificacao ?? null,
    });
    res.json(out);
  } catch (e) {
    return erroHttp(e, res, next);
  }
});

export default router;
