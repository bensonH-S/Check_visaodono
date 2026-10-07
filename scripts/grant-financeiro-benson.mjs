import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of fs.readFileSync(path.join(root, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
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

const users = await pool.query(`
  SELECT id_usuario, nome, email, ativo, cargo_aprovacao, perfil::text AS perfil
  FROM usuarios
  WHERE LOWER(COALESCE(nome, '')) LIKE '%bens%'
     OR LOWER(COALESCE(email, '')) LIKE '%bens%'
     OR LOWER(COALESCE(email, '')) LIKE '%henrique%'
     OR LOWER(COALESCE(nome, '')) LIKE '%henrique%'
  ORDER BY id_usuario
`)
console.log('candidates:', users.rows)

for (const u of users.rows) {
  await pool.query(
    `INSERT INTO usuario_permissoes (id_usuario, codigo)
     VALUES ($1, 'financeiro.ver')
     ON CONFLICT (id_usuario, codigo) DO NOTHING`,
    [u.id_usuario],
  )
  console.log('granted', u.id_usuario, u.nome, u.email)
}

await pool.end()
