import { Router } from 'express';
import { requirePermissao } from '../permissoes.js';
import { wppConfig, wppEnabled } from '../services/wppClient.js';
import {
  conectarSessaoWpp,
  obterQrSessaoWpp,
  statusSessaoWpp,
} from '../services/wppSession.js';
import { enviarWhatsAppTeste } from '../services/whatsappNotificacoes.js';

const router = Router();

router.get('/status', requirePermissao('configuracoes.ver'), async (_req, res, next) => {
  try {
    const status = await statusSessaoWpp();
    res.json({
      ...status,
      publicUrl: process.env.PUBLIC_APP_URL || null,
      sessionConfig: wppConfig().session,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/qrcode', requirePermissao('configuracoes.ver'), async (_req, res, next) => {
  try {
    if (!wppEnabled()) {
      return res.status(400).json({ error: 'WhatsApp desabilitado. Defina WPP_ENABLED=true no .env' });
    }
    const data = await obterQrSessaoWpp();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/conectar', requirePermissao('configuracoes.ver'), async (req, res, next) => {
  try {
    if (!wppEnabled()) {
      return res.status(400).json({ error: 'WhatsApp desabilitado. Defina WPP_ENABLED=true no .env' });
    }
    const reiniciar = req.body?.reiniciar === true;
    const data = await conectarSessaoWpp({ reiniciar });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/teste', requirePermissao('configuracoes.ver'), async (req, res, next) => {
  try {
    const telefone = String(req.body?.telefone || '').trim();
    const mensagem = String(req.body?.mensagem || '').trim();
    if (!telefone) return res.status(400).json({ error: 'Informe o telefone' });
    const result = await enviarWhatsAppTeste(telefone, mensagem);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Falha no envio de teste' });
  }
});

export default router;
