/**
 * Endpoints do kit PC gerência (HTTPS) — sem JWT de usuário.
 * Auth: header X-Meridian-Kit-Token === BKOFFICE_KIT_TOKEN
 */
import { Router } from 'express';
import multer from 'multer';
import { importarVendasLoja } from '../services/estoqueMotor.js';
import { parseVendasExcelBuffer } from '../services/bkoffice/parseVendasExcel.js';
import { importarVendasGrupoExcel } from '../services/bkoffice/importVendasGrupo.js';
import { listarLojasBkOfficeSync } from '../services/bkoffice/syncVendas.js';
import {
  adquirirLease,
  liberarLease,
  statusLease,
  registrarHeartbeat,
  LEASE_TTL_DEFAULT_S,
} from '../services/bkoffice/kitSyncLease.js';
import { pool } from '../db.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function kitTokenOk(req) {
  const expected = String(process.env.BKOFFICE_KIT_TOKEN || '').trim();
  if (!expected || expected.length < 16) return false;
  const got = String(
    req.headers['x-meridian-kit-token'] ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, ''),
  ).trim();
  if (!got || got.length !== expected.length) return false;
  // comparação em tempo constante
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  }
  return diff === 0;
}

function requireKitToken(req, res, next) {
  if (!kitTokenOk(req)) {
    return res.status(401).json({ error: 'Token do kit inválido ou ausente' });
  }
  if (!String(process.env.BKOFFICE_KIT_TOKEN || '').trim()) {
    return res.status(503).json({ error: 'BKOFFICE_KIT_TOKEN não configurado no servidor' });
  }
  next();
}

/**
 * POST /public/kit/estoque/vendas-import
 * multipart: arquivo (xlsx), id_loja, data_inicio?, data_fim?, processar?
 */
router.post('/estoque/vendas-import', requireKitToken, upload.single('arquivo'), async (req, res, next) => {
  try {
    const idLoja = Number(req.body?.id_loja);
    if (!Number.isFinite(idLoja) || idLoja <= 0) {
      return res.status(400).json({ error: 'id_loja inválido' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'Envie o Excel no campo arquivo' });
    }

    const { rows: lojas } = await pool.query(
      'SELECT id_loja, bk_number, name FROM lojas WHERE id_loja = $1',
      [idLoja],
    );
    if (!lojas.length) {
      return res.status(404).json({ error: 'Loja não encontrada' });
    }
    const bkNumber = lojas[0].bk_number ? String(lojas[0].bk_number).trim() : null;

    const dataPadrao =
      String(req.body?.data_fim || req.body?.data_inicio || req.body?.data_venda || '').slice(0, 10) ||
      null;

    let parsed = parseVendasExcelBuffer(req.file.buffer, {
      dataPadrao,
      bkNumber,
    });
    // Só tenta sem filtro se o Excel não tem coluna BK Number (relatório de uma loja).
    // Se tem BK Number e zerou, esta loja simplesmente não vendeu — NÃO jogar o grupo inteiro nela.
    if (!parsed.length && bkNumber) {
      const bruto = parseVendasExcelBuffer(req.file.buffer, { dataPadrao });
      const temBk = bruto.some((r) => r.bk_number);
      if (!temBk) parsed = bruto;
    }

    const itens = parsed
      .map((r) => ({
        ...r,
        data_venda: r.data_venda || dataPadrao,
      }))
      .filter((r) => r.data_venda && r.codigo && r.qtde > 0);

    if (!itens.length) {
      return res.status(422).json({
        error:
          'Nenhuma linha de produto no Excel. Confirme o relatório Restaurante e Produto Venda.',
      });
    }

    const processar = req.body?.processar !== '0' && req.body?.processar !== false;
    const result = await importarVendasLoja({
      id_loja: idLoja,
      itens,
      origem: 'bkoffice',
      arquivo_nome: req.file.originalname || 'kit-upload.xlsx',
      criado_por: null,
      processar,
    });

    const dias = [...new Set(itens.map((i) => i.data_venda))].sort();
    res.status(201).json({
      ok: true,
      loja: idLoja,
      linhas: itens.length,
      dias: dias.length,
      de: dias[0] || null,
      ate: dias[dias.length - 1] || null,
      venda_total: Math.round(
        itens.reduce((a, i) => a + (Number(i.venda_liquida ?? i.valor) || 0), 0) * 100,
      ) / 100,
      import: result,
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

/**
 * POST /public/kit/estoque/vendas-import-grupo
 * Um Excel do setor (todas as lojas do dia) → fatia por BKN e grava cada loja.
 */
router.post('/estoque/vendas-import-grupo', requireKitToken, upload.single('arquivo'), async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'Envie o Excel no campo arquivo' });
    }
    const dataPadrao =
      String(req.body?.data_fim || req.body?.data_inicio || req.body?.data_venda || '').slice(0, 10) ||
      null;
    const processar = req.body?.processar !== '0' && req.body?.processar !== false;
    const result = await importarVendasGrupoExcel({
      buffer: req.file.buffer,
      dataPadrao,
      processar,
      arquivo_nome: req.file.originalname || 'kit-grupo.xlsx',
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message, code: e.code });
    next(e);
  }
});

/** Health do kit (confere token + API no ar). */
router.get('/ping', requireKitToken, (_req, res) => {
  res.json({ ok: true, modo: 'kit-https', ts: new Date().toISOString() });
});

/**
 * POST /public/kit/sync-lease
 * body: { holder_id, holder_name?, ttl_s? }
 * Só um PC sincroniza; o outro fica standby até o lease expirar (~5 min).
 */
router.post('/sync-lease', requireKitToken, async (req, res, next) => {
  try {
    const holder_id = String(req.body?.holder_id || '').trim();
    const holder_name = String(req.body?.holder_name || '').trim() || null;
    const ttl_s = Number(req.body?.ttl_s) || LEASE_TTL_DEFAULT_S;
    const result = await adquirirLease({ holder_id, holder_name, ttl_s });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/sync-lease', requireKitToken, async (req, res, next) => {
  try {
    const holder_id = String(req.query?.holder_id || '').trim() || null;
    res.json(await statusLease({ holder_id }));
  } catch (e) {
    next(e);
  }
});

router.delete('/sync-lease', requireKitToken, async (req, res, next) => {
  try {
    const holder_id = String(req.body?.holder_id || req.query?.holder_id || '').trim();
    res.json(await liberarLease({ holder_id }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

/** POST /public/kit/sync-heartbeat — kit avisa que sincronizou. */
router.post('/sync-heartbeat', requireKitToken, async (req, res, next) => {
  try {
    const result = await registrarHeartbeat({
      holder_id: String(req.body?.holder_id || '').trim(),
      holder_name: String(req.body?.holder_name || '').trim() || null,
      ok: req.body?.ok !== false,
      de: req.body?.de || null,
      ate: req.body?.ate || null,
      lojas_ok: req.body?.lojas_ok,
      venda_total: req.body?.venda_total,
      produtos: req.body?.produtos,
    });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

/** Lista lojas do rodízio BK Office (operacionais com BKN). */
router.get('/estoque/lojas-sync', requireKitToken, async (req, res, next) => {
  try {
    const raw = String(req.query.ids || '').trim();
    let ids = null;
    if (raw && raw !== 'all' && raw !== '*') {
      ids = raw
        .split(/[,;\s]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!ids.length) ids = null;
    }
    const lojas = await listarLojasBkOfficeSync({ ids: ids && ids.length ? ids : 'all' });
    res.json({ ok: true, total: lojas.length, lojas });
  } catch (e) {
    next(e);
  }
});

export default router;
