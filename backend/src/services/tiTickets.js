import { pool } from '../db.js';
import { temPermissao } from '../permissoes.js';

export const STATUS_TICKET = ['chamado', 'fazer', 'pendente', 'feito'];
export const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'];

const TICKET_SELECT = `
  t.id_ticket,
  t.titulo,
  t.descricao,
  t.status,
  t.prioridade,
  t.area,
  t.origem,
  t.criado_por,
  t.responsavel_id,
  t.prazo,
  t.avaliacao,
  t.avaliacao_comentario,
  t.ordem,
  t.created_at,
  t.updated_at,
  t.concluido_em,
  uc.nome AS criado_por_nome,
  ur.nome AS responsavel_nome,
  ur.avatar_inicial AS responsavel_avatar_inicial,
  ur.avatar_mime AS responsavel_avatar_mime,
  ur.avatar_bytes AS responsavel_avatar_bytes
`;

function avatarDataUrl(mime, bytes) {
  if (!bytes) return null;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buf.length) return null;
  return `data:${mime || 'image/jpeg'};base64,${buf.toString('base64')}`;
}

export function isAdminUser(user) {
  const cargo = user?.cargo_aprovacao || user?.perfil;
  return cargo === 'administrador' || cargo === 'ceo' || cargo === 'diretor';
}

export async function usuarioPodeGerenciarTickets(user) {
  if (!user?.sub) return false;
  if (isAdminUser(user)) return true;
  if (temPermissao(user, 'ti.tickets.gerenciar')) return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM ti_ticket_acessos
     WHERE id_usuario = $1 AND pode_gerenciar = TRUE
     LIMIT 1`,
    [user.sub],
  );
  return rows.length > 0;
}

export async function usuarioPodeAbrirTicket(user) {
  // Qualquer colaborador autenticado pode abrir chamado para o TI.
  if (!user?.sub) return false;
  return true;
}

function mapTicket(row) {
  if (!row) return null;
  const status = row.status === 'backlog' ? 'chamado' : row.status;
  const prazo =
    row.prazo == null
      ? null
      : typeof row.prazo === 'string'
        ? row.prazo.slice(0, 10)
        : row.prazo.toISOString?.().slice(0, 10) || String(row.prazo).slice(0, 10);
  return {
    id_ticket: Number(row.id_ticket),
    titulo: row.titulo,
    descricao: row.descricao || '',
    status,
    prioridade: row.prioridade,
    area: row.area,
    origem: row.origem,
    criado_por: row.criado_por != null ? Number(row.criado_por) : null,
    criado_por_nome: row.criado_por_nome || null,
    responsavel_id: row.responsavel_id != null ? Number(row.responsavel_id) : null,
    responsavel_nome: row.responsavel_nome || null,
    responsavel_avatar_inicial: row.responsavel_avatar_inicial || null,
    responsavel_avatar_url: avatarDataUrl(row.responsavel_avatar_mime, row.responsavel_avatar_bytes),
    prazo,
    avaliacao: row.avaliacao != null ? Number(row.avaliacao) : null,
    avaliacao_comentario: row.avaliacao_comentario || null,
    ordem: Number(row.ordem) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    concluido_em: row.concluido_em,
  };
}

async function notificarAtribuicao(ticket, atribuidoPorId) {
  if (!ticket?.responsavel_id) return false;
  try {
    const { criarPortalNotificacao } = await import('./portalNotificacoes.js');
    const quem = await pool.query(`SELECT nome FROM usuarios WHERE id_usuario = $1`, [atribuidoPorId]);
    const nomeQuem = quem.rows[0]?.nome || 'TI';
    const prazoTxt = ticket.prazo ? ` · prazo ${ticket.prazo}` : '';

    // Destinatário (responsável)
    if (Number(ticket.responsavel_id) !== Number(atribuidoPorId)) {
      await criarPortalNotificacao({
        idUsuario: ticket.responsavel_id,
        tipo: 'ti_atribuicao',
        titulo: 'Ticket atribuído a você',
        mensagem: `${nomeQuem} atribuiu: ${ticket.titulo}${prazoTxt}`,
        link: '/configuracoes/tickets',
        refTipo: 'ti_ticket',
        refId: ticket.id_ticket,
      });
    }

    // Quem atribuiu também vê no sininho (confirmação)
    if (atribuidoPorId) {
      await criarPortalNotificacao({
        idUsuario: atribuidoPorId,
        tipo: 'ti_atribuicao_enviada',
        titulo: 'Atribuição enviada',
        mensagem: `Você atribuiu a ${ticket.responsavel_nome || 'responsável'}: ${ticket.titulo}${prazoTxt}`,
        link: '/configuracoes/tickets',
        refTipo: 'ti_ticket',
        refId: ticket.id_ticket,
      });
    }
    return true;
  } catch (e) {
    console.error('[tiTickets] notificar atribuição:', e.message);
    return false;
  }
}

export async function listarBoard() {
  const { rows } = await pool.query(
    `SELECT ${TICKET_SELECT}
     FROM ti_tickets t
     LEFT JOIN usuarios uc ON uc.id_usuario = t.criado_por
     LEFT JOIN usuarios ur ON ur.id_usuario = t.responsavel_id
     ORDER BY
       CASE t.status
         WHEN 'chamado' THEN 0
         WHEN 'fazer' THEN 1
         WHEN 'pendente' THEN 2
         WHEN 'feito' THEN 3
         ELSE 9
       END,
       t.ordem ASC,
       t.id_ticket ASC`,
  );
  return rows.map(mapTicket);
}

export async function listarMeusTickets(idUsuario) {
  const { rows } = await pool.query(
    `SELECT ${TICKET_SELECT}
     FROM ti_tickets t
     LEFT JOIN usuarios uc ON uc.id_usuario = t.criado_por
     LEFT JOIN usuarios ur ON ur.id_usuario = t.responsavel_id
     WHERE t.criado_por = $1
     ORDER BY t.created_at DESC
     LIMIT 100`,
    [idUsuario],
  );
  return rows.map(mapTicket);
}

export async function obterTicket(id) {
  const { rows } = await pool.query(
    `SELECT ${TICKET_SELECT}
     FROM ti_tickets t
     LEFT JOIN usuarios uc ON uc.id_usuario = t.criado_por
     LEFT JOIN usuarios ur ON ur.id_usuario = t.responsavel_id
     WHERE t.id_ticket = $1`,
    [id],
  );
  return mapTicket(rows[0]);
}

function normalizarPrazo(valor) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  const s = String(valor).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export async function criarTicket({
  titulo,
  descricao,
  status = 'chamado',
  prioridade = 'media',
  area = 'geral',
  origem = 'colaborador',
  criado_por,
  responsavel_id = null,
  prazo = null,
  notificarPor = null,
}) {
  const st = STATUS_TICKET.includes(status) ? status : 'chamado';
  const pr = PRIORIDADES.includes(prioridade) ? prioridade : 'media';
  const pz = normalizarPrazo(prazo) ?? null;
  const { rows: ord } = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM ti_tickets WHERE status = $1`,
    [st],
  );
  const { rows } = await pool.query(
    `INSERT INTO ti_tickets (
       titulo, descricao, status, prioridade, area, origem,
       criado_por, responsavel_id, prazo, ordem
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id_ticket`,
    [
      String(titulo || '').trim().slice(0, 500),
      descricao != null ? String(descricao).trim() : null,
      st,
      pr,
      String(area || 'geral').slice(0, 40),
      origem,
      criado_por || null,
      responsavel_id || null,
      pz,
      Number(ord[0]?.prox) || 1,
    ],
  );
  const ticket = await obterTicket(rows[0].id_ticket);
  if (ticket?.responsavel_id) {
    await notificarAtribuicao(ticket, notificarPor || criado_por);
  }
  return ticket;
}

export async function atualizarTicket(id, patch, { notificarPor } = {}) {
  const atual = await obterTicket(id);
  if (!atual) return null;

  const titulo = patch.titulo != null ? String(patch.titulo).trim().slice(0, 500) : atual.titulo;
  const descricao = patch.descricao !== undefined ? (patch.descricao == null ? null : String(patch.descricao)) : atual.descricao;
  const status = patch.status && STATUS_TICKET.includes(patch.status) ? patch.status : atual.status;
  const prioridade =
    patch.prioridade && PRIORIDADES.includes(patch.prioridade) ? patch.prioridade : atual.prioridade;
  const area = patch.area != null ? String(patch.area).slice(0, 40) : atual.area;
  const responsavel_id =
    patch.responsavel_id !== undefined
      ? patch.responsavel_id == null
        ? null
        : Number(patch.responsavel_id)
      : atual.responsavel_id;
  const prazo =
    patch.prazo !== undefined ? normalizarPrazo(patch.prazo) : atual.prazo;
  const ordem = patch.ordem != null ? Number(patch.ordem) : atual.ordem;
  const concluido_em =
    status === 'feito' ? atual.concluido_em || new Date().toISOString() : status !== 'feito' ? null : atual.concluido_em;

  await pool.query(
    `UPDATE ti_tickets SET
       titulo = $2,
       descricao = $3,
       status = $4,
       prioridade = $5,
       area = $6,
       responsavel_id = $7,
       prazo = $8,
       ordem = $9,
       concluido_em = $10,
       updated_at = NOW()
     WHERE id_ticket = $1`,
    [id, titulo, descricao, status, prioridade, area, responsavel_id, prazo, ordem, concluido_em],
  );
  const ticket = await obterTicket(id);
  const mudouResp =
    responsavel_id != null && Number(responsavel_id) !== Number(atual.responsavel_id || 0);
  let atribuicao_notificada = false;
  if (mudouResp && ticket) {
    atribuicao_notificada = Boolean(await notificarAtribuicao(ticket, notificarPor || null));
  }
  return { ...ticket, atribuicao_notificada };
}

export async function moverTicket(id, status, ordem) {
  if (!STATUS_TICKET.includes(status)) throw new Error('Status inválido');
  const atual = await obterTicket(id);
  if (!atual) return null;
  let novaOrdem = ordem;
  if (novaOrdem == null) {
    const { rows } = await pool.query(
      `SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM ti_tickets WHERE status = $1 AND id_ticket <> $2`,
      [status, id],
    );
    novaOrdem = Number(rows[0]?.prox) || 1;
  }
  const concluido_em = status === 'feito' ? new Date().toISOString() : null;
  await pool.query(
    `UPDATE ti_tickets SET
       status = $2,
       ordem = $3,
       concluido_em = $4,
       updated_at = NOW()
     WHERE id_ticket = $1`,
    [id, status, novaOrdem, concluido_em],
  );
  return obterTicket(id);
}

export async function excluirTicket(id) {
  const { rowCount } = await pool.query(`DELETE FROM ti_tickets WHERE id_ticket = $1`, [id]);
  return rowCount > 0;
}

export async function listarComentarios(idTicket) {
  const { rows } = await pool.query(
    `SELECT c.id_comentario, c.id_ticket, c.id_usuario, c.texto, c.created_at, u.nome AS usuario_nome
     FROM ti_ticket_comentarios c
     LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
     WHERE c.id_ticket = $1
     ORDER BY c.created_at ASC`,
    [idTicket],
  );
  return rows.map((r) => ({
    id_comentario: Number(r.id_comentario),
    id_ticket: Number(r.id_ticket),
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    usuario_nome: r.usuario_nome || null,
    texto: r.texto,
    created_at: r.created_at,
  }));
}

export async function adicionarComentario(idTicket, idUsuario, texto) {
  const t = String(texto || '').trim();
  if (!t) throw new Error('Comentário vazio');
  const { rows } = await pool.query(
    `INSERT INTO ti_ticket_comentarios (id_ticket, id_usuario, texto)
     VALUES ($1, $2, $3)
     RETURNING id_comentario`,
    [idTicket, idUsuario, t],
  );
  const lista = await listarComentarios(idTicket);
  return lista.find((c) => c.id_comentario === Number(rows[0].id_comentario));
}

export async function excluirComentario(idComentario, idUsuario, { gerenciar = false } = {}) {
  const { rows } = await pool.query(
    `SELECT id_comentario, id_usuario FROM ti_ticket_comentarios WHERE id_comentario = $1`,
    [idComentario],
  );
  if (!rows[0]) return false;
  if (!gerenciar && Number(rows[0].id_usuario) !== Number(idUsuario)) {
    const err = new Error('Sem permissão para apagar este comentário');
    err.status = 403;
    throw err;
  }
  const { rowCount } = await pool.query(
    `DELETE FROM ti_ticket_comentarios WHERE id_comentario = $1`,
    [idComentario],
  );
  return rowCount > 0;
}

export async function avaliarTicket(id, idUsuario, { avaliacao, comentario }) {
  const ticket = await obterTicket(id);
  if (!ticket) return null;
  if (Number(ticket.criado_por) !== Number(idUsuario)) {
    const err = new Error('Somente quem abriu o chamado pode avaliar');
    err.status = 403;
    throw err;
  }
  if (ticket.status !== 'feito') {
    const err = new Error('Avalie somente após o chamado ser concluído');
    err.status = 400;
    throw err;
  }
  const nota = Number(avaliacao);
  if (!Number.isFinite(nota) || nota < 1 || nota > 5) {
    const err = new Error('Avaliação deve ser de 1 a 5');
    err.status = 400;
    throw err;
  }
  await pool.query(
    `UPDATE ti_tickets SET
       avaliacao = $2,
       avaliacao_comentario = $3,
       updated_at = NOW()
     WHERE id_ticket = $1`,
    [id, nota, comentario != null ? String(comentario).trim() : null],
  );
  return obterTicket(id);
}

function mapNota(row) {
  if (!row) return null;
  return {
    id_nota: Number(row.id_nota),
    titulo: row.titulo || 'Sem título',
    corpo: row.corpo || '',
    ordem: Number(row.ordem) || 0,
    atualizado_por: row.atualizado_por != null ? Number(row.atualizado_por) : null,
    atualizado_por_nome: row.atualizado_por_nome || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function obterNota(idNota) {
  const { rows } = await pool.query(
    `SELECT n.id_nota, n.titulo, n.corpo, n.ordem, n.atualizado_por, n.created_at, n.updated_at,
            u.nome AS atualizado_por_nome
     FROM ti_notas n
     LEFT JOIN usuarios u ON u.id_usuario = n.atualizado_por
     WHERE n.id_nota = $1`,
    [idNota],
  );
  return mapNota(rows[0]);
}

export async function listarNotas() {
  const { rows } = await pool.query(
    `SELECT n.id_nota, n.titulo, n.corpo, n.ordem, n.atualizado_por, n.created_at, n.updated_at,
            u.nome AS atualizado_por_nome
     FROM ti_notas n
     LEFT JOIN usuarios u ON u.id_usuario = n.atualizado_por
     ORDER BY n.ordem ASC, n.id_nota ASC`,
  );
  if (!rows.length) {
    const criada = await criarNota({ titulo: 'Anotações de reunião', corpo: '' }, null);
    return [criada];
  }
  return rows.map(mapNota);
}

/** @deprecated use listarNotas */
export async function obterNotaPrincipal() {
  const lista = await listarNotas();
  return lista[0];
}

export async function criarNota({ titulo, corpo = '' } = {}, idUsuario = null) {
  const { rows: ord } = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM ti_notas`,
  );
  const { rows } = await pool.query(
    `INSERT INTO ti_notas (titulo, corpo, ordem, atualizado_por)
     VALUES ($1, $2, $3, $4)
     RETURNING id_nota`,
    [
      String(titulo || 'Nova lista').trim().slice(0, 200) || 'Nova lista',
      corpo != null ? String(corpo) : '',
      Number(ord[0]?.prox) || 1,
      idUsuario,
    ],
  );
  return obterNota(rows[0].id_nota);
}

export async function salvarNota(idNota, { titulo, corpo }, idUsuario) {
  const atual = await obterNota(idNota);
  if (!atual) return null;
  await pool.query(
    `UPDATE ti_notas SET
       titulo = COALESCE($2, titulo),
       corpo = COALESCE($3, corpo),
       atualizado_por = $4,
       updated_at = NOW()
     WHERE id_nota = $1`,
    [
      idNota,
      titulo != null ? String(titulo).trim().slice(0, 200) : null,
      corpo != null ? String(corpo) : null,
      idUsuario,
    ],
  );
  return obterNota(idNota);
}

export async function excluirNota(idNota) {
  const { rowCount } = await pool.query(`DELETE FROM ti_notas WHERE id_nota = $1`, [idNota]);
  return rowCount > 0;
}

export async function listarAcessos() {
  const { rows } = await pool.query(
    `SELECT a.id_usuario, a.pode_gerenciar, a.concedido_por, a.created_at,
            u.nome, u.email,
            cg.nome AS concedido_por_nome
     FROM ti_ticket_acessos a
     JOIN usuarios u ON u.id_usuario = a.id_usuario
     LEFT JOIN usuarios cg ON cg.id_usuario = a.concedido_por
     ORDER BY u.nome`,
  );
  return rows.map((r) => ({
    id_usuario: Number(r.id_usuario),
    nome: r.nome,
    email: r.email,
    pode_gerenciar: Boolean(r.pode_gerenciar),
    concedido_por: r.concedido_por != null ? Number(r.concedido_por) : null,
    concedido_por_nome: r.concedido_por_nome || null,
    created_at: r.created_at,
  }));
}

export async function concederAcesso(idUsuario, concedidoPor) {
  await pool.query(
    `INSERT INTO ti_ticket_acessos (id_usuario, pode_gerenciar, concedido_por)
     VALUES ($1, TRUE, $2)
     ON CONFLICT (id_usuario) DO UPDATE SET
       pode_gerenciar = TRUE,
       concedido_por = EXCLUDED.concedido_por`,
    [idUsuario, concedidoPor],
  );
  await pool.query(
    `INSERT INTO usuario_permissoes (id_usuario, codigo)
     VALUES ($1, 'ti.tickets.gerenciar')
     ON CONFLICT DO NOTHING`,
    [idUsuario],
  );
  await pool.query(
    `INSERT INTO usuario_permissoes (id_usuario, codigo)
     VALUES ($1, 'ti.tickets.abrir')
     ON CONFLICT DO NOTHING`,
    [idUsuario],
  );
  return listarAcessos();
}

export async function revogarAcesso(idUsuario) {
  await pool.query(`DELETE FROM ti_ticket_acessos WHERE id_usuario = $1`, [idUsuario]);
  await pool.query(
    `DELETE FROM usuario_permissoes WHERE id_usuario = $1 AND codigo = 'ti.tickets.gerenciar'`,
    [idUsuario],
  );
  return listarAcessos();
}
