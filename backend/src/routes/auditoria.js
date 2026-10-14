import { Router } from 'express';
import { listarAuditoria } from '../services/auditoria.js';
import {
  iniciarSessao,
  pingSessao,
  encerrarSessao,
  registrarNavegacao,
  listarSessoes,
  listarNavegacao,
} from '../services/auditoriaSessao.js';
import { requirePermissao } from '../permissoes.js';
import { pool } from '../db.js';

const router = Router();

router.get('/eventos', requirePermissao('configuracoes.auditoria'), async (req, res, next) => {
  try {
    const { limite, offset, modulo, id_usuario, q } = req.query;
    const eventos = await listarAuditoria({
      limite,
      offset,
      modulo,
      idUsuario: id_usuario,
      q,
    });
    res.json(eventos);
  } catch (e) {
    next(e);
  }
});

/** Lista enxuta de usuários para filtro da tela de auditoria. */
router.get('/usuarios-filtro', requirePermissao('configuracoes.auditoria'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_usuario, nome, email, ativo
       FROM usuarios
       ORDER BY ativo DESC, nome ASC
       LIMIT 500`,
    );
    res.json(
      rows.map((u) => ({
        id_usuario: u.id_usuario,
        nome: u.nome,
        email: u.email,
        ativo: u.ativo,
      })),
    );
  } catch (e) {
    next(e);
  }
});

/** Telemetria: qualquer usuário autenticado registra a própria sessão/navegação. */
router.post('/sessao/inicio', async (req, res, next) => {
  try {
    const sessao = await iniciarSessao(req, { origem: req.body?.origem || 'app' });
    if (!sessao) return res.status(400).json({ error: 'Não foi possível iniciar sessão' });
    res.json({ id_sessao: Number(sessao.id_sessao), iniciada_em: sessao.iniciada_em });
  } catch (e) {
    next(e);
  }
});

router.post('/sessao/ping', async (req, res, next) => {
  try {
    const id = req.body?.id_sessao;
    const ok = await pingSessao(req, id);
    if (!ok) return res.status(404).json({ error: 'Sessão não encontrada ou encerrada' });
    res.json({ ok: true, id_sessao: Number(ok.id_sessao), ultimo_ping_em: ok.ultimo_ping_em });
  } catch (e) {
    next(e);
  }
});

router.post('/sessao/fim', async (req, res, next) => {
  try {
    const id = req.body?.id_sessao;
    const ok = await encerrarSessao(req, id);
    res.json({ ok: true, encerrada: Boolean(ok), id_sessao: ok ? Number(ok.id_sessao) : null });
  } catch (e) {
    next(e);
  }
});

router.post('/navegacao', async (req, res, next) => {
  try {
    const row = await registrarNavegacao(req, {
      idSessao: req.body?.id_sessao,
      rota: req.body?.rota,
      titulo: req.body?.titulo,
    });
    if (!row) return res.status(400).json({ error: 'Não foi possível registrar navegação' });
    res.json({
      id_navegacao: Number(row.id_navegacao),
      id_sessao: Number(row.id_sessao),
      rota: row.rota,
      titulo: row.titulo,
      entrou_em: row.entrou_em,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/sessoes', requirePermissao('configuracoes.auditoria'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
    const data = await listarSessoes({
      page,
      pageSize,
      idUsuario: req.query.id_usuario || null,
      de: req.query.de || null,
      ate: req.query.ate || null,
      apenasAbertas: req.query.abertas === '1' || req.query.abertas === 'true',
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get('/navegacoes', requirePermissao('configuracoes.auditoria'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(150, Math.max(1, Number(req.query.pageSize) || 80));
    const data = await listarNavegacao({
      page,
      pageSize,
      idUsuario: req.query.id_usuario || null,
      idSessao: req.query.id_sessao || null,
      de: req.query.de || null,
      ate: req.query.ate || null,
      rota: req.query.rota || null,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
