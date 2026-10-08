import { Router } from 'express';
import { requirePermissao } from '../permissoes.js';
import { handleFinance, iniciarFinanceiro } from '../financeiro/http.mjs';

const router = Router();

iniciarFinanceiro();

const semPermissaoDeTela = new Set(['/caixa/ingest', '/caixa/heartbeat']);

router.use((req, res, next) => {
  if (req.method === 'POST' && semPermissaoDeTela.has(req.path)) return next();
  return requirePermissao('financeiro.ver')(req, res, next);
});

router.use((req, res) => {
  handleFinance(req, res).catch((err) => {
    if (res.headersSent) return;
    res.status(500).json({ error: err?.message || 'Falha no financeiro' });
  });
});

export default router;
