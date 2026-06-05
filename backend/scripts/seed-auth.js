/**
 * Usuários de teste (senha: Alvim@2026)
 * Permissões: só TI com gestão — demais usuários sem funções (TI configura depois)
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});

const SENHA = 'Alvim@2026';
const PERMS_TI = ['usuarios.gerenciar', 'lojas.todas'];

const usuarios = [
  { email: 'ti@grupoalvim.com.br', nome: 'TI Grupo Alvim', perfil: 'ti', iniciais: 'TI' },
  { email: 'admin@grupoalvim.com.br', nome: 'Administrador', perfil: 'administrador', iniciais: 'AD' },
  { email: 'coordenador@grupoalvim.com.br', nome: 'Coordenador', perfil: 'coordenador', iniciais: 'CO' },
  { email: 'gerente@grupoalvim.com.br', nome: 'Gerente', perfil: 'gerente', iniciais: 'GE' },
  { email: 'tecnico@grupoalvim.com.br', nome: 'Técnico', perfil: 'tecnico', iniciais: 'TE' },
];

async function syncPermissoes(idUsuario, codigos) {
  await client.query('DELETE FROM usuario_permissoes WHERE id_usuario = $1', [idUsuario]);
  for (const codigo of codigos) {
    await client.query(
      `INSERT INTO usuario_permissoes (id_usuario, codigo) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idUsuario, codigo],
    );
  }
}

async function syncLojas(idUsuario, lojaIds) {
  await client.query('DELETE FROM usuario_lojas WHERE id_usuario = $1', [idUsuario]);
  for (const idLoja of lojaIds) {
    await client.query(
      `INSERT INTO usuario_lojas (id_usuario, id_loja) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idUsuario, idLoja],
    );
  }
}

try {
  await client.connect();
  const hash = await bcrypt.hash(SENHA, 10);
  const todasLojas = await client.query(
    'SELECT id_loja FROM lojas WHERE is_active = TRUE ORDER BY id_loja',
  );
  const ids = todasLojas.rows.map((r) => r.id_loja);

  for (const u of usuarios) {
    const { rows } = await client.query(
      `INSERT INTO usuarios (nome, email, cargo, avatar_inicial, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, $5, $6::perfil_usuario, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         nome = EXCLUDED.nome,
         cargo = EXCLUDED.cargo,
         avatar_inicial = EXCLUDED.avatar_inicial,
         senha_hash = EXCLUDED.senha_hash,
         perfil = EXCLUDED.perfil,
         ativo = TRUE
       RETURNING id_usuario`,
      [u.nome, u.email, u.perfil, u.iniciais, hash, u.perfil],
    );
    const idUsuario = rows[0].id_usuario;

    if (u.perfil === 'ti') {
      await syncPermissoes(idUsuario, PERMS_TI);
      await syncLojas(idUsuario, []);
    } else {
      await syncPermissoes(idUsuario, []);
      await syncLojas(idUsuario, []);
    }
  }

  console.log('OK — senha Alvim@2026');
  console.log('  ti@ → usuarios.gerenciar + lojas.todas');
  console.log('  demais → sem permissões (configure em Usuários)');
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
