/**
 * Corrige acesso AutoREV do Igor (e Clemerson):
 * - lojas.todas (override de rede)
 * - cargo supervisor com auditoria_operacional (+ checklist.ver/executar)
 * - carregarPermissoesUsuario passa a unir lojas.todas do usuário
 *
 * Uso: node backend/scripts/_fix_igor_checklist.mjs --db-prod [--apply]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
function lerEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
const env = { ...lerEnv(path.join(root, '.env')), ...lerEnv(path.join(root, 'backend', '.env')), ...process.env };
const prod = process.argv.includes('--db-prod');
const apply = process.argv.includes('--apply');
const database = prod
  ? (env.DB_NAME_PROD || env.FINANCE_DB_NAME || 'vision_check')
  : (env.DB_NAME || 'vision_check_dev');

const pool = new pg.Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database,
  port: Number(env.DB_PORT || 5432),
  ssl: env.DB_SSL === 'true' || env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

console.log({ database, apply });

const { rows: tipos } = await pool.query(
  `SELECT id_tipo_checklist, codigo, nome, ativo FROM tipos_checklist ORDER BY ordem, nome`,
);
console.log('tipos_checklist', tipos);

const { rows: cc } = await pool.query(
  `SELECT cc.cargo_codigo, t.codigo, t.nome, t.ativo
   FROM cargo_checklist cc
   JOIN tipos_checklist t ON t.id_tipo_checklist = cc.id_tipo_checklist
   WHERE cc.cargo_codigo = 'supervisor_regional'
   ORDER BY t.ordem`,
);
console.log('cargo_checklist supervisor_regional', cc);

const { rows: rede } = await pool.query(
  `SELECT id_usuario, nome, email, cargo_aprovacao
   FROM usuarios
   WHERE coalesce(ativo, TRUE)
     AND (
       lower(nome) ~* '(^| )igor( |$)'
       OR lower(coalesce(email, '')) LIKE '%igor%'
       OR lower(nome) ~* 'clemerson'
       OR lower(coalesce(email, '')) LIKE '%clemerson%'
     )
   ORDER BY id_usuario`,
);
console.log('usuarios rede', rede);

for (const u of rede) {
  const { rows: up } = await pool.query(
    `SELECT codigo FROM usuario_permissoes WHERE id_usuario = $1 AND codigo = 'lojas.todas'`,
    [u.id_usuario],
  );
  console.log(`  #${u.id_usuario} ${u.nome} lojas.todas?`, up.length > 0);
}

if (!apply) {
  console.log('\nDry-run. Passe --apply para gravar.');
  await pool.end();
  process.exit(0);
}

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Garante perms AutoREV no cargo
  await client.query(
    `INSERT INTO cargo_permissoes (codigo_cargo, codigo)
     SELECT 'supervisor_regional', x.codigo
     FROM (VALUES ('checklist.ver'), ('checklist.executar')) AS x(codigo)
     JOIN permissoes p ON p.codigo = x.codigo
     ON CONFLICT DO NOTHING`,
  );

  // Tipos: auditoria_operacional obrigatória; time_de_campo só se ativo
  const { rows: aud } = await client.query(
    `SELECT id_tipo_checklist, ativo FROM tipos_checklist WHERE codigo = 'auditoria_operacional'`,
  );
  if (!aud[0]) throw new Error('tipo auditoria_operacional não existe');
  if (!aud[0].ativo) {
    await client.query(`UPDATE tipos_checklist SET ativo = TRUE WHERE codigo = 'auditoria_operacional'`);
  }
  await client.query(
    `INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
     VALUES ('supervisor_regional', $1)
     ON CONFLICT DO NOTHING`,
    [aud[0].id_tipo_checklist],
  );

  // Remove vínculo com tipos inativos (ex.: time_de_campo desativado)
  await client.query(
    `DELETE FROM cargo_checklist cc
     USING tipos_checklist t
     WHERE cc.id_tipo_checklist = t.id_tipo_checklist
       AND cc.cargo_codigo = 'supervisor_regional'
       AND t.ativo = FALSE`,
  );

  // Override rede
  await client.query(
    `INSERT INTO usuario_permissoes (id_usuario, codigo)
     SELECT u.id_usuario, 'lojas.todas'
     FROM usuarios u
     WHERE coalesce(u.ativo, TRUE)
       AND (
         lower(u.nome) ~* '(^| )igor( |$)'
         OR lower(coalesce(u.email, '')) LIKE '%igor%'
         OR lower(u.nome) ~* 'clemerson'
         OR lower(coalesce(u.email, '')) LIKE '%clemerson%'
       )
     ON CONFLICT DO NOTHING`,
  );

  // Espelha checklist no usuario_permissoes dos supervisores
  await client.query(
    `INSERT INTO usuario_permissoes (id_usuario, codigo)
     SELECT u.id_usuario, cp.codigo
     FROM usuarios u
     JOIN cargo_permissoes cp ON cp.codigo_cargo = u.cargo_aprovacao
     WHERE u.cargo_aprovacao = 'supervisor_regional'
       AND coalesce(u.ativo, TRUE)
       AND cp.codigo IN ('checklist.ver', 'checklist.executar')
     ON CONFLICT DO NOTHING`,
  );

  await client.query('COMMIT');
  console.log('OK aplicado.');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}

const { rows: cc2 } = await pool.query(
  `SELECT t.codigo, t.ativo
   FROM cargo_checklist cc
   JOIN tipos_checklist t ON t.id_tipo_checklist = cc.id_tipo_checklist
   WHERE cc.cargo_codigo = 'supervisor_regional'`,
);
console.log('cargo_checklist depois', cc2);

for (const u of rede) {
  const { rows: up } = await pool.query(
    `SELECT codigo FROM usuario_permissoes WHERE id_usuario = $1 AND codigo IN ('lojas.todas','checklist.ver','checklist.executar') ORDER BY 1`,
    [u.id_usuario],
  );
  console.log(`  #${u.id_usuario} ${u.nome}`, up.map((r) => r.codigo));
}

await pool.end();
