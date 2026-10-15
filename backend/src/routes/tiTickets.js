import { Router } from 'express';
import {
  listarBoard,
  listarMeusTickets,
  obterTicket,
  criarTicket,
  atualizarTicket,
  moverTicket,
  excluirTicket,
  listarComentarios,
  adicionarComentario,
  excluirComentario,
  avaliarTicket,
  listarNotas,
  criarNota,
  salvarNota,
  excluirNota,
  listarAcessos,
  concederAcesso,
  revogarAcesso,
  usuarioPodeGerenciarTickets,
  usuarioPodeAbrirTicket,
  STATUS_TICKET,
} from '../services/tiTickets.js';
import { pool } from '../db.js';

const router = Router();

async function requireGerenciar(req, res, next) {
  try {
    if (!(await usuarioPodeGerenciarTickets(req.user))) {
      return res.status(403).json({ error: 'Sem permissão para gerenciar tickets do TI' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

async function requireAbrir(req, res, next) {
  try {
    if (!(await usuarioPodeAbrirTicket(req.user))) {
      return res.status(403).json({ error: 'Sem permissão para abrir chamado' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

router.get('/me/pode', async (req, res, next) => {
  try {
    const [abrir, gerenciar] = await Promise.all([
      usuarioPodeAbrirTicket(req.user),
      usuarioPodeGerenciarTickets(req.user),
    ]);
    res.json({ abrir, gerenciar });
  } catch (e) {
    next(e);
  }
});

router.get('/meus', requireAbrir, async (req, res, next) => {
  try {
    res.json(await listarMeusTickets(req.user.sub));
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAbrir, async (req, res, next) => {
  try {
    const titulo = String(req.body?.titulo || '').trim();
    if (!titulo) return res.status(400).json({ error: 'Informe o título do chamado' });
    const gerenciar = await usuarioPodeGerenciarTickets(req.user);
    const status =
      gerenciar && STATUS_TICKET.includes(req.body?.status) ? req.body.status : 'chamado';
    const ticket = await criarTicket({
      titulo,
      descricao: req.body?.descricao,
      status,
      prioridade: req.body?.prioridade || 'media',
      area: req.body?.area || 'geral',
      origem: gerenciar && req.body?.origem ? req.body.origem : 'colaborador',
      criado_por: req.user.sub,
      responsavel_id: gerenciar ? req.body?.responsavel_id || null : null,
    });
    res.status(201).json(ticket);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/avaliar', requireAbrir, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ticket = await avaliarTicket(id, req.user.sub, {
      avaliacao: req.body?.avaliacao,
      comentario: req.body?.comentario,
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });
    res.json(ticket);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/board', requireGerenciar, async (req, res, next) => {
  try {
    res.json(await listarBoard());
  } catch (e) {
    next(e);
  }
});

router.get('/notas', requireAbrir, async (req, res, next) => {
  try {
    res.json(await listarNotas(req.user));
  } catch (e) {
    next(e);
  }
});

router.post('/notas', requireAbrir, async (req, res, next) => {
  try {
    const isTi = await usuarioPodeGerenciarTickets(req.user);
    const nota = await criarNota(
      { titulo: req.body?.titulo, corpo: req.body?.corpo },
      req.user.sub,
      { isTi },
    );
    res.status(201).json(nota);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.put('/notas/:id', requireAbrir, async (req, res, next) => {
  try {
    const isTi = await usuarioPodeGerenciarTickets(req.user);
    const nota = await salvarNota(Number(req.params.id), req.body || {}, req.user.sub, { isTi });
    if (!nota) return res.status(404).json({ error: 'Lista não encontrada' });
    res.json(nota);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.delete('/notas/:id', requireAbrir, async (req, res, next) => {
  try {
    const isTi = await usuarioPodeGerenciarTickets(req.user);
    const ok = await excluirNota(Number(req.params.id), req.user.sub, { isTi });
    if (!ok) return res.status(404).json({ error: 'Lista não encontrada' });
    res.json({ ok: true });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/acessos', requireGerenciar, async (req, res, next) => {
  try {
    res.json(await listarAcessos());
  } catch (e) {
    next(e);
  }
});

router.post('/acessos', requireGerenciar, async (req, res, next) => {
  try {
    const idUsuario = Number(req.body?.id_usuario);
    if (!idUsuario) return res.status(400).json({ error: 'Informe id_usuario' });
    res.json(await concederAcesso(idUsuario, req.user.sub));
  } catch (e) {
    next(e);
  }
});

router.delete('/acessos/:idUsuario', requireGerenciar, async (req, res, next) => {
  try {
    res.json(await revogarAcesso(Number(req.params.idUsuario)));
  } catch (e) {
    next(e);
  }
});

router.get('/usuarios-acesso', requireGerenciar, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_usuario, nome, email, ativo, avatar_inicial, avatar_mime, avatar_bytes
       FROM usuarios
       WHERE COALESCE(ativo, TRUE)
       ORDER BY nome
       LIMIT 500`,
    );
    res.json(
      rows.map((u) => {
        let avatar_url = null;
        if (u.avatar_bytes) {
          const buf = Buffer.isBuffer(u.avatar_bytes) ? u.avatar_bytes : Buffer.from(u.avatar_bytes);
          if (buf.length) {
            avatar_url = `data:${u.avatar_mime || 'image/jpeg'};base64,${buf.toString('base64')}`;
          }
        }
        return {
          id_usuario: Number(u.id_usuario),
          nome: u.nome,
          email: u.email,
          ativo: u.ativo,
          avatar_inicial: u.avatar_inicial || null,
          avatar_url,
        };
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireGerenciar, async (req, res, next) => {
  try {
    const ticket = await obterTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });
    const comentarios = await listarComentarios(ticket.id_ticket);
    res.json({ ...ticket, comentarios });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requireGerenciar, async (req, res, next) => {
  try {
    const ticket = await atualizarTicket(Number(req.params.id), req.body || {}, {
      notificarPor: req.user.sub,
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });
    res.json(ticket);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/mover', requireGerenciar, async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!STATUS_TICKET.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const ticket = await moverTicket(Number(req.params.id), status, req.body?.ordem);
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });
    res.json(ticket);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireGerenciar, async (req, res, next) => {
  try {
    const ok = await excluirTicket(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Ticket não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/comentarios', requireGerenciar, async (req, res, next) => {
  try {
    res.json(await listarComentarios(Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/comentarios', requireGerenciar, async (req, res, next) => {
  try {
    const c = await adicionarComentario(Number(req.params.id), req.user.sub, req.body?.texto);
    res.status(201).json(c);
  } catch (e) {
    if (e.message === 'Comentário vazio') return res.status(400).json({ error: e.message });
    next(e);
  }
});

router.delete('/comentarios/:idComentario', requireGerenciar, async (req, res, next) => {
  try {
    const ok = await excluirComentario(Number(req.params.idComentario), req.user.sub, {
      gerenciar: true,
    });
    if (!ok) return res.status(404).json({ error: 'Comentário não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
