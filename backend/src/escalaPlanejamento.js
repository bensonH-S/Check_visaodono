import { pool } from './db.js';
import { segundaFeiraDaSemana, podeVerEscalaGestores, podeGerenciarEscalaVisitas } from './escalaVisitas.js';

const TIPOS = new Set(['audiencia', 'reuniao', 'congresso', 'treinamento']);

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function tipoOk(v) {
  const t = String(v || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  if (t === 'audiencia' || t === 'audiência') return 'audiencia';
  if (TIPOS.has(t)) return t;
  return null;
}

export async function listarPlanejamento(user, { semana_inicio, id_loja } = {}) {
  if (!podeVerEscalaGestores(user) && !podeGerenciarEscalaVisitas(user)) {
    throw Object.assign(new Error('Sem permissão para ver o planejamento'), { status: 403 });
  }
  const inicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const fim = addDaysIso(inicio, 6);
  const params = [inicio, fim];
  let filtroLoja = '';
  if (id_loja != null && Number(id_loja) > 0) {
    params.push(Number(id_loja));
    filtroLoja = ` AND e.id_loja = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT e.id_evento, e.id_loja, e.data::text AS data, e.tipo, e.observacao,
            e.criado_por, e.created_at, e.updated_at,
            l.name AS nome_loja, l.bk_number,
            u.nome AS criado_por_nome
     FROM escala_planejamento_evento e
     JOIN lojas l ON l.id_loja = e.id_loja
     LEFT JOIN usuarios u ON u.id_usuario = e.criado_por
     WHERE e.data >= $1::date AND e.data <= $2::date
       ${filtroLoja}
     ORDER BY e.data ASC, e.id_evento ASC`,
    params,
  );
  return {
    semana_inicio: inicio,
    semana_fim: fim,
    pode_editar: podeGerenciarEscalaVisitas(user),
    eventos: rows.map((r) => ({
      id_evento: Number(r.id_evento),
      id_loja: Number(r.id_loja),
      data: String(r.data).slice(0, 10),
      tipo: r.tipo,
      observacao: r.observacao || '',
      criado_por: r.criado_por != null ? Number(r.criado_por) : null,
      criado_por_nome: r.criado_por_nome || null,
      nome_loja: r.nome_loja,
      bk_number: r.bk_number,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  };
}

export async function criarEventoPlanejamento(user, body) {
  if (!podeGerenciarEscalaVisitas(user)) {
    throw Object.assign(new Error('Sem permissão para editar o planejamento'), { status: 403 });
  }
  const idLoja = Number(body?.id_loja);
  const tipo = tipoOk(body?.tipo);
  const data = String(body?.data || '').slice(0, 10);
  const observacao = String(body?.observacao || '').trim() || null;
  if (!idLoja) {
    throw Object.assign(new Error('Informe a loja'), { status: 400 });
  }
  if (!tipo) {
    throw Object.assign(new Error('Tipo inválido'), { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw Object.assign(new Error('Data inválida'), { status: 400 });
  }
  const { rows: loja } = await pool.query(
    `SELECT id_loja FROM lojas WHERE id_loja = $1 AND is_active = TRUE`,
    [idLoja],
  );
  if (!loja[0]) {
    throw Object.assign(new Error('Loja não encontrada'), { status: 404 });
  }
  const { rows } = await pool.query(
    `INSERT INTO escala_planejamento_evento (id_loja, data, tipo, observacao, criado_por)
     VALUES ($1, $2::date, $3, $4, $5)
     RETURNING id_evento`,
    [idLoja, data, tipo, observacao, user?.sub || null],
  );
  const semana = segundaFeiraDaSemana(data);
  return listarPlanejamento(user, { semana_inicio: semana, id_loja: body?.filtrar_loja ? idLoja : undefined });
}

export async function atualizarEventoPlanejamento(user, idEvento, body) {
  if (!podeGerenciarEscalaVisitas(user)) {
    throw Object.assign(new Error('Sem permissão para editar o planejamento'), { status: 403 });
  }
  const id = Number(idEvento);
  if (!id) {
    throw Object.assign(new Error('Evento inválido'), { status: 400 });
  }
  const { rows: atual } = await pool.query(
    `SELECT id_evento, data::text AS data FROM escala_planejamento_evento WHERE id_evento = $1`,
    [id],
  );
  if (!atual[0]) {
    throw Object.assign(new Error('Evento não encontrado'), { status: 404 });
  }
  const tipo =
    body?.tipo !== undefined ? tipoOk(body.tipo) : undefined;
  if (body?.tipo !== undefined && !tipo) {
    throw Object.assign(new Error('Tipo inválido'), { status: 400 });
  }
  const data =
    body?.data !== undefined ? String(body.data || '').slice(0, 10) : undefined;
  if (data !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw Object.assign(new Error('Data inválida'), { status: 400 });
  }
  const observacao =
    body?.observacao !== undefined ? String(body.observacao || '').trim() || null : undefined;
  const idLoja =
    body?.id_loja !== undefined ? Number(body.id_loja) || null : undefined;

  await pool.query(
    `UPDATE escala_planejamento_evento SET
       id_loja = COALESCE($2, id_loja),
       data = COALESCE($3::date, data),
       tipo = COALESCE($4, tipo),
       observacao = COALESCE($5, observacao),
       updated_at = NOW()
     WHERE id_evento = $1`,
    [id, idLoja, data || null, tipo || null, observacao],
  );
  const semana = segundaFeiraDaSemana(data || atual[0].data);
  return listarPlanejamento(user, { semana_inicio: semana });
}

export async function excluirEventoPlanejamento(user, idEvento) {
  if (!podeGerenciarEscalaVisitas(user)) {
    throw Object.assign(new Error('Sem permissão para editar o planejamento'), { status: 403 });
  }
  const id = Number(idEvento);
  const { rows } = await pool.query(
    `DELETE FROM escala_planejamento_evento WHERE id_evento = $1
     RETURNING data::text AS data`,
    [id],
  );
  if (!rows[0]) {
    throw Object.assign(new Error('Evento não encontrado'), { status: 404 });
  }
  return listarPlanejamento(user, { semana_inicio: segundaFeiraDaSemana(rows[0].data) });
}
