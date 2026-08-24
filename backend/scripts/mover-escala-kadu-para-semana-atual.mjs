/**
 * Apaga delivery do Kadu na semana 31/08 e grava a rota montada na semana 24/08.
 *   node backend/scripts/mover-escala-kadu-para-semana-atual.mjs
 */
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'backend', '.env') });

const SEMANA_ATUAL = '2026-08-24';
const SEMANA_SEGUINTE = '2026-08-31';
const DBS = ['vision_check', 'vision_check_dev'];

const ROTA = [
  { dia: 0, bk: '31614', chave: 'SAMAMBAIA' },
  { dia: 1, bk: '23531', chave: '706/7 NORTE' },
  { dia: 2, bk: '32555', chave: 'ESTRUTURAL' },
  { dia: 3, bk: '21583', chave: 'DF PLAZA' },
  { dia: 4, bk: '30769', chave: 'RECANTO' },
];

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matchLoja(lojas, chave) {
  const n = norm(chave);
  const hits = lojas.filter((l) => {
    const nome = norm(l.name);
    if (nome === 'delivery' || nome.includes('king assessoria')) return false;
    return nome.includes(n) || nome.endsWith(n) || nome.split(' - ').pop() === n;
  });
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    const exact = hits.find((l) => {
      const suf = norm(l.name).split(' - ').pop();
      return suf === n || norm(l.name).endsWith(n);
    });
    return exact || hits[0];
  }
  return null;
}

async function idSemana(c, inicio) {
  const { rows } = await c.query(
    `SELECT id_semana FROM escala_visitas_semana WHERE semana_inicio = $1::date`,
    [inicio],
  );
  return rows[0]?.id_semana ?? null;
}

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
  await c.connect();
  try {
    await c.query('BEGIN');
    console.log(`\n==== ${database} ====`);

    const { rows: users } = await c.query(
      `SELECT id_usuario, nome FROM usuarios
       WHERE ativo = TRUE
         AND (
           LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com')
           OR nome ILIKE 'Kadu%'
         )
       ORDER BY CASE WHEN LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com') THEN 0 ELSE 1 END
       LIMIT 1`,
    );
    if (!users[0]) throw new Error('Kadu não encontrado');
    const idKadu = users[0].id_usuario;

    const { rows: lojas } = await c.query(
      `SELECT id_loja, name, bk_number FROM lojas WHERE is_active = TRUE`,
    );
    const ancora = lojas.find((l) => norm(l.name) === 'delivery');
    if (!ancora) throw new Error('Loja DELIVERY não encontrada');

    const idProx = await idSemana(c, SEMANA_SEGUINTE);
    if (idProx) {
      const delCel = await c.query(
        `DELETE FROM escala_visitas_celula
         WHERE id_semana = $1
           AND (
             (id_loja = $2 AND id_loja_destino IS NOT NULL)
             OR id_regional = $3
           )`,
        [idProx, ancora.id_loja, idKadu],
      );
      await c.query(
        `DELETE FROM escala_visitas_envio WHERE id_semana = $1 AND tipo = 'delivery'`,
        [idProx],
      );
      await c.query(
        `UPDATE escala_visitas_delivery_status
         SET status = 'rascunho',
             submetido_por = NULL,
             submetido_em = NULL,
             revisado_por = NULL,
             revisado_em = NULL,
             comentario = NULL
         WHERE id_semana = $1`,
        [idProx],
      );
      console.log(`  apagou semana ${SEMANA_SEGUINTE}: ${delCel.rowCount} células`);
    } else {
      console.log(`  semana ${SEMANA_SEGUINTE} não existe`);
    }

    const { rows: sem } = await c.query(
      `INSERT INTO escala_visitas_semana (semana_inicio, observacao)
       VALUES ($1::date, 'Rota delivery Kadu — 24/08 a 30/08/2026')
       ON CONFLICT (semana_inicio) DO UPDATE SET atualizado_em = NOW()
       RETURNING id_semana`,
      [SEMANA_ATUAL],
    );
    const idAtual = sem[0].id_semana;

    await c.query(
      `DELETE FROM escala_visitas_celula
       WHERE id_semana = $1 AND id_loja = $2 AND id_loja_destino IS NOT NULL`,
      [idAtual, ancora.id_loja],
    );
    await c.query(
      `DELETE FROM escala_visitas_celula
       WHERE id_semana = $1 AND id_regional = $2 AND id_loja_destino IS NULL`,
      [idAtual, idKadu],
    );

    for (const item of ROTA) {
      const dest =
        lojas.find((l) => String(l.bk_number || '').trim() === item.bk) ||
        matchLoja(lojas, item.chave);
      if (!dest) throw new Error(`Destino não encontrado: ${item.chave} (${item.bk})`);
      await c.query(
        `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional, id_loja_destino)
         VALUES ($1, $2, $3, $4, $5)`,
        [idAtual, ancora.id_loja, item.dia, idKadu, dest.id_loja],
      );
      console.log(`  ${SEMANA_ATUAL} dia ${item.dia} → ${dest.bk_number} ${dest.name}`);
    }

    await c.query(
      `INSERT INTO escala_visitas_delivery_status (id_semana, status, submetido_por)
       VALUES ($1, 'rascunho', $2)
       ON CONFLICT (id_semana) DO UPDATE SET
         status = 'rascunho',
         submetido_por = EXCLUDED.submetido_por,
         submetido_em = NULL,
         revisado_por = NULL,
         revisado_em = NULL,
         comentario = NULL`,
      [idAtual, idKadu],
    );

    await c.query('COMMIT');
    console.log(`OK ${database}`);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
}

for (const db of DBS) {
  await aplicar(db);
}
