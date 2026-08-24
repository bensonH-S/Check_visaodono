/**
 * Marca a rota delivery do Kadu/Cadu como enviada (pendente de aprovação).
 *   node backend/scripts/submeter-escala-delivery-kadu.mjs
 */
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'backend', '.env') });

const SEMANA = '2026-08-24';
const DBS = [...new Set([process.env.DB_NAME, process.env.DB_NAME_DEV, 'vision_check', 'vision_check_dev'].filter(Boolean))];

async function aplicar(database) {
  const c = new pg.Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database,
    port: Number(process.env.DB_PORT || 5432),
    ssl:
      process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  try {
    await c.connect();
  } catch (e) {
    console.log(`\n==== ${database} (indisponível: ${e.message}) ====`);
    return;
  }
  try {
    await c.query('BEGIN');
    console.log(`\n==== ${database} ====`);

    const { rows: users } = await c.query(
      `SELECT id_usuario, nome, email FROM usuarios
       WHERE ativo = TRUE
         AND (
           LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com')
           OR nome ILIKE 'Kadu%'
           OR nome ILIKE 'Cadu%'
         )
       ORDER BY CASE WHEN LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com') THEN 0 ELSE 1 END
       LIMIT 1`,
    );
    if (!users[0]) throw new Error('Kadu/Cadu não encontrado');
    const idKadu = users[0].id_usuario;
    console.log(`  ${users[0].nome} #${idKadu} <${users[0].email}>`);

    const { rows: lojas } = await c.query(
      `SELECT id_loja, name FROM lojas WHERE is_active = TRUE AND LOWER(TRIM(name)) = 'delivery' LIMIT 1`,
    );
    if (!lojas[0]) throw new Error('Loja DELIVERY não encontrada');
    const idAncora = lojas[0].id_loja;

    const { rows: sem } = await c.query(
      `SELECT id_semana FROM escala_visitas_semana WHERE semana_inicio = $1::date`,
      [SEMANA],
    );
    if (!sem[0]) throw new Error(`Semana ${SEMANA} não existe`);
    const idSemana = sem[0].id_semana;

    const { rows: celulas } = await c.query(
      `SELECT c.dia, ld.name, ld.bk_number
       FROM escala_visitas_celula c
       JOIN lojas ld ON ld.id_loja = c.id_loja_destino
       WHERE c.id_semana = $1 AND c.id_loja = $2 AND c.id_loja_destino IS NOT NULL
       ORDER BY c.dia`,
      [idSemana, idAncora],
    );
    if (!celulas.length) throw new Error(`Nenhuma rota delivery na semana ${SEMANA}`);
    for (const row of celulas) {
      console.log(`  dia ${row.dia} → ${row.bk_number || ''} ${row.name}`);
    }

    await c.query(
      `INSERT INTO escala_visitas_delivery_status (id_semana, status, submetido_por, submetido_em)
       VALUES ($1, 'pendente_aprovacao', $2, NOW())
       ON CONFLICT (id_semana) DO UPDATE SET
         status = 'pendente_aprovacao',
         submetido_por = EXCLUDED.submetido_por,
         submetido_em = COALESCE(escala_visitas_delivery_status.submetido_em, NOW()),
         revisado_por = NULL,
         revisado_em = NULL,
         comentario = NULL`,
      [idSemana, idKadu],
    );

    await c.query(
      `DELETE FROM escala_visitas_envio WHERE id_semana = $1 AND tipo = 'delivery'`,
      [idSemana],
    );
    const { rows: envio } = await c.query(
      `INSERT INTO escala_visitas_envio (id_semana, tipo, id_regiao, submetido_por)
       VALUES ($1, 'delivery', NULL, $2)
       RETURNING id_envio`,
      [idSemana, idKadu],
    );
    await c.query(
      `INSERT INTO escala_visitas_envio_celula
         (id_envio, id_loja, dia, id_regional, id_loja_destino, observacao)
       SELECT $1, c.id_loja, c.dia, c.id_regional, c.id_loja_destino, c.observacao
       FROM escala_visitas_celula c
       WHERE c.id_semana = $2 AND c.id_loja = $3`,
      [envio[0].id_envio, idSemana, idAncora],
    );

    await c.query('COMMIT');
    console.log(`  status = pendente_aprovacao · envio #${envio[0].id_envio}`);
    console.log(`OK ${database}`);
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

for (const db of DBS) {
  await aplicar(db);
}
