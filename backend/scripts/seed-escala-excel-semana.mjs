/**
 * Importa escala da semana 29/06–05/07/2026 (Excel Escala Grupo Alvim).
 * Uso: node backend/scripts/seed-escala-excel-semana.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const SEMANA_INICIO = '2026-06-29';

/** Grade principal (loja × dia) — transcrita do Excel */
const GRADE_EXCEL = [
  { bkn: '18915', dias: ['Fagno', 'Renato', 'Fagno', '', '', 'Fagno', ''] },
  { bkn: '19929', dias: ['', 'Renato', '', 'Plinio', '', 'Plinio', 'Plinio'] },
  { bkn: '20415', dias: ['Fagno', 'Renato', 'Fagno', '', '', 'Fagno', ''] },
  { bkn: '21583', dias: ['Barbara', '', '', 'Kadu', '', '', ''] },
  { bkn: '23194', dias: ['', '', '', '', '', '', ''] },
  { bkn: '23240', dias: ['', '', 'Kadu', 'Fagno', '', '', ''] },
  { bkn: '23531', dias: ['Renato', 'Igor', '', 'Plinio', 'Igor', 'Plinio', 'Plinio'] },
  { bkn: '24820', dias: ['Fagno', '', 'Igor', '', 'Fagno', '', ''] },
  { bkn: '25261', dias: ['', 'Igor', '', '', '', '', ''] },
  { bkn: '27984', dias: ['', '', 'Renato', '', 'Plinio', '', ''] },
  { bkn: '30769', dias: ['', '', 'Barbara', 'Renato', 'Barbara', '', 'Barbara'] },
  { bkn: '30784', dias: ['', '', 'Renato', '', 'Plinio', '', ''] },
  { bkn: '30797', dias: ['', '', '', 'Fagno', 'Renato', '', ''] },
  { bkn: '31608', dias: ['', '', '', 'Plinio', '', 'Renato', ''] },
  { bkn: '31614', dias: ['Barbara', '', 'Barbara', '', '', '', ''] },
  { bkn: '31782', dias: ['', 'Barbara', '', '', 'Barbara', 'Barbara', 'Barbara'] },
  { bkn: '32338', dias: ['', '', '', '', '', '', ''] },
  { bkn: '32555', dias: ['', '', '', '', 'Fagno', '', 'Fagno'] },
  { bkn: '33104', dias: ['Igor', '', 'Plinio', 'Igor', '', 'Igor', ''] },
  { bkn: '15022', dias: ['', 'Barbara', '', 'Renato', '', 'Barbara', ''] },
];

/** Rota Kadu (mini-grid inferior) — só preenche célula vazia */
const ROTA_KADU = [
  { bkn: '31614', dia: 0 },
  { bkn: '30769', dia: 1 },
  { bkn: '23240', dia: 2 },
  { bkn: '21583', dia: 3 },
  { bkn: '31782', dia: 5 },
];

const ALIASES = {
  renato: 'Renato Frota',
  barbara: 'Barbara',
  barbara2: 'Barbara',
  fagno: 'Fagno',
  plinio: 'Plinio',
  igor: 'Igor',
  kadu: 'Kadu DLV',
};

function normNome(s) {
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

async function garantirRegional(client, chave, nomeExibicao) {
  const { rows } = await client.query(
    `SELECT id_usuario FROM usuarios WHERE ativo = TRUE AND (
       LOWER(nome) = LOWER($1) OR LOWER(nome) LIKE LOWER($2)
     ) LIMIT 1`,
    [nomeExibicao, `${nomeExibicao.split(' ')[0]}%`],
  );
  if (rows[0]) return rows[0].id_usuario;

  const email = `${normNome(chave).replace(/\s+/g, '.')}@grupoalvim.com.br`;
  const { rows: ins } = await client.query(
    `INSERT INTO usuarios (nome, email, cargo, cargo_aprovacao, avatar_inicial, perfil, ativo)
     VALUES ($1, $2, 'Regional', 'supervisor_regional', $3, 'gerente'::perfil_usuario, TRUE)
     ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, ativo = TRUE
     RETURNING id_usuario`,
    [nomeExibicao, email, nomeExibicao.slice(0, 2).toUpperCase()],
  );
  const id = ins[0].id_usuario;
  await client.query(
    `INSERT INTO usuario_permissoes (id_usuario, codigo) VALUES ($1, 'escalas.visitas.ver'), ($1, 'frota.usar')
     ON CONFLICT DO NOTHING`,
    [id],
  );
  console.log(`  + Regional criado: ${nomeExibicao} (${email})`);
  return id;
}

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mapRegional = {};
    for (const [k, nome] of Object.entries(ALIASES)) {
      mapRegional[k] = await garantirRegional(client, k, nome);
    }

    const { rows: lojas } = await client.query(
      `SELECT id_loja, bk_number FROM lojas WHERE is_active = TRUE`,
    );
    const lojaPorBk = new Map(lojas.map((l) => [String(l.bk_number).trim(), l.id_loja]));

    const { rows: semRows } = await client.query(
      `INSERT INTO escala_visitas_semana (semana_inicio, observacao)
       VALUES ($1::date, 'Importado do Excel — semana 29/06 a 05/07/2026')
       ON CONFLICT (semana_inicio) DO UPDATE SET observacao = EXCLUDED.observacao
       RETURNING id_semana`,
      [SEMANA_INICIO],
    );
    const idSemana = semRows[0].id_semana;

    await client.query('DELETE FROM escala_visitas_celula WHERE id_semana = $1', [idSemana]);

    const grid = new Map();
    for (const row of GRADE_EXCEL) {
      const idLoja = lojaPorBk.get(row.bkn);
      if (!idLoja) {
        console.warn(`Loja BKN ${row.bkn} não encontrada`);
        continue;
      }
      row.dias.forEach((nome, dia) => {
        if (!nome) return;
        grid.set(`${idLoja}-${dia}`, { id_loja: idLoja, dia, chave: normNome(nome) });
      });
    }

    for (const r of ROTA_KADU) {
      const idLoja = lojaPorBk.get(r.bkn);
      if (!idLoja) continue;
      const key = `${idLoja}-${r.dia}`;
      if (!grid.has(key)) {
        grid.set(key, { id_loja: idLoja, dia: r.dia, chave: 'kadu' });
      }
    }

    let inseridos = 0;
    let ignorados = 0;
    for (const cell of grid.values()) {
      let idRegional = mapRegional[cell.chave];
      if (!idRegional) {
        const alias = cell.chave.replace('á', 'a');
        idRegional = mapRegional[alias];
      }
      if (!idRegional) {
        console.warn(`Regional não mapeado: ${cell.chave}`);
        ignorados++;
        continue;
      }
      await client.query(
        `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional)
         VALUES ($1, $2, $3, $4)`,
        [idSemana, cell.id_loja, cell.dia, idRegional],
      );
      inseridos++;
    }

    await client.query('COMMIT');
    console.log(`\nOK — semana ${SEMANA_INICIO}`);
    console.log(`  Células inseridas: ${inseridos}`);
    if (ignorados) console.log(`  Ignoradas: ${ignorados}`);
    console.log('\nRegionais:', mapRegional);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
