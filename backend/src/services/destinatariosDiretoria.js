import { pool } from '../db.js';
import { sqlUsuarioAtendeLojaNotificacao } from '../lojasUsuario.js';

/** Diretores com permissão de aprovar — todas as lojas (lojas.todas) ou lojas vinculadas. */
export async function coletarDestinatariosDiretoriaLoja(idLoja) {
  const destinatarios = new Set();
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT u.id_usuario
       FROM usuarios u
       JOIN usuario_permissoes up ON up.id_usuario = u.id_usuario
       WHERE u.ativo = TRUE
         AND up.codigo = 'chamados.aprovar'
         AND u.cargo_aprovacao = 'diretor'
         AND ${sqlUsuarioAtendeLojaNotificacao('u.id_usuario', '$1')}`,
      [idLoja],
    );
    for (const r of rows) destinatarios.add(Number(r.id_usuario));
  } catch {
    /* ignore */
  }
  return destinatarios;
}

export async function usuarioEhDiretorNotificacoes(idUsuario) {
  const uid = Number(idUsuario);
  if (!Number.isFinite(uid)) return false;
  try {
    const { rows } = await pool.query(
      `SELECT 1
       FROM usuarios u
       JOIN usuario_permissoes up ON up.id_usuario = u.id_usuario AND up.codigo = 'chamados.aprovar'
       WHERE u.id_usuario = $1 AND u.ativo = TRUE AND u.cargo_aprovacao = 'diretor'
       LIMIT 1`,
      [uid],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}
