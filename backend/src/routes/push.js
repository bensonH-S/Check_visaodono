import { Router } from 'express';
import {
  getVapidPublicKey,
  salvarPushSubscription,
  removerPushSubscription,
} from '../pushNotifications.js';

const router = Router();

router.get('/vapid-key', (_req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications não configuradas' });
  }
  res.json({ publicKey });
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
    res.json({ ok: true });
  } catch (e) {
    console.error('[push] subscribe:', e.message);
    res.status(500).json({ error: e.message || 'Erro ao registrar push' });
  }
});

router.delete('/subscribe', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    await removerPushSubscription(req.user.id_usuario, endpoint);
    res.json({ ok: true });
  } catch (e) {
    console.error('[push] unsubscribe:', e.message);
    res.status(500).json({ error: e.message || 'Erro ao remover push' });
  }
});

export default router;
