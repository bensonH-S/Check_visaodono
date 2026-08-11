/**
 * Escala 10/08–16/08/2026 (planilha Time de Campo).
 * Kadu = delivery (aba Delivery / id_loja_destino), não entra na grade de visitas.
 *
 * Uso: node backend/scripts/seed-escala-semana-2026-08-10.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const SEMANA_INICIO = '2026-08-10';

/** Rota Kadu (mini-grid inferior da planilha) → aba Delivery */
const ROTA_DELIVERY_KADU = [
  { dia: 0, loja: 'SAMAMBAIA' },
  { dia: 1, loja: 'NOROESTE' },
  { dia: 2, loja: 'ESTRUTURAL' },
  { dia: 3, loja: 'SUDOESTE' },
  { dia: 4, loja: 'PONTE ALTA' },
  { dia: 5, loja: 'RECANTO' },
  // dia 6 = Folga
];

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

function matchLoja(lojas, chave) {
  const n = norm(chave);
  const hit = lojas.find((l) => {
    const nome = norm(l.name);
    return nome.includes(n) || nome.endsWith(n) || nome.split(' - ').pop() === n;
  });
  return hit ?? null;
}

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Conta delivery = Kadu (planilha)
  const { rows: deliveryUsers } = await client.query(
    `SELECT id_usuario, nome, email
     FROM usuarios
     WHERE ativo AND (
       LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com')
       OR nome ILIKE '%kadu%'
       OR nome ILIKE 'Carlos'
     )
     ORDER BY
       CASE WHEN LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com') THEN 0 ELSE 1 END,
       id_usuario
     LIMIT 1`,
  );
  if (!deliveryUsers[0]) throw new Error('Usuário de delivery não encontrado');

  const idKadu = deliveryUsers[0].id_usuario;
  await client.query(
    `UPDATE usuarios
     SET nome = 'Kadu',
         avatar_inicial = 'KA',
         cargo = 'Delivery'
     WHERE id_usuario = $1`,
    [idKadu],
  );
  await client.query(
    `INSERT INTO usuario_permissoes (id_usuario, codigo)
     VALUES ($1, 'escalas.visitas.ver'), ($1, 'escalas.visitas.editar_delivery')
     ON CONFLICT DO NOTHING`,
    [idKadu],
  );
  await client.query(
    `DELETE FROM usuario_permissoes
     WHERE id_usuario = $1
       AND codigo IN ('escalas.visitas.editar_regiao', 'escalas.visitas.gerenciar')`,
    [idKadu],
  );
  console.log(`Delivery: #${idKadu} → Kadu`);

  const { rows: lojas } = await client.query(
    `SELECT id_loja, name FROM lojas WHERE is_active = TRUE`,
  );
  const lojaDelivery = lojas.find((l) => norm(l.name) === 'delivery');
  if (!lojaDelivery) throw new Error('Loja âncora DELIVERY não encontrada');

  const { rows: semRows } = await client.query(
    `INSERT INTO escala_visitas_semana (semana_inicio, observacao)
     VALUES ($1::date, 'Planilha Time de Campo — semana 10/08 a 16/08/2026 (Kadu = delivery)')
     ON CONFLICT (semana_inicio) DO UPDATE SET observacao = EXCLUDED.observacao
     RETURNING id_semana`,
    [SEMANA_INICIO],
  );
  const idSemana = semRows[0].id_semana;

  // Limpa só a linha Delivery (não apaga visitas já montadas por região)
  await client.query(
    `DELETE FROM escala_visitas_celula
     WHERE id_semana = $1 AND id_loja = $2`,
    [idSemana, lojaDelivery.id_loja],
  );
  // Remove Kadu indevido na grade de visitas (se existir)
  await client.query(
    `DELETE FROM escala_visitas_celula
     WHERE id_semana = $1 AND id_regional = $2 AND id_loja_destino IS NULL`,
    [idSemana, idKadu],
  );

  await client.query(
    `INSERT INTO escala_visitas_delivery_status (id_semana, status)
     VALUES ($1, 'rascunho')
     ON CONFLICT (id_semana) DO UPDATE SET
       status = 'rascunho',
       submetido_por = NULL,
       submetido_em = NULL,
       revisado_por = NULL,
       revisado_em = NULL,
       comentario = NULL`,
    [idSemana],
  );

  let inseridos = 0;
  for (const item of ROTA_DELIVERY_KADU) {
    const dest = matchLoja(lojas, item.loja);
    if (!dest) {
      console.warn(`Loja destino não encontrada: ${item.loja}`);
      continue;
    }
    await client.query(
      `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_loja_destino)
       VALUES ($1, $2, $3, $4)`,
      [idSemana, lojaDelivery.id_loja, item.dia, dest.id_loja],
    );
    inseridos++;
    console.log(`  DELIVERY dia ${item.dia} → ${dest.name}`);
  }

  await client.query('COMMIT');
  console.log(`\nOK — semana ${SEMANA_INICIO}`);
  console.log(`  Destinos delivery (Kadu): ${inseridos}`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Falha:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
