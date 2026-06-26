import { pool } from '../db.js';
import { coletarDestinatariosDiretoriaLoja } from './destinatariosDiretoria.js';

async function buscarRegiaoDaLoja(idLoja) {
  const { rows } = await pool.query(
    `SELECT r.id_regiao, r.nome, r.id_regional
     FROM frota_regiao_lojas rl
     JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
     WHERE rl.id_loja = $1
     ORDER BY r.id_regiao
     LIMIT 1`,
    [idLoja],
  );
  return rows[0] || null;
}

export async function coletarTecnicosRegiaoLoja(idLoja) {
  const regiao = await buscarRegiaoDaLoja(idLoja);
  const destinatarios = new Set();
  if (!regiao) return destinatarios;

  const { rows } = await pool.query(
    `SELECT rt.id_usuario
     FROM frota_regiao_tecnicos rt
     JOIN usuarios u ON u.id_usuario = rt.id_usuario AND u.ativo = TRUE
     WHERE rt.id_regiao = $1`,
    [regiao.id_regiao],
  );
  for (const r of rows) destinatarios.add(Number(r.id_usuario));
  return destinatarios;
}

const SQL_CARGO_USUARIO = `COALESCE(u.cargo_aprovacao, u.perfil::text)`;

export async function coletarCoordenadoresLoja(idLoja) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.id_usuario
     FROM usuarios u
     JOIN usuario_lojas ul ON ul.id_usuario = u.id_usuario AND ul.id_loja = $1
     WHERE u.ativo = TRUE
       AND ${SQL_CARGO_USUARIO} = 'coordenador'`,
    [idLoja],
  );
  return new Set(rows.map((r) => Number(r.id_usuario)));
}

export async function coletarGerentesLoja(idLoja) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.id_usuario
     FROM usuarios u
     JOIN usuario_lojas ul ON ul.id_usuario = u.id_usuario AND ul.id_loja = $1
     WHERE u.ativo = TRUE
       AND ${SQL_CARGO_USUARIO} = 'gerente'`,
    [idLoja],
  );
  return new Set(rows.map((r) => Number(r.id_usuario)));
}

export async function coletarSupervisoresRegiaoLoja(idLoja) {
  const regiao = await buscarRegiaoDaLoja(idLoja);
  const destinatarios = new Set();
  if (!regiao) return destinatarios;

  try {
    const { rows } = await pool.query(
      `SELECT rr.id_usuario
       FROM frota_regiao_regionais rr
       JOIN usuarios u ON u.id_usuario = rr.id_usuario AND u.ativo = TRUE
       WHERE rr.id_regiao = $1`,
      [regiao.id_regiao],
    );
    for (const r of rows) destinatarios.add(Number(r.id_usuario));
  } catch {
    /* tabela pode não existir em ambientes antigos */
  }

  if (regiao.id_regional) destinatarios.add(Number(regiao.id_regional));
  return destinatarios;
}

export async function obterConfigEventoNotificacao(codigo) {
  const { rows } = await pool.query(
    `SELECT ativo, notifica_diretor, notifica_tecnico, notifica_supervisor,
            notifica_coordenador, notifica_gerente
     FROM manut_notificacao_eventos
     WHERE codigo = $1`,
    [codigo],
  );
  const row = rows[0];
  if (!row) {
    return {
      ativo: true,
      notifica_diretor: true,
      notifica_tecnico: true,
      notifica_supervisor: true,
      notifica_coordenador: true,
      notifica_gerente: true,
    };
  }
  return {
    ativo: row.ativo !== false,
    notifica_diretor: row.notifica_diretor !== false,
    notifica_tecnico: row.notifica_tecnico !== false,
    notifica_supervisor: row.notifica_supervisor !== false,
    notifica_coordenador: row.notifica_coordenador !== false,
    notifica_gerente: row.notifica_gerente !== false,
  };
}

/** Destinatários conforme papéis marcados no evento (diretor, técnico, supervisor regional). */
export async function coletarDestinatariosPorEvento(idChamado, codigoEvento) {
  const cfg = await obterConfigEventoNotificacao(codigoEvento);
  if (!cfg.ativo) return new Set();

  const { rows } = await pool.query(
    `SELECT id_loja, id_tecnico FROM manut_chamados WHERE id_chamado = $1`,
    [idChamado],
  );
  const chamado = rows[0];
  if (!chamado) return new Set();

  const destinatarios = new Set();

  if (cfg.notifica_diretor) {
    for (const id of await coletarDestinatariosDiretoriaLoja(chamado.id_loja)) {
      destinatarios.add(id);
    }
  }

  if (cfg.notifica_supervisor) {
    for (const id of await coletarSupervisoresRegiaoLoja(chamado.id_loja)) {
      destinatarios.add(id);
    }
  }

  if (cfg.notifica_tecnico) {
    if (chamado.id_tecnico) destinatarios.add(Number(chamado.id_tecnico));
    for (const id of await coletarTecnicosRegiaoLoja(chamado.id_loja)) {
      destinatarios.add(id);
    }
  }

  if (cfg.notifica_coordenador) {
    for (const id of await coletarCoordenadoresLoja(chamado.id_loja)) {
      destinatarios.add(id);
    }
  }

  if (cfg.notifica_gerente) {
    for (const id of await coletarGerentesLoja(chamado.id_loja)) {
      destinatarios.add(id);
    }
  }

  return destinatarios;
}
