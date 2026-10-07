import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, 'backend', '.env')
const env = {}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue
  const i = line.indexOf('=')
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}

const pool = new pg.Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME || 'vision_check',
  port: Number(env.DB_PORT || 5432),
})

await pool.query(`
  INSERT INTO permissoes (codigo, nome, grupo, ordem)
  VALUES ('financeiro.ver', 'Ver módulo Financeiro (contas a pagar, caixa, DDA)', 'Financeiro', 185)
  ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, grupo = EXCLUDED.grupo, ordem = EXCLUDED.ordem
`)

const users = await pool.query(`
  SELECT id_usuario, nome, email
  FROM usuarios
  WHERE ativo = TRUE
    AND (
      LOWER(nome) LIKE '%benson%'
      OR LOWER(COALESCE(email, '')) LIKE '%benson%'
    )
  ORDER BY id_usuario
`)
console.log('benson:', users.rows)

const granted = await pool.query(`
  INSERT INTO usuario_permissoes (id_usuario, codigo)
  SELECT u.id_usuario, 'financeiro.ver'
  FROM usuarios u
  WHERE u.ativo = TRUE
    AND (
      LOWER(u.nome) LIKE '%benson%'
      OR LOWER(COALESCE(u.email, '')) LIKE '%benson%'
      OR EXISTS (
        SELECT 1 FROM usuario_permissoes up
        WHERE up.id_usuario = u.id_usuario AND up.codigo = 'configuracoes.ver'
      )
    )
  ON CONFLICT (id_usuario, codigo) DO NOTHING
  RETURNING id_usuario, codigo
`)
console.log('granted now:', granted.rows)

const who = await pool.query(`
  SELECT u.id_usuario, u.nome, u.email
  FROM usuario_permissoes up
  JOIN usuarios u ON u.id_usuario = up.id_usuario
  WHERE up.codigo = 'financeiro.ver'
  ORDER BY u.nome
`)
console.log('who_has_financeiro.ver:', who.rows)

await pool.end()
