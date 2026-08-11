/**
 * Reimporta a planilha Time de Campo 10/08–16/08/2026.
 * Uso:
 *   node backend/scripts/seed-escala-planilha-2026-08-10.mjs
 *   node backend/scripts/seed-escala-planilha-2026-08-10.mjs --db=vision_check
 *   node backend/scripts/seed-escala-planilha-2026-08-10.mjs --db=vision_check_dev
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const argDb = process.argv.find((a) => a.startsWith('--db='));
const DB_NAME = argDb ? argDb.slice(5) : process.env.DB_NAME || 'vision_check_dev';
const SEMANA_INICIO = '2026-08-10';

/** loja key (match parcial no name) → [SEG..DOM] nomes */
const GRADE = [
  { loja: '408 SUL', dias: ['Fagno', '', '', 'Fagno', '', '', ''] },
  { loja: '201 NORTE', dias: ['Igor', 'Plinio', '', 'Renato', 'Plinio', '', 'Plinio'] },
  { loja: 'LAGO SUL', dias: ['Igor', '', '', 'Renato', 'Fagno', 'Renato', ''] },
  { loja: 'DF PLAZA', dias: ['Barbara', '', 'Barbara', '', 'Igor', '', ''] },
  { loja: 'CALDAS', dias: ['', '', '', '', '', '', ''] },
  { loja: 'SUDOESTE', dias: ['Fagno', 'Igor', '', 'Fagno', 'Fagno', '', 'Fagno'] },
  { loja: '706/7 NORTE', dias: ['Renato', 'Plinio', '', '', 'Renato', 'Igor', ''] },
  { loja: 'CEILANDIA', dias: ['', '', '', '', '', 'Fagno', ''] },
  { loja: 'VENANCIO', dias: ['', 'Fagno', '', '', '', '', ''] },
  { loja: 'PLANALTINA', dias: ['', '', 'Igor', '', '', 'Plinio', ''] },
  { loja: 'RECANTO', dias: ['', '', 'Barbara', '', 'Barbara', '', 'Barbara'] },
  { loja: 'SOBRADINHO', dias: ['', '', 'Igor', '', '', 'Plinio', ''] },
  { loja: 'TERRACO', dias: ['', 'Igor', '', '', '', '', ''] },
  { loja: 'NOROESTE', dias: ['', '', '', '', 'Plinio', 'Igor', 'Plinio'] },
  { loja: 'SAMAMBAIA', dias: ['', '', '', '', '', '', 'Barbara'] },
  { loja: 'PONTE ALTA', dias: ['Barbara', '', '', 'Igor', 'Barbara', 'Barbara', ''] },
  { loja: 'UNAI', dias: ['', '', '', '', '', '', ''] },
  { loja: 'ESTRUTURAL', dias: ['', 'Fagno', '', '', 'Renato', 'Fagno', 'Fagno'] },
  { loja: 'SAO SEBASTIAO', dias: ['', '', 'Plinio', '', '', 'Renato', ''] },
  { loja: 'VALPARAISO', dias: ['', 'Barbara', '', '', '', 'Barbara', ''] },
];

const ROTA_DELIVERY = [
  { dia: 0, loja: 'SAMAMBAIA' },
  { dia: 1, loja: 'NOROESTE' },
  { dia: 2, loja: 'ESTRUTURAL' },
  { dia: 3, loja: 'SUDOESTE' },
  { dia: 4, loja: 'PONTE ALTA' },
  { dia: 5, loja: 'RECANTO' },
];

const ALIASES = {
  renato: ['renato frota', 'renato'],
  barbara: ['barbara', 'bárbara'],
  igor: ['igor'],
  plinio: ['plinio'],
  fagno: ['fagno'],
};

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
    // prefer exact tail match
    const exact = hits.find((l) => norm(l.name).split(' - ').pop() === n || norm(l.name).endsWith(n));
    return exact || hits[0];
  }
  return null;
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');
  console.log(`DB: ${DB_NAME}`);

  // Kadu = delivery
  const { rows: delUsers } = await client.query(
    `SELECT id_usuario FROM usuarios
     WHERE ativo AND (
       LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com')
       OR nome ILIKE 'Kadu%'
       OR (nome ILIKE 'Carlos' AND email ILIKE '%delivery%')
     )
     ORDER BY CASE WHEN LOWER(email)=LOWER('deliverygrupoalvim2025@gmail.com') THEN 0 ELSE 1 END
     LIMIT 1`,
  );
  if (!delUsers[0]) throw new Error('Usuário delivery não encontrado');
  const idKadu = delUsers[0].id_usuario;
  await client.query(
    `UPDATE usuarios SET nome='Kadu', avatar_inicial='KA', cargo='Delivery' WHERE id_usuario=$1`,
    [idKadu],
  );
  await client.query(
    `INSERT INTO usuario_permissoes (id_usuario, codigo)
     VALUES ($1,'escalas.visitas.ver'),($1,'escalas.visitas.editar_delivery')
     ON CONFLICT DO NOTHING`,
    [idKadu],
  );
  await client.query(
    `DELETE FROM usuario_permissoes
     WHERE id_usuario=$1 AND codigo IN ('escalas.visitas.editar_regiao','escalas.visitas.gerenciar')`,
    [idKadu],
  );

  const { rows: users } = await client.query(
    `SELECT id_usuario, nome FROM usuarios WHERE ativo = TRUE`,
  );
  const mapPessoa = {};
  for (const [chave, aliases] of Object.entries(ALIASES)) {
    const u = users.find((x) => aliases.some((a) => norm(x.nome) === norm(a) || norm(x.nome).startsWith(norm(a))));
    if (!u) throw new Error(`Pessoa não encontrada: ${chave}`);
    mapPessoa[chave] = u.id_usuario;
    console.log(`  ${chave} → #${u.id_usuario} ${u.nome}`);
  }

  const { rows: lojas } = await client.query(`SELECT id_loja, name FROM lojas WHERE is_active = TRUE`);
  const lojaDelivery = lojas.find((l) => norm(l.name) === 'delivery');
  if (!lojaDelivery) throw new Error('Loja DELIVERY não encontrada');

  const { rows: semRows } = await client.query(
    `INSERT INTO escala_visitas_semana (semana_inicio, observacao)
     VALUES ($1::date, 'Planilha Time de Campo — 10/08 a 16/08/2026')
     ON CONFLICT (semana_inicio) DO UPDATE SET observacao = EXCLUDED.observacao
     RETURNING id_semana`,
    [SEMANA_INICIO],
  );
  const idSemana = semRows[0].id_semana;

  // Zera a semana e reimporta (bate 100% com a planilha)
  await client.query(`DELETE FROM escala_visitas_celula WHERE id_semana = $1`, [idSemana]);

  let visitas = 0;
  let faltandoLoja = 0;
  for (const row of GRADE) {
    const loja = matchLoja(lojas, row.loja);
    if (!loja) {
      console.warn(`Loja não encontrada: ${row.loja}`);
      faltandoLoja++;
      continue;
    }
    for (let dia = 0; dia < 7; dia++) {
      const nome = row.dias[dia];
      if (!nome) continue;
      const chave = norm(nome).replace('á', 'a');
      const idRegional = mapPessoa[chave];
      if (!idRegional) {
        console.warn(`Pessoa não mapeada: ${nome}`);
        continue;
      }
      await client.query(
        `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional)
         VALUES ($1,$2,$3,$4)`,
        [idSemana, loja.id_loja, dia, idRegional],
      );
      visitas++;
    }
  }

  let delivery = 0;
  for (const item of ROTA_DELIVERY) {
    const dest = matchLoja(lojas, item.loja);
    if (!dest) {
      console.warn(`Destino delivery não encontrado: ${item.loja}`);
      continue;
    }
    await client.query(
      `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_loja_destino)
       VALUES ($1,$2,$3,$4)`,
      [idSemana, lojaDelivery.id_loja, item.dia, dest.id_loja],
    );
    delivery++;
    console.log(`  DELIVERY dia ${item.dia} → ${dest.name}`);
  }

  await client.query(
    `INSERT INTO escala_visitas_delivery_status (id_semana, status)
     VALUES ($1, 'rascunho')
     ON CONFLICT (id_semana) DO UPDATE SET status = 'rascunho'`,
    [idSemana],
  );

  await client.query('COMMIT');
  console.log(`\nOK ${DB_NAME} semana ${SEMANA_INICIO}`);
  console.log(`  visitas: ${visitas}`);
  console.log(`  delivery: ${delivery}`);
  if (faltandoLoja) console.log(`  lojas faltando: ${faltandoLoja}`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Falha:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
