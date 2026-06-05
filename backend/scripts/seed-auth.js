/**
 * Usuários de teste (senha: Alvim@2026)
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
const usuarios = [
  { email: 'ti@grupoalvim.com.br', nome: 'TI Grupo Alvim', perfil: 'ti', iniciais: 'TI' },
  { email: 'admin@grupoalvim.com.br', nome: 'Administrador', perfil: 'administrador', iniciais: 'AD' },
  { email: 'coordenador@grupoalvim.com.br', nome: 'Coordenador', perfil: 'coordenador', iniciais: 'CO' },
  { email: 'gerente@grupoalvim.com.br', nome: 'Gerente', perfil: 'gerente', iniciais: 'GE' },
  { email: 'tecnico@grupoalvim.com.br', nome: 'Técnico', perfil: 'tecnico', iniciais: 'TE' },
];

async function syncLojas(idUsuario, perfil, lojaIds) {
  await client.query('DELETE FROM usuario_lojas WHERE id_usuario = $1', [idUsuario]);
  if (perfil === 'ti' || perfil === 'administrador') return;
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
  const metade = ids.slice(0, Math.max(1, Math.ceil(ids.length / 2)));
  const outraMetade = ids.slice(Math.ceil(ids.length / 2));

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
    if (u.perfil === 'gerente' && ids[0]) await syncLojas(idUsuario, u.perfil, [ids[0]]);
    else if (u.perfil === 'tecnico') await syncLojas(idUsuario, u.perfil, metade);
    else if (u.perfil === 'coordenador') await syncLojas(idUsuario, u.perfil, outraMetade.length ? outraMetade : ids);
    else await syncLojas(idUsuario, u.perfil, []);
  }

  console.log('OK — usuários com senha Alvim@2026:');
  usuarios.forEach((u) => console.log(`  ${u.email} (${u.perfil})`));
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
