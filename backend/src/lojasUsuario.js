import { pool } from './db.js';
import { acessoTodasLojas, temPermissao } from './permissoes.js';

async function lojasUsuarioBase(idUsuario) {
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

/** Lojas das regiões em que o usuário é técnico vinculado ou regional (supervisor). */
async function lojasRegiaoUsuario(idUsuario) {
  const { rows } = await pool.query(
    `SELECT DISTINCT rl.id_loja
     FROM frota_regioes r
     JOIN frota_regiao_lojas rl ON rl.id_regiao = r.id_regiao
     JOIN lojas l ON l.id_loja = rl.id_loja AND l.is_active = TRUE
     WHERE r.ativo = TRUE
       AND (
         EXISTS (
           SELECT 1 FROM frota_regiao_tecnicos rt
           WHERE rt.id_regiao = r.id_regiao AND rt.id_usuario = $1
         )
         OR r.id_regional = $1
       )`,
    [idUsuario],
  );
  return rows.map((r) => r.id_loja);
}

function unirIdsLojas(...listas) {
  return [...new Set(listas.flat().map(Number).filter(Boolean))];
}

export async function carregarLojasIds(user) {
  if (acessoTodasLojas(user)) {
    const { rows } = await pool.query(
      'SELECT id_loja FROM lojas WHERE is_active = TRUE ORDER BY id_loja',
    );
    return rows.map((r) => r.id_loja);
  }
  let ids = await lojasUsuarioBase(user.sub);
  const escopoRegiao =
    temPermissao(user, 'chamados.assumir') || temPermissao(user, 'frota.regioes');
  if (escopoRegiao) {
    ids = unirIdsLojas(ids, await lojasRegiaoUsuario(user.sub));
  }
  return ids;
}

export async function carregarLojasDetalhe(user) {
  if (acessoTodasLojas(user)) {
    const { rows } = await pool.query(
      `SELECT id_loja, name AS nome, bk_number AS codigo_bkn
       FROM lojas WHERE is_active = TRUE ORDER BY name`,
    );
    return rows;
  }
  const ids = await carregarLojasIds(user);
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT id_loja, name AS nome, bk_number AS codigo_bkn
     FROM lojas WHERE id_loja = ANY($1::int[]) AND is_active = TRUE
     ORDER BY name`,
    [ids],
  );
  return rows;
}

/** Regiões em que o usuário é técnico vinculado ou regional (supervisor). */
export async function carregarRegioesAtuacaoTecnico(idUsuario) {
  const { rows } = await pool.query(
    `SELECT DISTINCT r.id_regiao, r.nome, ur.nome AS nome_regional
     FROM frota_regioes r
     LEFT JOIN usuarios ur ON ur.id_usuario = r.id_regional
     WHERE r.ativo = TRUE
       AND (
         EXISTS (
           SELECT 1 FROM frota_regiao_tecnicos rt
           WHERE rt.id_regiao = r.id_regiao AND rt.id_usuario = $1
         )
         OR r.id_regional = $1
       )
     ORDER BY r.nome`,
    [idUsuario],
  );
  return rows.map((r) => ({
    id_regiao: r.id_regiao,
    nome: r.nome,
    nome_regional: r.nome_regional || null,
  }));
}

export async function attachLojasUsuario(req, _res, next) {
  if (!req.user?.sub) return next();
  try {
    req.user.lojas_ids = await carregarLojasIds(req.user);
    next();
  } catch (e) {
    next(e);
  }
}

export function filtroSqlLojas(user, alias, col, params) {
  if (acessoTodasLojas(user)) return '';
  const ids = user.lojas_ids || [];
  if (!ids.length) return ' AND FALSE';
  params.push(ids);
  const colRef = alias ? `${alias}.${col}` : col;
  return ` AND ${colRef} = ANY($${params.length})`;
}

export function usuarioPodeLoja(user, idLoja) {
  if (acessoTodasLojas(user)) return true;
  return (user.lojas_ids || []).includes(Number(idLoja));
}

/**
 * SQL: usuário deve receber notificação de chamado da loja (parâmetro id_loja).
 * - lojas.todas: todas
 * - assumir / frota.regioes: lojas da região (técnico ou supervisor regional)
 * - demais (gerente/coordenador): só usuario_lojas
 */
export function sqlUsuarioAtendeLojaNotificacao(aliasUsuario, paramLoja) {
  return `(
    EXISTS (
      SELECT 1 FROM usuario_permissoes upT
      WHERE upT.id_usuario = ${aliasUsuario} AND upT.codigo = 'lojas.todas'
    )
    OR (
      EXISTS (
        SELECT 1 FROM usuario_permissoes upR
        WHERE upR.id_usuario = ${aliasUsuario}
          AND upR.codigo IN ('chamados.assumir', 'frota.regioes')
      )
      AND EXISTS (
        SELECT 1
        FROM frota_regiao_lojas rl
        JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
        WHERE rl.id_loja = ${paramLoja}
          AND (
            EXISTS (
              SELECT 1 FROM frota_regiao_tecnicos rt
              WHERE rt.id_regiao = r.id_regiao AND rt.id_usuario = ${aliasUsuario}
            )
            OR r.id_regional = ${aliasUsuario}
          )
      )
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM usuario_permissoes upR
        WHERE upR.id_usuario = ${aliasUsuario}
          AND upR.codigo IN ('chamados.assumir', 'frota.regioes')
      )
      AND EXISTS (
        SELECT 1 FROM usuario_lojas ul
        WHERE ul.id_usuario = ${aliasUsuario} AND ul.id_loja = ${paramLoja}
      )
    )
  )`;
}

export async function syncUsuarioLojas(idUsuario, lojasIds, temTodasLojas) {
  await pool.query('DELETE FROM usuario_lojas WHERE id_usuario = $1', [idUsuario]);
  if (temTodasLojas) return;
  const ids = [...new Set((lojasIds || []).map(Number).filter(Boolean))];
  for (const idLoja of ids) {
    await pool.query(
      `INSERT INTO usuario_lojas (id_usuario, id_loja) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idUsuario, idLoja],
    );
  }
}
