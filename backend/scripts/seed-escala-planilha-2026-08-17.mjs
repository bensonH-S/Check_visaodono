/**
 * Importa a planilha Time de Campo 17/08–23/08/2026.
 * Uso:
 *   node backend/scripts/seed-escala-planilha-2026-08-17.mjs
 *   node backend/scripts/seed-escala-planilha-2026-08-17.mjs --db=vision_check
 *   node backend/scripts/seed-escala-planilha-2026-08-17.mjs --db=vision_check_dev
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
const SEMANA_INICIO = '2026-08-17';

/** loja key → [SEG..DOM] texto da célula (pode ter duas pessoas: "R / I") */
const GRADE = [
  { loja: '408 SUL', dias: ['Fagno', 'R / I', 'R / F', '', '', 'Fagno', ''] },
  { loja: '201 NORTE', dias: ['', '', '', '', 'Plinio', 'Renato', ''] },
  { loja: 'LAGO SUL', dias: ['Igor', '', '', 'Renato', '', 'Renato', ''] },
  { loja: 'DF PLAZA', dias: ['', 'Barbara', 'Barbara', 'Barbara', 'Barbara', 'Igor', ''] },
  { loja: 'CALDAS', dias: ['', '', '', '', '', '', ''] },
  { loja: 'SUDOESTE', dias: ['Fagno', 'Fagno', '', 'Fagno', '', '', ''] },
  { loja: '706/7 NORTE', dias: ['Renato', '', '', 'Igor', 'Plinio', 'Plinio', ''] },
  { loja: 'CEILANDIA', dias: ['', '', '', '', 'Fagno', '', ''] },
  { loja: 'VENANCIO', dias: ['', 'R / F', 'R / F', '', '', '', ''] },
  { loja: 'PLANALTINA', dias: ['', 'Plinio', '', '', '', '', ''] },
  { loja: 'RECANTO', dias: ['', 'Barbara', '', '', 'Barbara', '', ''] },
  { loja: 'SOBRADINHO', dias: ['', 'Plinio', '', '', '', '', ''] },
  { loja: 'TERRACO', dias: ['', '', '', 'Fagno', '', '', ''] },
  { loja: 'NOROESTE', dias: ['Plinio', '', '', 'Igor', '', 'Plinio', 'Plinio'] },
  { loja: 'SAMAMBAIA', dias: ['', 'Renato', 'R / B', '', '', '', ''] },
  { loja: 'PONTE ALTA', dias: ['Barbara', '', '', 'Barbara', 'Igor', 'Barbara', ''] },
  { loja: 'UNAI', dias: ['', '', '', '', '', '', ''] },
  { loja: 'ESTRUTURAL', dias: ['', '', '', 'Renato', 'Fagno', '', ''] },
  { loja: 'SAO SEBASTIAO', dias: ['', '', 'Plinio', '', 'Renato', '', ''] },
  { loja: 'VALPARAISO', dias: ['Barbara', '', '', '', '', 'Barbara', ''] },
];

const ROTA_DELIVERY = [
  { dia: 0, loja: 'SAMAMBAIA' },
  { dia: 1, loja: 'LAGO SUL' },
  { dia: 2, loja: 'SOBRADINHO' },
  { dia: 3, loja: 'TERRACO' },
  { dia: 4, loja: 'VENANCIO' },
  { dia: 5, loja: 'CEILANDIA' },
];

const ALIASES = {
  renato: ['renato frota', 'renato'],
  barbara: ['barbara', 'bárbara'],
  igor: ['igor'],
  plinio: ['plinio'],
  fagno: ['fagno'],
};

const LETRA = {
  r: 'renato',
  i: 'igor',
  f: 'fagno',
  b: 'barbara',
  p: 'plinio',
};

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function pessoasDaCelula(texto) {
  const s = String(texto || '').trim();
  if (!s) return [];
  const nFull = norm(s);
  if (!nFull || nFull === 'folga' || nFull.startsWith('visita ')) return [];
  const partes = s.split(/[/,]+/).map((p) => p.trim()).filter(Boolean);
  const chaves = [];
  for (const parte of partes) {
    const n = norm(parte);
    if (!n) continue;
    if (LETRA[n]) {
      chaves.push(LETRA[n]);
      continue;
    }
    const hit = Object.keys(ALIASES).find(
      (k) => n === k || n.startsWith(`${k} `) || ALIASES[k].some((a) => n === norm(a) || n.startsWith(`${norm(a)} `)),
    );
    if (hit) chaves.push(hit);
  }
  return [...new Set(chaves)];
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
    const exact = hits.find(
      (l) => norm(l.name).split(' - ').pop() === n || norm(l.name).endsWith(n),
    );
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
    const u = users.find((x) =>
      aliases.some((a) => norm(x.nome) === norm(a) || norm(x.nome).startsWith(norm(a))),
    );
    if (!u) throw new Error(`Pessoa não encontrada: ${chave}`);
    mapPessoa[chave] = u.id_usuario;
    console.log(`  ${chave} → #${u.id_usuario} ${u.nome}`);
  }

  const { rows: lojas } = await client.query(`SELECT id_loja, name FROM lojas WHERE is_active = TRUE`);
  const lojaDelivery = lojas.find((l) => norm(l.name) === 'delivery');
  if (!lojaDelivery) throw new Error('Loja DELIVERY não encontrada');

  const { rows: semRows } = await client.query(
    `INSERT INTO escala_visitas_semana (semana_inicio, observacao)
     VALUES ($1::date, 'Planilha Time de Campo — 17/08 a 23/08/2026')
     ON CONFLICT (semana_inicio) DO UPDATE SET observacao = EXCLUDED.observacao
     RETURNING id_semana`,
    [SEMANA_INICIO],
  );
  const idSemana = semRows[0].id_semana;

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
      const pessoas = pessoasDaCelula(row.dias[dia]);
      for (const chave of pessoas) {
        const idRegional = mapPessoa[chave];
        if (!idRegional) {
          console.warn(`Pessoa não mapeada: ${chave} (${row.dias[dia]})`);
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
     ON CONFLICT (id_semana) DO UPDATE SET
       status = 'rascunho',
       submetido_por = NULL,
       submetido_em = NULL,
       revisado_por = NULL,
       revisado_em = NULL,
       comentario = NULL`,
    [idSemana],
  );

  await client.query(
    `UPDATE escala_visitas_regiao_status
     SET status = 'rascunho',
         submetido_por = NULL,
         submetido_em = NULL,
         revisado_por = NULL,
         revisado_em = NULL,
         comentario = NULL
     WHERE id_semana = $1`,
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
