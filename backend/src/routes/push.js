import { Router } from 'express';
import {
  getVapidPublicKey,
  salvarPushSubscription,
  removerPushSubscription,
  consultarPushUsuario,
  contarPushUsuario,
  resetarPushUsuario,
} from '../pushNotifications.js';
import { logger } from '../logger.js';

const router = Router();

function idUsuario(req) {
  const id = Number(req.user?.sub ?? req.user?.id_usuario);
  return Number.isFinite(id) ? id : null;
}

router.get('/status', async (req, res) => {
  try {
    const uid = idUsuario(req);
    if (!uid) return res.status(401).json({ error: 'Não autenticado' });
    const subscriptionCount = await contarPushUsuario(uid);
    const registered = subscriptionCount > 0;
    logger.info('push', 'Status push consultado', {
      idUsuario: uid,
      registered,
      subscriptionCount,
      pushEnabled: Boolean(getVapidPublicKey()),
    });
    res.json({
      registered,
      subscriptionCount,
      pushEnabled: Boolean(getVapidPublicKey()),
    });
  } catch (e) {
    logger.error('push', 'Erro ao consultar status', { error: e.message });
    res.status(500).json({ error: e.message || 'Erro ao consultar push' });
  }
});

router.get('/vapid-key', (_req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications não configuradas' });
  }
  res.json({ publicKey });
});

router.post('/diagnostico', async (req, res) => {
  const mensagem = String(req.body?.mensagem || 'diagnostico push');
  const meta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {};
  logger.warn('push-client', mensagem, {
    idUsuario: idUsuario(req),
    ...meta,
  });
  res.json({ ok: true });
});

router.post('/subscribe', async (req, res) => {
  try {
    const uid = idUsuario(req);
    if (!uid) return res.status(401).json({ error: 'Não autenticado' });
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Inscrição push inválida' });
    }
    await salvarPushSubscription(
      uid,
      subscription,
      req.headers['user-agent'],
    );
    logger.info('push', 'Inscrição push registrada', {
      idUsuario: uid,
      endpoint: `${String(subscription.endpoint).slice(0, 48)}…`,
    });
    res.json({ ok: true });
  } catch (e) {
    logger.error('push', 'Erro ao registrar inscrição', { error: e.message, idUsuario: idUsuario(req) });
    res.status(500).json({ error: e.message || 'Erro ao registrar push' });
  }
});

router.delete('/subscribe', async (req, res) => {
  try {
    const uid = idUsuario(req);
    if (!uid) return res.status(401).json({ error: 'Não autenticado' });
    const endpoint = req.body?.endpoint;
    await removerPushSubscription(uid, endpoint);
    logger.info('push', 'Inscrição push removida via API', {
      idUsuario: uid,
      endpoint: endpoint ? `${endpoint.slice(0, 48)}…` : 'todas',
    });
    res.json({ ok: true });
  } catch (e) {
    logger.error('push', 'Erro ao remover inscrição', { error: e.message });
    res.status(500).json({ error: e.message || 'Erro ao remover push' });
  }
});

/** Remove todas as inscrições push do usuário para reativar do zero. */
router.post('/reset', async (req, res) => {
  try {
    const uid = idUsuario(req);
    if (!uid) return res.status(401).json({ error: 'Não autenticado' });
    const removidas = await resetarPushUsuario(uid);
    logger.info('push', 'Push resetado pelo usuário', { idUsuario: uid, removidas });
    res.json({ ok: true, removidas });
  } catch (e) {
    logger.error('push', 'Erro ao resetar push', { error: e.message, idUsuario: idUsuario(req) });
    res.status(500).json({ error: e.message || 'Erro ao resetar push' });
  }
});

export default router;
