import { Router } from 'express';
import { requirePermissao } from '../permissoes.js';

const router = Router();
const TARGET = (process.env.FINANCEIRO_API_URL || 'http://127.0.0.1:5080').replace(/\/$/, '');

router.use(requirePermissao('financeiro.ver'));

router.use(async (req, res) => {
  try {
    const suffix = String(req.url || '/').replace(/^\//, '');
    const url = `${TARGET}/api/${suffix}`;
    const headers = { accept: req.headers.accept || '*/*' };
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    if (req.headers.authorization) headers.authorization = req.headers.authorization;

    const init = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!headers['content-type']) headers['content-type'] = 'application/json';
    }

    const upstream = await fetch(url, init);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(buf);
  } catch (e) {
    res.status(502).json({
      error: e?.message || 'Serviço financeiro indisponível',
      detalhe: `Proxy → ${TARGET}. Suba o Finance (porta 5080) ou defina FINANCEIRO_API_URL.`,
    });
  }
});

export default router;
