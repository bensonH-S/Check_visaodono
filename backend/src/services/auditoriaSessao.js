/**
 * Sessões ativas + trilha de navegação (abas/rotas).
 * Complementa sistema_auditoria (mutações) com tempo conectado e mapa de uso.
 */
import { pool } from '../db.js';
import { logger } from '../logger.js';

export function ipDe(req) {
  const xf = req?.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim().slice(0, 80);
  return String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 80) || null;
}

export function uaDe(req) {
  return String(req?.headers?.['user-agent'] || '').slice(0, 400) || null;
}

function dispositivoDe(ua) {
  if (!ua) return null;
  const s = ua.toLowerCase();
  if (/mobile|android|iphone|ipad/.test(s)) return 'mobile';
  if (/tablet/.test(s)) return 'tablet';
  return 'desktop';
}

function idUsuarioDe(req) {
  const n = Number(req?.user?.sub);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Inicia sessão de navegação. Fecha órfãs abertas há mais de 12h. */
export async function iniciarSessao(req, { origem = 'app' } = {}) {
  const idUsuario = idUsuarioDe(req);
  if (!idUsuario) return null;

  const ua = uaDe(req);
  const ip = ipDe(req);

  try {
    await pool.query(
      `UPDATE sistema_sessoes
          SET encerrada_em = NOW(),
              duracao_segundos = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - iniciada_em))::INT),
              ultimo_ping_em = NOW()
        WHERE id_usuario = $1
          AND encerrada_em IS NULL
          AND iniciada_em < NOW() - INTERVAL '12 hours'`,
      [idUsuario],
    );

    const { rows } = await pool.query(
      `INSERT INTO sistema_sessoes (id_usuario, ip, user_agent, dispositivo, origem)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_sessao, iniciada_em`,
      [idUsuario, ip, ua, dispositivoDe(ua), String(origem || 'app').slice(0, 40)],
    );
    return rows[0] || null;
  } catch (e) {
    logger.warn('auditoria', 'Falha ao iniciar sessão', { error: e?.message });
    return null;
  }
}

export async function pingSessao(req, idSessao) {
  const idUsuario = idUsuarioDe(req);
  const id = Number(idSessao);
  if (!idUsuario || !Number.isFinite(id) || id <= 0) return null;

  try {
    const { rows } = await pool.query(
      `UPDATE sistema_sessoes
          SET ultimo_ping_em = NOW()
        WHERE id_sessao = $1
          AND id_usuario = $2
          AND encerrada_em IS NULL
        RETURNING id_sessao, iniciada_em, ultimo_ping_em`,
      [id, idUsuario],
    );
    return rows[0] || null;
  } catch (e) {
    logger.warn('auditoria', 'Falha no ping de sessão', { error: e?.message });
    return null;
  }
}

export async function encerrarSessao(req, idSessao) {
  const idUsuario = idUsuarioDe(req);
  const id = Number(idSessao);
  if (!idUsuario || !Number.isFinite(id) || id <= 0) return null;

  try {
    await pool.query(
      `UPDATE sistema_navegacao
          SET saiu_em = NOW(),
              duracao_segundos = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - entrou_em))::INT)
        WHERE id_sessao = $1
          AND id_usuario = $2
          AND saiu_em IS NULL`,
      [id, idUsuario],
    );

    const { rows } = await pool.query(
      `UPDATE sistema_sessoes
          SET encerrada_em = NOW(),
              ultimo_ping_em = NOW(),
              duracao_segundos = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - iniciada_em))::INT)
        WHERE id_sessao = $1
          AND id_usuario = $2
          AND encerrada_em IS NULL
        RETURNING id_sessao, iniciada_em, encerrada_em, duracao_segundos`,
      [id, idUsuario],
    );
    return rows[0] || null;
  } catch (e) {
    logger.warn('auditoria', 'Falha ao encerrar sessão', { error: e?.message });
    return null;
  }
}

/** Registra entrada em rota/aba. Fecha a navegação anterior da mesma sessão. */
export async function registrarNavegacao(req, { idSessao, rota, titulo } = {}) {
  const idUsuario = idUsuarioDe(req);
  const path = String(rota || '').trim().slice(0, 400);
  if (!path || !idUsuario) return null;

  let id = Number(idSessao);
  try {
    let ping = Number.isFinite(id) && id > 0 ? await pingSessao(req, id) : null;
    if (!ping) {
      const nova = await iniciarSessao(req, { origem: 'navegacao' });
      if (!nova?.id_sessao) return null;
      id = Number(nova.id_sessao);
    }

    await pool.query(
      `UPDATE sistema_navegacao
          SET saiu_em = NOW(),
              duracao_segundos = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - entrou_em))::INT)
        WHERE id_sessao = $1
          AND id_usuario = $2
          AND saiu_em IS NULL`,
      [id, idUsuario],
    );

    const { rows } = await pool.query(
      `INSERT INTO sistema_navegacao (id_sessao, id_usuario, rota, titulo)
       VALUES ($1, $2, $3, $4)
       RETURNING id_navegacao, id_sessao, rota, titulo, entrou_em`,
      [id, idUsuario, path, titulo ? String(titulo).slice(0, 200) : null],
    );
    return rows[0] || null;
  } catch (e) {
    logger.warn('auditoria', 'Falha ao registrar navegação', { error: e?.message });
    return null;
  }
}

export async function listarSessoes({
  page = 1,
  pageSize = 50,
  idUsuario = null,
  de = null,
  ate = null,
  apenasAbertas = false,
} = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (idUsuario) {
    where.push(`s.id_usuario = $${i++}`);
    params.push(Number(idUsuario));
  }
  if (de) {
    where.push(`s.iniciada_em >= $${i++}::timestamptz`);
    params.push(de);
  }
  if (ate) {
    where.push(`s.iniciada_em <= $${i++}::timestamptz`);
    params.push(ate);
  }
  if (apenasAbertas) {
    where.push(`s.encerrada_em IS NULL`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * pageSize;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM sistema_sessoes s ${whereSql}`,
    params,
  );

  const { rows } = await pool.query(
    `SELECT
       s.id_sessao,
       s.id_usuario,
       u.nome AS usuario_nome,
       u.email AS usuario_email,
       s.iniciada_em,
       s.ultimo_ping_em,
       s.encerrada_em,
       COALESCE(
         s.duracao_segundos,
         GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(s.encerrada_em, s.ultimo_ping_em, NOW()) - s.iniciada_em))::INT)
       ) AS duracao_segundos,
       s.ip,
       s.dispositivo,
       s.origem,
       (s.encerrada_em IS NULL) AS aberta,
       (SELECT COUNT(*)::int FROM sistema_navegacao n WHERE n.id_sessao = s.id_sessao) AS navegacoes
     FROM sistema_sessoes s
     LEFT JOIN usuarios u ON u.id_usuario = s.id_usuario
     ${whereSql}
     ORDER BY s.iniciada_em DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, pageSize, offset],
  );

  return { items: rows, total: countRes.rows[0]?.total || 0, page, pageSize };
}

export async function listarNavegacao({
  page = 1,
  pageSize = 80,
  idUsuario = null,
  idSessao = null,
  de = null,
  ate = null,
  rota = null,
} = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (idUsuario) {
    where.push(`n.id_usuario = $${i++}`);
    params.push(Number(idUsuario));
  }
  if (idSessao) {
    where.push(`n.id_sessao = $${i++}`);
    params.push(Number(idSessao));
  }
  if (de) {
    where.push(`n.entrou_em >= $${i++}::timestamptz`);
    params.push(de);
  }
  if (ate) {
    where.push(`n.entrou_em <= $${i++}::timestamptz`);
    params.push(ate);
  }
  if (rota) {
    where.push(`n.rota ILIKE $${i++}`);
    params.push(`%${String(rota).trim()}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * pageSize;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM sistema_navegacao n ${whereSql}`,
    params,
  );

  const { rows } = await pool.query(
    `SELECT
       n.id_navegacao,
       n.id_sessao,
       n.id_usuario,
       u.nome AS usuario_nome,
       u.email AS usuario_email,
       n.rota,
       n.titulo,
       n.entrou_em,
       n.saiu_em,
       COALESCE(
         n.duracao_segundos,
         CASE WHEN n.saiu_em IS NOT NULL
           THEN GREATEST(0, EXTRACT(EPOCH FROM (n.saiu_em - n.entrou_em))::INT)
           ELSE NULL
         END
       ) AS duracao_segundos
     FROM sistema_navegacao n
     LEFT JOIN usuarios u ON u.id_usuario = n.id_usuario
     ${whereSql}
     ORDER BY n.entrou_em DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, pageSize, offset],
  );

  return { items: rows, total: countRes.rows[0]?.total || 0, page, pageSize };
}
