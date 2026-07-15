/**
 * Importa escala da semana 13/07–19/07/2026 (planilha Escala Grupo Alvim).
 * Uso: node backend/scripts/seed-escala-semana-2026-07-13.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const SEMANA_INICIO = '2026-07-13';

/**
 * Grade principal — dias SEG…DOM (0–6).
 * Valor: string com 1 nome, ou array para multi-regional (ex.: I/R = Igor+Renato).
 */
const GRADE_EXCEL = [
  { bkn: '18915', nome: '408 SUL', dias: ['', '', '', '', 'Fagno', '', 'Fagno'] },
  { bkn: '19929', nome: '201 NORTE', dias: ['', '', '', 'Renato', '', '', ''] },
  { bkn: '20415', nome: 'LAGO SUL', dias: ['Renato', '', 'Fagno', 'Renato', 'Fagno', '', ''] },
  { bkn: '21583', nome: 'DF PLAZA', dias: ['', 'Barbara', 'Renato', '', '', 'Barbara', ''] },
  { bkn: '23194', nome: 'CALDAS NOVAS', dias: ['', '', '', '', '', '', ''] },
  { bkn: '23240', nome: 'SUDOESTE', dias: ['Fagno', '', '', 'Fagno', '', '', 'Fagno'] },
  { bkn: '23531', nome: '706/7 NORTE', dias: ['Plinio', 'Plinio', '', '', 'Plinio', 'Renato', ''] },
  { bkn: '24820', nome: 'CEILÂNDIA', dias: ['', '', 'Renato', 'Igor', '', '', ''] },
  { bkn: '25261', nome: 'VENÂNCIO', dias: ['', '', 'Fagno', '', '', 'Fagno', ''] },
  { bkn: '27984', nome: 'PLANALTINA', dias: ['', '', '', '', 'Renato', 'Plinio', ''] },
  { bkn: '30769', nome: 'RECANTO', dias: ['Barbara', '', '', '', 'Barbara', '', 'Barbara'] },
  { bkn: '30784', nome: 'SOBRADINHO', dias: ['', '', '', '', 'Renato', 'Plinio', ''] },
  { bkn: '30797', nome: 'TERRAÇO', dias: ['', '', '', 'Fagno', '', '', 'Fagno'] },
  { bkn: '31608', nome: 'NOROESTE', dias: ['Plinio', '', '', '', 'Plinio', 'Renato', ''] },
  { bkn: '31614', nome: 'SAMBAIA', dias: ['', 'Barbara', 'Renato', '', '', 'Barbara', 'Barbara'] },
  { bkn: '31782', nome: 'PONTE ALTA', dias: ['Barbara', '', '', '', 'Barbara', '', ''] },
  { bkn: '32338', nome: 'UNAÍ', dias: ['', '', '', '', '', '', ''] },
  { bkn: '32555', nome: 'ESTRUTURAL', dias: ['Fagno', '', '', '', '', 'Fagno', ''] },
  // I/R na segunda = Igor + Renato
  {
    bkn: '33104',
    nome: 'SÃO SEBASTIÃO',
    dias: [['Igor', 'Renato'], 'Igor', 'Plinio', 'Igor', '', '', 'Plinio'],
  },
  { bkn: '15022', nome: 'POPEYES VALPARAÍSO', dias: ['', '', 'Barbara', '', '', '', ''] },
];

/** Mini-grid Cadu (preenche só célula vazia na grade principal) */
const ROTA_CADU = [
  { bkn: '24820', dia: 0, label: 'Ceilândia' },
  { bkn: '23531', dia: 1, label: '707 Norte' },
  { bkn: '23240', dia: 2, label: 'Sudoeste' },
  { bkn: '20415', dia: 3, label: 'Lago Sul' },
  { bkn: '32555', dia: 4, label: 'Estrutural' },
];

const ALIASES = {
  renato: 'Renato Frota',
  barbara: 'Barbara',
  fagno: 'Fagno',
  plinio: 'Plinio',
  igor: 'Igor',
  kadu: 'Kadu DLV',
  cadu: 'Kadu DLV',
};

function normNome(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function nomesDoDia(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim()).filter(Boolean);
  const s = String(valor).trim();
  if (!s) return [];
  // I/R, I+R, Igor/Renato
  if (/^i\s*[\/+&]\s*r$/i.test(s) || /^igor\s*[\/+&]\s*renato$/i.test(s)) {
    return ['Igor', 'Renato'];
  }
  return [s];
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

  const emailPreferido = {
    'Renato Frota': 'frotadf@gmail.com',
    Barbara: 'barbara@grupoalvim.com.br',
    Fagno: 'fagno@grupoalvim.com.br',
    Plinio: 'plinio@grupoalvim.com.br',
    Igor: 'igor@grupoalvim.com.br',
  };
  const email =
    emailPreferido[nomeExibicao] ||
    `${normNome(chave).replace(/\s+/g, '.')}@grupoalvim.com.br`;

  const { rows: byEmail } = await client.query(
    `SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
  if (byEmail[0]) return byEmail[0].id_usuario;

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
      `SELECT id_loja, bk_number, name FROM lojas WHERE is_active = TRUE`,
    );
    const lojaPorBk = new Map(lojas.map((l) => [String(l.bk_number).trim(), l]));

    const { rows: semRows } = await client.query(
      `INSERT INTO escala_visitas_semana (semana_inicio, observacao)
       VALUES ($1::date, 'Importado da planilha — semana 13/07 a 19/07/2026')
       ON CONFLICT (semana_inicio) DO UPDATE SET observacao = EXCLUDED.observacao, atualizado_em = NOW()
       RETURNING id_semana`,
      [SEMANA_INICIO],
    );
    const idSemana = semRows[0].id_semana;

    await client.query('DELETE FROM escala_visitas_celula WHERE id_semana = $1', [idSemana]);

    /** key: `${idLoja}-${dia}-${idRegional}` */
    const grid = new Map();

    function addCelula(idLoja, dia, chaveNome, lojaLabel) {
      const chave = normNome(chaveNome);
      let idRegional = mapRegional[chave];
      if (!idRegional) idRegional = mapRegional[chave.replace('á', 'a')];
      if (!idRegional) {
        console.warn(`Regional não mapeado: ${chaveNome} (${lojaLabel} dia ${dia})`);
        return false;
      }
      const key = `${idLoja}-${dia}-${idRegional}`;
      grid.set(key, { id_loja: idLoja, dia, id_regional: idRegional });
      return true;
    }

    for (const row of GRADE_EXCEL) {
      const loja = lojaPorBk.get(row.bkn);
      if (!loja) {
        console.warn(`Loja BKN ${row.bkn} (${row.nome}) não encontrada`);
        continue;
      }
      row.dias.forEach((valor, dia) => {
        for (const nome of nomesDoDia(valor)) {
          addCelula(loja.id_loja, dia, nome, row.nome);
        }
      });
    }

    for (const r of ROTA_CADU) {
      const loja = lojaPorBk.get(r.bkn);
      if (!loja) continue;
      const jaTemRegional = [...grid.values()].some(
        (c) => c.id_loja === loja.id_loja && c.dia === r.dia,
      );
      if (!jaTemRegional) {
        addCelula(loja.id_loja, r.dia, 'Cadu', `Cadu→${r.label}`);
      } else {
        console.log(`  Cadu ${r.label} dia ${r.dia}: já há regional na grade — mantido`);
      }
    }

    let inseridos = 0;
    for (const cell of grid.values()) {
      await client.query(
        `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional)
         VALUES ($1, $2, $3, $4)`,
        [idSemana, cell.id_loja, cell.dia, cell.id_regional],
      );
      inseridos++;
    }

    await client.query('COMMIT');
    console.log(`\nOK — semana ${SEMANA_INICIO} (13/07 a 19/07/2026)`);
    console.log(`  Células inseridas: ${inseridos}`);
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
