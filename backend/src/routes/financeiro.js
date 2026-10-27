import { Router } from 'express';
import { requirePermissao, temPermissao } from '../permissoes.js';
import { handleFinance, iniciarFinanceiro } from '../financeiro/http.mjs';

const router = Router();

iniciarFinanceiro();

const semPermissaoDeTela = new Set([
  '/caixa/ingest',
  '/caixa/heartbeat',
  '/despesas/freecontrol-lote',
]);

/** Leitura agregada do Command Center + Agenda em modo visualização (sem editar). */
const leituraResumo = new Set([
  '/despesas',
  '/resumo',
  '/empresas',
  '/despesas/planilha-banco',
  '/caixa/canais',
  '/mascara-reuniao',
]);

function ehAcaoDono(req) {
  if (req.method !== 'POST') return false;
  return /^\/despesas\/[^/]+\/dono-(recusa|valor|livre)$/.test(req.path);
}

function podeLeituraResumo(req) {
  if (ehAcaoDono(req)) return true;
  if (req.method !== 'GET') return false;
  if (leituraResumo.has(req.path)) return true;
  if (req.path.startsWith('/mascara-reuniao/')) return true;
  if (/^\/despesas\/[^/]+\/(nota|boleto)$/.test(req.path)) return true;
  return false;
}

router.use((req, res, next) => {
  if (req.method === 'POST' && semPermissaoDeTela.has(req.path)) return next();
  if (podeLeituraResumo(req)) {
    if (temPermissao(req.user, 'financeiro.ver') || temPermissao(req.user, 'financeiro.resumo.ver')) {
      return next();
    }
    return res.status(403).json({ error: 'Sem permissão para esta ação' });
  }
  return requirePermissao('financeiro.ver')(req, res, next);
});

router.use((req, res) => {
  handleFinance(req, res).catch((err) => {
    if (res.headersSent) return;
    res.status(500).json({ error: err?.message || 'Falha no financeiro' });
  });
});

export default router;
