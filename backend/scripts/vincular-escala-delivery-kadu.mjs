/**
 * Grava a rota delivery 24/08 na conta do Kadu. Uso:
 *   node backend/scripts/vincular-escala-delivery-kadu.mjs
 */
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'backend', '.env') });

const ROTA = [
  { dia: 0, chave: 'SAMAMBAIA' },
  { dia: 1, chave: '706/7 NORTE' },
  { dia: 2, chave: 'ESTRUTURAL' },
  { dia: 3, chave: 'DF PLAZA' },
  { dia: 4, chave: 'RECANTO' },
];
const SEMANAS = ['2026-08-24'];
const DBS = ['vision_check', 'vision_check_dev'];

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
    return (
      nome.includes(n) ||
      nome.endsWith(n) ||
      nome.split(' - ').pop() === n
    );
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

    await c.query(`
      DROP INDEX IF EXISTS uq_escala_visitas_celula_pessoa;
      CREATE UNIQUE INDEX uq_escala_visitas_celula_pessoa
        ON escala_visitas_celula (id_semana, id_loja, dia, id_regional)
        WHERE id_regional IS NOT NULL AND id_loja_destino IS NULL;
    `);

    const { rows: users } = await c.query(
      `SELECT id_usuario, nome, email FROM usuarios
       WHERE ativo = TRUE
         AND (
           LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com')
           OR nome ILIKE 'Kadu%'
         )
       ORDER BY CASE WHEN LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com') THEN 0 ELSE 1 END
       LIMIT 1`,
    );
    if (!users[0]) throw new Error('Usuário delivery (Kadu) não encontrado');
    const idKadu = users[0].id_usuario;
    console.log(`  Kadu #${idKadu} ${users[0].nome} <${users[0].email}>`);

    await c.query(
      `INSERT INTO usuario_permissoes (id_usuario, codigo)
       VALUES ($1, 'escalas.visitas.ver'), ($1, 'escalas.visitas.editar_delivery')
       ON CONFLICT DO NOTHING`,
      [idKadu],
    );
    await c.query(
      `DELETE FROM usuario_permissoes
       WHERE id_usuario = $1
         AND codigo IN (
           'escalas.visitas.editar_regiao',
           'escalas.visitas.gerenciar',
           'lojas.todas',
           'freelancers.aprovar',
           'frota.mapa.ver',
           'frota.regioes',
           'frota.gerenciar'
         )`,
      [idKadu],
    );

    const { rows: lojas } = await c.query(`SELECT id_loja, name FROM lojas WHERE is_active = TRUE`);
    const ancora = lojas.find((l) => norm(l.name) === 'delivery');
    if (!ancora) throw new Error('Loja DELIVERY não encontrada');

    const destinos = [];
    for (const item of ROTA) {
      const dest = matchLoja(lojas, item.chave);
      if (!dest) throw new Error(`Destino não encontrado: ${item.chave}`);
      destinos.push({ dia: item.dia, dest });
      console.log(`  dia ${item.dia} → ${dest.name} (#${dest.id_loja})`);
    }

    for (const semanaInicio of SEMANAS) {
      const { rows: sem } = await c.query(
        `INSERT INTO escala_visitas_semana (semana_inicio, observacao)
         VALUES ($1::date, 'Rota delivery vinculada ao Kadu')
         ON CONFLICT (semana_inicio) DO UPDATE SET atualizado_em = NOW()
         RETURNING id_semana`,
        [semanaInicio],
      );
      const idSemana = sem[0].id_semana;

      await c.query(
        `DELETE FROM escala_visitas_celula
         WHERE id_semana = $1 AND id_loja = $2 AND id_loja_destino IS NOT NULL`,
        [idSemana, ancora.id_loja],
      );

      for (const { dia, dest } of destinos) {
        await c.query(
          `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional, id_loja_destino)
           VALUES ($1, $2, $3, $4, $5)`,
          [idSemana, ancora.id_loja, dia, idKadu, dest.id_loja],
        );
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
        [idSemana, idKadu],
      );
      console.log(`  semana ${semanaInicio} id=${idSemana} — ${destinos.length} lojas do Kadu`);
    }

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
