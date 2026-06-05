/**
 * Usuários de teste (senha: Alvim@2026) — mesmo padrão do GrupoAlvim_manutencao
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
  { email: 'admin@grupoalvim.com.br', nome: 'Administrador', perfil: 'administrador', iniciais: 'AD' },
  { email: 'coordenador@grupoalvim.com.br', nome: 'Coordenador', perfil: 'coordenador', iniciais: 'CO' },
  { email: 'gerente@grupoalvim.com.br', nome: 'Gerente', perfil: 'gerente', iniciais: 'GE' },
  { email: 'tecnico@grupoalvim.com.br', nome: 'Técnico', perfil: 'tecnico', iniciais: 'TE' },
];

try {
  await client.connect();
  const hash = await bcrypt.hash(SENHA, 10);
  const loja = await client.query(
    'SELECT id_loja FROM lojas WHERE is_active = TRUE ORDER BY id_loja LIMIT 1',
  );
  const idLoja = loja.rows[0]?.id_loja ?? null;

  for (const u of usuarios) {
    await client.query(
      `INSERT INTO usuarios (nome, email, cargo, avatar_inicial, senha_hash, perfil, id_loja, ativo)
       VALUES ($1, $2, $3, $4, $5, $6::perfil_usuario, $7, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         nome = EXCLUDED.nome,
         cargo = EXCLUDED.cargo,
         avatar_inicial = EXCLUDED.avatar_inicial,
         senha_hash = EXCLUDED.senha_hash,
         perfil = EXCLUDED.perfil,
         id_loja = COALESCE(EXCLUDED.id_loja, usuarios.id_loja),
         ativo = TRUE`,
      [u.nome, u.email, u.perfil, u.iniciais, hash, u.perfil, u.perfil === 'gerente' ? idLoja : null],
    );
  }

  await client.query(
    `UPDATE usuarios SET senha_hash = $1, perfil = 'coordenador'::perfil_usuario
     WHERE email = 'gabriela.vicentini@grupoalvim.com.br' AND senha_hash IS NULL`,
    [hash],
  );

  console.log('OK — usuários com senha Alvim@2026:');
  usuarios.forEach((u) => console.log(`  ${u.email} (${u.perfil})`));
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
