import { Router } from 'express';
import {
  getVapidPublicKey,
  salvarPushSubscription,
  removerPushSubscription,
  consultarPushUsuario,
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
    const registered = await consultarPushUsuario(uid);
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
    logger.info('push', 'Inscrição push registrada', { idUsuario: uid });
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
    res.json({ ok: true });
  } catch (e) {
    logger.error('push', 'Erro ao remover inscrição', { error: e.message });
    res.status(500).json({ error: e.message || 'Erro ao remover push' });
  }
});

export default router;
