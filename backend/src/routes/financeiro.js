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

/** Escritório contábil: lista de NF-e, DANFE e XML. Sem lançar, confirmar ou editar. */
function podeLerNotas(req) {
  if (req.method !== 'GET') return false;
  if (!temPermissao(req.user, 'financeiro.nfe.ver') && !temPermissao(req.user, 'financeiro.ver')) return false;
  if (req.path === '/nfe/recebidas' || req.path === '/empresas') return true;
  return /^\/nfe\/recebidas\/[^/]+\/(danfe|xml)$/.test(req.path);
}

/** Custos (C_O_): só a consulta da aba. */
function podeLerCustos(req) {
  if (req.method !== 'GET') return false;
  if (!temPermissao(req.user, 'financeiro.custos.ver') && !temPermissao(req.user, 'financeiro.ver')) return false;
  return req.path === '/custos-co' || req.path === '/empresas';
}

const CONCILIACAO_ESCRITA = new Set([
  '/conciliacao/upload',
  '/conciliacao/confirmar',
  '/conciliacao/desfazer',
  '/conciliacao/sem-par',
]);

/** Conciliação bancária: leitura e as ações desta aba. Sem agenda, caixa ou custos. */
function podeConciliacao(req) {
  if (!temPermissao(req.user, 'financeiro.conciliacao.ver') && !temPermissao(req.user, 'financeiro.ver')) return false;
  if (req.method === 'GET' && (req.path.startsWith('/conciliacao/') || req.path === '/empresas')) return true;
  return req.method === 'POST' && CONCILIACAO_ESCRITA.has(req.path);
}

/** Agenda banco (contas a pagar): só consulta. Sem lançar, editar, importar ou excluir. */
function podeContasPagar(req) {
  if (req.method !== 'GET') return false;
  if (!temPermissao(req.user, 'financeiro.contas.ver')) return false;
  const p = req.path;
  if (p === '/despesas' || p === '/empresas' || p === '/despesas/planilha-banco' || p === '/fornecedores' || p === '/plano' || p === '/plano/todos' || p === '/contas') return true;
  return /^\/despesas\/[^/]+\/(nota|boleto)$/.test(p);
}

router.use((req, res, next) => {
  if (req.method === 'POST' && semPermissaoDeTela.has(req.path)) return next();
  if (podeLerNotas(req)) return next();
  if (podeLerCustos(req)) return next();
  if (podeConciliacao(req)) return next();
  if (podeContasPagar(req)) return next();
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
