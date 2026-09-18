import { Router } from 'express';
import { requirePermissao } from '../permissoes.js';
import { wppConfig, wppEnabled, isErroRedeWpp, erroRedeWppParaStatus } from '../services/wppClient.js';
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
      wppBase: wppEnabled() ? wppConfig().base : null,
    });
  } catch (e) {
    if (isErroRedeWpp(e)) {
      return res.json({
        ...erroRedeWppParaStatus(e),
        publicUrl: process.env.PUBLIC_APP_URL || null,
        sessionConfig: wppConfig().session,
        wppBase: wppConfig().base,
      });
    }
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

router.post('/webhook', async (req, res) => {
  try {
    const expected = String(process.env.WPP_WEBHOOK_SECRET || '').trim();
    if (expected) {
      const got = String(req.query.secret || req.headers['x-wpp-secret'] || '').trim();
      if (got !== expected) {
        return res.status(401).json({ success: false, message: 'secret inválido' });
      }
    }
    const { extractInboundFromWppWebhook, enqueueInboundAlvim } = await import(
      '../agenteAlvim/conversa.js'
    );
    const inbound = extractInboundFromWppWebhook(req.body || {});
    if (inbound.fromMe || !inbound.body) {
      return res.json({ success: true, ignored: true });
    }
    void enqueueInboundAlvim(inbound.from, inbound.body, {
      chatId: inbound.chatId,
      nomePessoa: inbound.nomePessoa,
    });
    res.json({ success: true, queued: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'erro webhook' });
  }
});

export default router;
