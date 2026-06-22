/**
 * Diagnóstico rápido de login — node backend/scripts/check-auth.js [email]
 */
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const email = (process.argv[2] || 'ti@grupoalvim.com.br').trim().toLowerCase();
const senhaTeste = process.argv[3] || 'Alvim@2026';

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  console.log(`DB OK: ${process.env.DB_HOST}/${process.env.DB_NAME}`);

  const tables = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('usuarios', 'usuario_permissoes', 'manut_chamados')
    ORDER BY tablename
  `);
  console.log('Tabelas:', tables.rows.map((r) => r.tablename).join(', ') || '(nenhuma)');

  const { rows: users } = await client.query(
    `SELECT id_usuario, email, perfil, ativo,
            (senha_hash IS NOT NULL AND senha_hash <> '') AS tem_senha,
            LEFT(senha_hash, 7) AS hash_prefix
     FROM usuarios
     ORDER BY id_usuario
     LIMIT 20`,
  );
  console.log(`\nUsuários (${users.length} primeiros):`);
  for (const u of users) {
    console.log(`  #${u.id_usuario} ${u.email} perfil=${u.perfil} ativo=${u.ativo} senha=${u.tem_senha}`);
  }

  const { rows: alvo } = await client.query(
    `SELECT * FROM usuarios WHERE LOWER(email) = $1`,
    [email],
  );
  const user = alvo[0];
  if (!user) {
    console.log(`\n✗ Usuário "${email}" NÃO existe. Rode: npm run seed:auth`);
    process.exit(1);
  }
  if (!user.ativo) {
    console.log(`\n✗ Usuário "${email}" está INATIVO`);
    process.exit(1);
  }
  if (!user.senha_hash) {
    console.log(`\n✗ Usuário "${email}" sem senha_hash. Rode: npm run seed:auth`);
    process.exit(1);
  }

  const ok = await bcrypt.compare(senhaTeste, user.senha_hash);
  console.log(`\nTeste senha "${senhaTeste}" para ${email}: ${ok ? 'OK' : 'FALHOU'}`);
  if (!ok) {
    console.log('Rode npm run seed:auth para resetar para Alvim@2026');
    process.exit(1);
  }

  const perms = await client.query(
    `SELECT COUNT(*)::int AS n FROM usuario_permissoes WHERE id_usuario = $1`,
    [user.id_usuario],
  );
  console.log(`Permissões: ${perms.rows[0].n}`);
  console.log('\n✓ Banco pronto para login com esse usuário/senha');
} catch (e) {
  console.error('Erro:', e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
