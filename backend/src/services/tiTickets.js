import { pool } from '../db.js';
import { temPermissao } from '../permissoes.js';
import { encryptAnexo, decryptAnexo } from '../fotos.js';

export const STATUS_TICKET = ['chamado', 'fazer', 'pendente', 'feito'];
export const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'];
export const CATEGORIAS_TICKET = [
  { id: 'geral', label: 'Geral', slaMinutos: 72 * 60 },
  { id: 'tecnologia', label: 'Tecnologia', slaMinutos: 24 * 60 },
  { id: 'financeiro', label: 'Financeiro', slaMinutos: 30 },
  { id: 'frota', label: 'Frota', slaMinutos: 24 * 60 },
  { id: 'operacoes', label: 'Operações', slaMinutos: 24 * 60 },
  { id: 'vendas', label: 'Vendas', slaMinutos: 30 },
  { id: 'estoque', label: 'Estoque', slaMinutos: 30 },
  { id: 'manutencao', label: 'Manutenção', slaMinutos: 24 * 60 },
  { id: 'rh', label: 'Recursos Humanos', slaMinutos: 6 * 60 },
];

const CATEGORIA_POR_ID = new Map(CATEGORIAS_TICKET.map((categoria) => [categoria.id, categoria]));

function normalizarCategoria(valor) {
  const id = String(valor || 'geral').trim().toLowerCase();
  return CATEGORIA_POR_ID.has(id) ? id : 'geral';
}

function formatarSlaDuracao(minutos) {
  const m = Math.max(0, Math.round(Number(minutos) || 0));
  if (m < 60) return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.round(m / 60);
  if (m % 60 === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function calcularPrazoSla(categoria, dataBase = new Date()) {
  const config = CATEGORIA_POR_ID.get(normalizarCategoria(categoria)) || CATEGORIA_POR_ID.get('geral');
  const data = new Date(dataBase);
  data.setMinutes(data.getMinutes() + (config.slaMinutos || 0));
  return data.toISOString();
}

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
  const categoria = normalizarCategoria(row.area);
  const categoriaConfig = CATEGORIA_POR_ID.get(categoria);
  const prazo =
    row.prazo == null
      ? null
      : typeof row.prazo === 'string'
        ? row.prazo
        : row.prazo.toISOString?.() || String(row.prazo);
  return {
    id_ticket: Number(row.id_ticket),
    titulo: row.titulo,
    descricao: row.descricao || '',
    status,
    prioridade: row.prioridade,
    area: categoria,
    categoria_label: categoriaConfig?.label || 'Geral',
    sla_minutos: categoriaConfig?.slaMinutos || 72 * 60,
    sla_label: formatarSlaDuracao(categoriaConfig?.slaMinutos || 72 * 60),
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
    const prazoFmt = ticket.prazo
      ? (() => {
          const [y, m, d] = String(ticket.prazo).slice(0, 10).split('-');
          return d && m ? `${d}/${m}` : ticket.prazo;
        })()
      : '';

    // Destinatário (responsável)
    if (Number(ticket.responsavel_id) !== Number(atribuidoPorId)) {
      await criarPortalNotificacao({
        idUsuario: ticket.responsavel_id,
        tipo: 'ti_atribuicao',
        titulo: ticket.titulo,
        mensagem: [nomeQuem, prazoFmt ? `Prazo ${prazoFmt}` : null].filter(Boolean).join(' · '),
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
        titulo: ticket.titulo,
        mensagem: `Para ${ticket.responsavel_nome || 'responsável'}`,
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
       CASE WHEN t.status IN ('chamado', 'backlog') THEN t.created_at END DESC,
       t.ordem ASC,
       t.id_ticket DESC`,
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
  const raw = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T23:59:59`).toISOString();
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
  const categoria = normalizarCategoria(area);
  const pz = normalizarPrazo(prazo) ?? calcularPrazoSla(categoria);
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
      categoria,
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
  const area = patch.area != null ? normalizarCategoria(patch.area) : atual.area;
  const responsavel_id =
    patch.responsavel_id !== undefined
      ? patch.responsavel_id == null
        ? null
        : Number(patch.responsavel_id)
      : atual.responsavel_id;
  let prazo;
  if (patch.prazo !== undefined) {
    prazo = normalizarPrazo(patch.prazo);
  } else if (patch.area != null && area !== atual.area) {
    prazo = calcularPrazoSla(area, atual.created_at || new Date());
  } else {
    prazo = atual.prazo;
  }
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

const MAX_NOTAS_COLABORADOR = 2;

function mapNota(row) {
  if (!row) return null;
  return {
    id_nota: Number(row.id_nota),
    titulo: row.titulo || 'Sem título',
    corpo: row.corpo || '',
    ordem: Number(row.ordem) || 0,
    id_usuario: row.id_usuario != null ? Number(row.id_usuario) : null,
    dono_nome: row.dono_nome || null,
    atualizado_por: row.atualizado_por != null ? Number(row.atualizado_por) : null,
    atualizado_por_nome: row.atualizado_por_nome || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SQL_NOTA = `SELECT n.id_nota, n.titulo, n.corpo, n.ordem, n.id_usuario, n.atualizado_por,
            n.created_at, n.updated_at,
            u.nome AS atualizado_por_nome,
            d.nome AS dono_nome
     FROM ti_notas n
     LEFT JOIN usuarios u ON u.id_usuario = n.atualizado_por
     LEFT JOIN usuarios d ON d.id_usuario = n.id_usuario`;

export async function obterNota(idNota) {
  const { rows } = await pool.query(`${SQL_NOTA} WHERE n.id_nota = $1`, [idNota]);
  return mapNota(rows[0]);
}

export async function listarNotas(user) {
  const ti = user ? await usuarioPodeGerenciarTickets(user) : false;
  const uid = Number(user?.sub);
  let rows;
  if (ti) {
    ({ rows } = await pool.query(`${SQL_NOTA} ORDER BY n.ordem ASC, n.id_nota ASC`));
  } else if (Number.isFinite(uid)) {
    ({ rows } = await pool.query(
      `${SQL_NOTA}
       WHERE n.id_usuario = $1
       ORDER BY n.ordem ASC, n.id_nota ASC`,
      [uid],
    ));
  } else {
    rows = [];
  }
  if (!rows.length && Number.isFinite(uid)) {
    const criada = await criarNota({ titulo: 'Minhas anotações', corpo: '' }, uid, { forcar: true });
    return [criada];
  }
  return rows.map(mapNota);
}

/** @deprecated use listarNotas */
export async function obterNotaPrincipal(user) {
  const lista = await listarNotas(user);
  return lista[0];
}

export async function criarNota(
  { titulo, corpo = '' } = {},
  idUsuario = null,
  { forcar = false, isTi = false } = {},
) {
  const uid = idUsuario != null ? Number(idUsuario) : null;
  if (Number.isFinite(uid) && !forcar && !isTi) {
    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ti_notas WHERE id_usuario = $1`,
      [uid],
    );
    if ((cnt[0]?.n || 0) >= MAX_NOTAS_COLABORADOR) {
      const err = new Error(`Você pode ter no máximo ${MAX_NOTAS_COLABORADOR} anotações`);
      err.status = 400;
      throw err;
    }
  }

  const { rows: ord } = await pool.query(
    `SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM ti_notas`,
  );
  const { rows } = await pool.query(
    `INSERT INTO ti_notas (titulo, corpo, ordem, atualizado_por, id_usuario)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_nota`,
    [
      String(titulo || 'Nova lista').trim().slice(0, 200) || 'Nova lista',
      corpo != null ? String(corpo) : '',
      Number(ord[0]?.prox) || 1,
      uid,
      uid,
    ],
  );
  return obterNota(rows[0].id_nota);
}

export async function salvarNota(idNota, { titulo, corpo }, idUsuario, { isTi = false } = {}) {
  const atual = await obterNota(idNota);
  if (!atual) return null;
  const uid = Number(idUsuario);
  if (!isTi && atual.id_usuario != null && atual.id_usuario !== uid) {
    const err = new Error('Sem permissão para editar esta anotação');
    err.status = 403;
    throw err;
  }
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
      uid,
    ],
  );
  return obterNota(idNota);
}

export async function excluirNota(idNota, idUsuario, { isTi = false } = {}) {
  const atual = await obterNota(idNota);
  if (!atual) return false;
  const uid = Number(idUsuario);
  if (!isTi && atual.id_usuario != null && atual.id_usuario !== uid) {
    const err = new Error('Sem permissão para excluir esta anotação');
    err.status = 403;
    throw err;
  }
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

const APP_BASE_PATH = '/auditoria';
const MAX_ANEXOS_TICKET = 10;
const MAX_ANEXO_BYTES = 12 * 1024 * 1024;
const MIME_ANEXO_PERMITIDOS = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

export function mimeAnexoPermitido(mime) {
  const m = String(mime || '').toLowerCase();
  return m.startsWith('image/') || MIME_ANEXO_PERMITIDOS.has(m);
}

function midiaUrlTicketAnexo(idAnexo) {
  return `${APP_BASE_PATH}/api/ti-tickets/anexos/${idAnexo}/media`;
}

function mapAnexo(row) {
  if (!row) return null;
  return {
    id_anexo: Number(row.id_anexo),
    id_ticket: Number(row.id_ticket),
    id_usuario: row.id_usuario != null ? Number(row.id_usuario) : null,
    usuario_nome: row.usuario_nome || null,
    nome_arquivo: row.nome_arquivo,
    tipo_mime: row.tipo_mime,
    tamanho_bytes: Number(row.tamanho_bytes) || 0,
    created_at: row.created_at,
    media_url: midiaUrlTicketAnexo(row.id_anexo),
  };
}

export async function listarAnexos(idTicket) {
  const { rows } = await pool.query(
    `SELECT a.id_anexo, a.id_ticket, a.id_usuario, a.nome_arquivo, a.tipo_mime,
            a.tamanho_bytes, a.created_at, u.nome AS usuario_nome
     FROM ti_ticket_anexos a
     LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
     WHERE a.id_ticket = $1
     ORDER BY a.created_at ASC, a.id_anexo ASC`,
    [idTicket],
  );
  return rows.map(mapAnexo);
}

export async function obterAnexoBinario(idAnexo) {
  const { rows } = await pool.query(
    `SELECT a.id_anexo, a.id_ticket, a.tipo_mime, a.nome_arquivo, a.arquivo_bytes,
            t.criado_por, t.responsavel_id
     FROM ti_ticket_anexos a
     JOIN ti_tickets t ON t.id_ticket = a.id_ticket
     WHERE a.id_anexo = $1`,
    [idAnexo],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id_anexo: Number(row.id_anexo),
    id_ticket: Number(row.id_ticket),
    tipo_mime: row.tipo_mime,
    nome_arquivo: row.nome_arquivo,
    criado_por: row.criado_por != null ? Number(row.criado_por) : null,
    responsavel_id: row.responsavel_id != null ? Number(row.responsavel_id) : null,
    buffer: decryptAnexo(row.arquivo_bytes),
  };
}

function parseDataUrlOuBase64(payload, mimeHint) {
  if (payload == null) return null;
  const raw = String(payload).trim();
  if (!raw) return null;
  const data = raw.match(/^data:([^;]+);base64,(.+)$/s);
  if (data) {
    return { mime: data[1], buffer: Buffer.from(data[2], 'base64') };
  }
  if (!mimeHint) return null;
  return { mime: String(mimeHint), buffer: Buffer.from(raw, 'base64') };
}

export async function adicionarAnexo(idTicket, { nome_arquivo, tipo_mime, data_url, base64, id_usuario }) {
  const ticket = await obterTicket(idTicket);
  if (!ticket) {
    const err = new Error('Ticket não encontrado');
    err.status = 404;
    throw err;
  }

  const { rows: cnt } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ti_ticket_anexos WHERE id_ticket = $1`,
    [idTicket],
  );
  if ((cnt[0]?.n || 0) >= MAX_ANEXOS_TICKET) {
    const err = new Error(`Máximo de ${MAX_ANEXOS_TICKET} anexos por ticket`);
    err.status = 400;
    throw err;
  }

  const parsed = parseDataUrlOuBase64(data_url || base64, tipo_mime);
  if (!parsed?.buffer?.length) {
    const err = new Error('Arquivo inválido');
    err.status = 400;
    throw err;
  }
  if (parsed.buffer.length > MAX_ANEXO_BYTES) {
    const err = new Error('Arquivo muito grande (máx. 12 MB)');
    err.status = 400;
    throw err;
  }
  const mime = String(tipo_mime || parsed.mime || '').toLowerCase();
  if (!mimeAnexoPermitido(mime)) {
    const err = new Error('Tipo de arquivo não permitido. Use imagem, PDF ou documento Office.');
    err.status = 400;
    throw err;
  }

  const nome = String(nome_arquivo || 'anexo').trim().slice(0, 255) || 'anexo';
  const criptografado = encryptAnexo(parsed.buffer);
  const { rows } = await pool.query(
    `INSERT INTO ti_ticket_anexos (id_ticket, id_usuario, nome_arquivo, tipo_mime, arquivo_bytes, tamanho_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_anexo`,
    [idTicket, id_usuario || null, nome, mime, criptografado, parsed.buffer.length],
  );
  const lista = await listarAnexos(idTicket);
  return lista.find((a) => a.id_anexo === Number(rows[0].id_anexo));
}

export async function excluirAnexo(idAnexo) {
  const { rows } = await pool.query(
    `SELECT id_anexo, id_ticket FROM ti_ticket_anexos WHERE id_anexo = $1`,
    [idAnexo],
  );
  if (!rows[0]) return null;
  await pool.query(`DELETE FROM ti_ticket_anexos WHERE id_anexo = $1`, [idAnexo]);
  return { id_anexo: Number(rows[0].id_anexo), id_ticket: Number(rows[0].id_ticket) };
}

