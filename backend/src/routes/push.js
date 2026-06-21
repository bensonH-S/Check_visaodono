import { Router } from 'express';
import {
  getVapidPublicKey,
  salvarPushSubscription,
  removerPushSubscription,
  consultarPushUsuario,
} from '../pushNotifications.js';
import { logger } from '../logger.js';

const router = Router();

router.get('/status', async (req, res) => {
  try {
    const registered = await consultarPushUsuario(req.user.id_usuario);
    res.json({
      registered,
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
    idUsuario: req.user.id_usuario,
    ...meta,
  });
  res.json({ ok: true });
});

router.post('/subscribe', async (req, res) => {
  try {
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Inscrição push inválida' });
    }
    await salvarPushSubscription(
      req.user.id_usuario,
      subscription,
      req.headers['user-agent'],
    );
    logger.info('push', 'Inscrição push registrada', { idUsuario: req.user.id_usuario });
    res.json({ ok: true });
  } catch (e) {
    logger.error('push', 'Erro ao registrar inscrição', { error: e.message, idUsuario: req.user?.id_usuario });
    res.status(500).json({ error: e.message || 'Erro ao registrar push' });
  }
});

router.delete('/subscribe', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    await removerPushSubscription(req.user.id_usuario, endpoint);
    res.json({ ok: true });
  } catch (e) {
    logger.error('push', 'Erro ao remover inscrição', { error: e.message });
    res.status(500).json({ error: e.message || 'Erro ao remover push' });
  }
});

export default router;
