/**
 * Cria/atualiza usuários iniciais (senha padrão: Alvim@2026).
 * Usado pelo script seed-auth.js e auto-seed em dev no server.js.
 */
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { logger } from './logger.js';
import { CATALOGO_PERMISSOES } from './permissoes.js';

const SENHA_PADRAO = 'Alvim@2026';

const USUARIOS_INICIAIS = [
  { email: 'admin@grupoalvim.com.br', nome: 'Administrador', perfil: 'administrador', cargo: 'administrador', iniciais: 'AD' },
  { email: 'coordenador@grupoalvim.com.br', nome: 'Coordenador', perfil: 'coordenador', cargo: 'coordenador', iniciais: 'CO' },
  { email: 'gerente@grupoalvim.com.br', nome: 'Gerente', perfil: 'gerente', cargo: 'gerente', iniciais: 'GE' },
  { email: 'tecnico@grupoalvim.com.br', nome: 'Técnico', perfil: 'tecnico', cargo: 'tecnico', iniciais: 'TE' },
];

async function syncPermissoes(client, idUsuario, codigos) {
  await client.query('DELETE FROM usuario_permissoes WHERE id_usuario = $1', [idUsuario]);
  for (const codigo of codigos) {
    await client.query(
      `INSERT INTO usuario_permissoes (id_usuario, codigo) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idUsuario, codigo],
    );
  }
}

async function syncLojas(client, idUsuario, lojaIds) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_tables
       WHERE schemaname = 'public' AND tablename = 'usuario_lojas'
     ) AS ok`,
  );
  if (!rows[0]?.ok) return;

  await client.query('DELETE FROM usuario_lojas WHERE id_usuario = $1', [idUsuario]);
  for (const idLoja of lojaIds) {
    await client.query(
      `INSERT INTO usuario_lojas (id_usuario, id_loja) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idUsuario, idLoja],
    );
  }
}

async function tabelasAuthProntas(client) {
  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('usuarios', 'permissoes', 'usuario_permissoes')
  `);
  const ok = new Set(rows.map((r) => r.tablename));
  return ['usuarios', 'permissoes', 'usuario_permissoes'].every((t) => ok.has(t));
}

async function ensureAuthUsers({ senha = SENHA_PADRAO } = {}) {
  const client = await pool.connect();
  try {
    if (!(await tabelasAuthProntas(client))) {
      throw new Error('Tabelas de autenticação ausentes (rode migrate:full)');
    }

    const hash = await bcrypt.hash(senha, 10);
    const permsAdmin = CATALOGO_PERMISSOES.map((p) => p.codigo);
    const emails = [];

    for (const u of USUARIOS_INICIAIS) {
      const { rows } = await client.query(
        `INSERT INTO usuarios (nome, email, cargo, cargo_aprovacao, avatar_inicial, senha_hash, perfil, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7::perfil_usuario, TRUE)
         ON CONFLICT (email) DO UPDATE SET
           nome = EXCLUDED.nome,
           cargo = EXCLUDED.cargo,
           cargo_aprovacao = EXCLUDED.cargo_aprovacao,
           avatar_inicial = EXCLUDED.avatar_inicial,
           senha_hash = EXCLUDED.senha_hash,
           perfil = EXCLUDED.perfil,
           ativo = TRUE
         RETURNING id_usuario`,
        [u.nome, u.email, u.cargo, u.cargo, u.iniciais, hash, u.perfil],
      );
      const idUsuario = rows[0].id_usuario;
      emails.push(u.email);

      if (u.perfil === 'administrador') {
        await syncPermissoes(client, idUsuario, permsAdmin);
        await syncLojas(client, idUsuario, []);
      } else {
        await syncPermissoes(client, idUsuario, []);
        await syncLojas(client, idUsuario, []);
      }
    }

    return { criados: USUARIOS_INICIAIS.length, emails };
  } finally {
    client.release();
  }
}

export async function usuarioAdminSeedExiste() {
  const { rows } = await pool.query(
    `SELECT 1 FROM usuarios
     WHERE LOWER(email) = 'admin@grupoalvim.com.br' AND ativo = TRUE AND senha_hash IS NOT NULL
     LIMIT 1`,
  );
  return rows.length > 0;
}

export async function ensureAuthUsersSeNecessario() {
  if (await usuarioAdminSeedExiste()) return false;
  const result = await ensureAuthUsers();
  logger.info('seed', 'Usuários iniciais criados automaticamente', {
    emails: result.emails,
    senhaPadrao: SENHA_PADRAO,
  });
  console.log('[server] Usuários de acesso criados (admin@grupoalvim.com.br / Alvim@2026)');
  return true;
}
