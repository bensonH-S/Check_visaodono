import { pool } from './db.js';
import { veTodasLojas } from './auth.js';

/** Carrega IDs de lojas do usuário (admin/ti = todas ativas). */
export async function carregarLojasIds(perfil, idUsuario) {
  if (veTodasLojas(perfil)) {
    const { rows } = await pool.query(
      'SELECT id_loja FROM lojas WHERE is_active = TRUE ORDER BY id_loja',
    );
    return rows.map((r) => r.id_loja);
  }
  const { rows } = await pool.query(
    `SELECT ul.id_loja
     FROM usuario_lojas ul
     JOIN lojas l ON l.id_loja = ul.id_loja AND l.is_active = TRUE
     WHERE ul.id_usuario = $1
     ORDER BY l.name`,
    [idUsuario],
  );
  return rows.map((r) => r.id_loja);
}

export async function carregarLojasDetalhe(perfil, idUsuario) {
  if (veTodasLojas(perfil)) {
    const { rows } = await pool.query(
      `SELECT id_loja, name AS nome, bk_number AS codigo_bkn
       FROM lojas WHERE is_active = TRUE ORDER BY name`,
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT l.id_loja, l.name AS nome, l.bk_number AS codigo_bkn
     FROM usuario_lojas ul
     JOIN lojas l ON l.id_loja = ul.id_loja
     WHERE ul.id_usuario = $1 AND l.is_active = TRUE
     ORDER BY l.name`,
    [idUsuario],
  );
  return rows;
}

/** Middleware: req.user.lojas_ids após JWT. */
export async function attachLojasUsuario(req, _res, next) {
  if (!req.user?.sub) return next();
  try {
    req.user.lojas_ids = await carregarLojasIds(req.user.perfil, req.user.sub);
    next();
  } catch (e) {
    next(e);
  }
}

/** SQL `AND alias.col = ANY($n)` + parâmetro, ou vazio se vê tudo. */
export function filtroSqlLojas(user, alias, col, params) {
  if (veTodasLojas(user.perfil)) return '';
  const ids = user.lojas_ids || [];
  if (!ids.length) return ' AND FALSE';
  params.push(ids);
  const colRef = alias ? `${alias}.${col}` : col;
  return ` AND ${colRef} = ANY($${params.length})`;
}

export function usuarioPodeLoja(user, idLoja) {
  if (veTodasLojas(user.perfil)) return true;
  return (user.lojas_ids || []).includes(Number(idLoja));
}

export async function syncUsuarioLojas(idUsuario, perfil, lojasIds) {
  await pool.query('DELETE FROM usuario_lojas WHERE id_usuario = $1', [idUsuario]);
  if (veTodasLojas(perfil)) return;
  const ids = [...new Set((lojasIds || []).map(Number).filter(Boolean))];
  for (const idLoja of ids) {
    await pool.query(
      `INSERT INTO usuario_lojas (id_usuario, id_loja) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idUsuario, idLoja],
    );
  }
}
