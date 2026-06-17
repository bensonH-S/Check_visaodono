import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const EXCLUIR = [1, 2, 3, 4, 5, 6, 7, 8];
const RENUMERAR_DE = 9;
const RENUMERAR_PARA = 1;

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});

const TABELAS_FILHAS = [
  'manut_anexos',
  'manut_atualizacoes',
  'manut_chamado_eventos',
  'manut_notificacoes',
];

await client.connect();

try {
  const antes = await client.query(
    'SELECT id_chamado, numero, titulo FROM manut_chamados ORDER BY id_chamado',
  );
  console.log('Antes:', antes.rows);

  const { rows: colunas } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'manut_chamados'
       AND column_name NOT IN ('id_chamado', 'numero')
     ORDER BY ordinal_position`,
  );
  const cols = colunas.map((c) => c.column_name).join(', ');

  await client.query('BEGIN');

  await client.query('DELETE FROM manut_chamados WHERE id_chamado = ANY($1::int[])', [EXCLUIR]);

  const origem = await client.query(
    'SELECT id_chamado FROM manut_chamados WHERE id_chamado = $1',
    [RENUMERAR_DE],
  );

  if (origem.rows.length) {
    await client.query(
      `INSERT INTO manut_chamados (id_chamado, numero, ${cols})
       SELECT $1, $2, ${cols}
       FROM manut_chamados
       WHERE id_chamado = $3`,
      [RENUMERAR_PARA, RENUMERAR_PARA, RENUMERAR_DE],
    );

    for (const tabela of TABELAS_FILHAS) {
      const existe = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [tabela],
      );
      if (!existe.rows.length) continue;
      const upd = await client.query(
        `UPDATE ${tabela} SET id_chamado = $1 WHERE id_chamado = $2`,
        [RENUMERAR_PARA, RENUMERAR_DE],
      );
      console.log(`${tabela}: ${upd.rowCount} registro(s) atualizado(s)`);
    }

    await client.query('DELETE FROM manut_chamados WHERE id_chamado = $1', [RENUMERAR_DE]);
  }

  await client.query(
    `SELECT setval(pg_get_serial_sequence('manut_chamados', 'id_chamado'), $1, true)`,
    [RENUMERAR_PARA],
  );
  await client.query(
    `SELECT setval(pg_get_serial_sequence('manut_chamados', 'numero'), $1, true)`,
    [RENUMERAR_PARA],
  );

  await client.query('COMMIT');

  const depois = await client.query(
    'SELECT id_chamado, numero, titulo FROM manut_chamados ORDER BY id_chamado',
  );
  console.log('Depois:', depois.rows);
  console.log('Próximo chamado será #2 (id_chamado = 2).');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Erro:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
