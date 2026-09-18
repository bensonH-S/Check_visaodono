import { Router } from 'express';
import { requirePermissao } from '../permissoes.js';
import { salvarConfigAlvim } from '../agenteAlvim/persona.js';
import { sincronizarGruposAlvim } from '../agenteAlvim/grupos.js';
import {
  executarTesteAgenteAlvim,
  obterStatusAgenteAlvim,
} from '../agenteAlvim/monitor.js';

const router = Router();

router.get('/status', requirePermissao('configuracoes.ver'), async (_req, res, next) => {
  try {
    res.json(await obterStatusAgenteAlvim());
  } catch (e) {
    next(e);
  }
});

router.put('/config', requirePermissao('configuracoes.ver'), async (req, res, next) => {
  try {
    const salvo = await salvarConfigAlvim(req.body || {});
    const status = await obterStatusAgenteAlvim();
    res.json({ ...status, ...salvo });
  } catch (e) {
    next(e);
  }
});

router.post('/grupos/sincronizar', requirePermissao('configuracoes.ver'), async (_req, res, next) => {
  try {
    res.json(await sincronizarGruposAlvim());
  } catch (e) {
    next(e);
  }
});

router.post('/teste', requirePermissao('configuracoes.ver'), async (req, res, next) => {
  try {
    const ferramenta = String(req.body?.ferramenta || 'estoque').trim();
    const telefone = String(req.body?.telefone || '').trim() || null;
    const result = await executarTesteAgenteAlvim({ ferramenta, telefone });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
