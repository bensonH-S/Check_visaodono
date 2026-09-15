/**
 * Cadastra a turma da planilha de gestores (horário por dia + folga).
 * Uso:
 *   node backend/scripts/seed-escala-gestores-planilha.mjs
 *   node backend/scripts/seed-escala-gestores-planilha.mjs --semana=2026-09-14
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const { diasDaFolgaPadrao, garantirSchemaGestores } = await import('../src/escalaGestores.js');

const argDb = process.argv.find((a) => a.startsWith('--db='));
const argSemana = process.argv.find((a) => a.startsWith('--semana='));
const DB_NAME = argDb ? argDb.slice(5) : process.env.DB_NAME || 'vision_check';

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function segundaFeiraAtual() {
  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const d = new Date(`${hoje}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysIso(hoje, diff);
}

const SEMANA = argSemana ? argSemana.slice(9) : segundaFeiraAtual();

/** @type {Array<[string, string] | null>} 7 dias seg→dom */
const T = (ini, fim) => [ini, fim];

const TURMA = [
  {
    bk: '18915',
    nome: 'Nayara Borges',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('08:00', '16:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('14:00', '22:00'), null],
  },
  {
    bk: '19929',
    nome: 'Crislane',
    grupo: 'loja',
    folga: 'Quinta',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), null, T('14:00', '22:00'), T('14:00', '22:00'), T('15:00', '23:00')],
  },
  {
    bk: '20415',
    nome: 'Ana Lidia',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), null],
  },
  {
    bk: '21583',
    nome: 'Sthefany',
    grupo: 'loja',
    folga: 'Sábado',
    dias: [T('08:00', '16:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('13:30', '22:30'), T('13:30', '22:30'), null, T('14:30', '22:30')],
  },
  {
    bk: '23194',
    nome: 'Josimar',
    grupo: 'loja',
    folga: 'Quarta',
    dias: [T('17:00', '01:00'), T('17:00', '01:00'), null, T('17:00', '01:00'), T('17:00', '01:00'), T('17:00', '01:00'), T('17:00', '01:00')],
  },
  {
    bk: '23240',
    nome: 'Mateus Provisório',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), null],
  },
  {
    bk: '23531',
    nome: 'Raquel',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('08:00', '16:00'), null],
  },
  {
    bk: '24820',
    nome: 'Samia',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('08:00', '17:00'), T('08:00', '17:00'), T('08:00', '17:00'), T('08:00', '17:00'), T('08:00', '17:00'), T('08:00', '17:00'), null],
  },
  {
    bk: '25261',
    nome: 'Jessica',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('10:00', '18:00'), T('10:00', '16:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('10:00', '18:00'), T('10:00', '14:00'), null],
  },
  {
    bk: '27984',
    nome: 'Danielle',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('10:00', '18:00'), T('10:00', '18:00'), T('10:00', '18:00'), T('10:00', '18:00'), T('10:00', '18:00'), T('10:00', '18:00'), null],
  },
  {
    bk: '30769',
    nome: 'Carol',
    grupo: 'loja',
    folga: 'Quinta',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), null, T('09:00', '17:00'), T('10:00', '18:00'), T('16:00', '00:00')],
  },
  {
    bk: '30784',
    nome: 'Nadlia',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('10:00', '18:00'), T('10:00', '18:00'), T('10:00', '18:00'), T('10:00', '18:00'), T('10:00', '18:00'), T('10:00', '18:00'), null],
  },
  {
    bk: '30797',
    nome: 'Marciel',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), null],
  },
  {
    bk: '31608',
    nome: 'Elizabete',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), null],
  },
  {
    bk: '31614',
    nome: 'Simone',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), null],
  },
  {
    bk: '31782',
    nome: 'Jamily',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), null],
  },
  {
    bk: '32338',
    nome: 'Scarlat',
    grupo: 'loja',
    folga: 'combinado com Camilla',
    dias: [T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), T('09:00', '18:00'), null],
  },
  {
    bk: '32555',
    nome: 'Gabriella',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('08:00', '17:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('08:00', '16:00'), T('10:00', '20:00'), null],
  },
  {
    bk: '33104',
    nome: 'Wesley',
    grupo: 'loja',
    folga: 'Domingo',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('10:00', '20:00'), null],
  },
  {
    bk: '15022',
    nome: 'Lara',
    grupo: 'loja',
    folga: 'Quarta',
    dias: [T('08:00', '16:00'), T('08:00', '16:00'), null, T('12:00', '20:00'), T('14:00', '22:00'), T('14:00', '22:00'), T('12:00', '20:00')],
  },
  {
    bk: null,
    nome: 'Igor',
    grupo: 'campo',
    folga: 'Domingo',
    dias: [T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), T('09:00', '17:00'), null, null],
    tipos: { 5: 'ausencia' },
  },
  {
    bk: null,
    nome: 'Ceddu',
    grupo: 'campo',
    folga: 'Sábado e Domingo',
    dias: [T('16:00', '22:00'), T('16:00', '22:00'), T('16:00', '22:00'), T('16:00', '22:00'), T('16:00', '22:00'), null, null],
    tipos: { 5: 'ausencia', 6: 'ausencia' },
  },
  {
    bk: null,
    nome: 'Barbara',
    grupo: 'campo',
    folga: 'Quinta ou Domingo',
    dias: [T('16:00', '00:00'), T('16:00', '00:00'), T('14:00', '00:00'), null, T('17:00', '01:00'), T('00:00', '01:00'), T('00:00', '01:00')],
  },
];

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
  await garantirSchemaGestores(client);
  await client.query('BEGIN');
  const { rowCount: mortos } = await client.query(`
    UPDATE escala_gestores SET ativo = FALSE
    WHERE bk_number IN ('21658', '25266', '30970')
       OR (
         grupo = 'campo'
         AND translate(lower(btrim(nome)), 'áàâãéêíóôõúç', 'aaaaeeiooouc')
           IN ('renato', 'plinio', 'fagno', 'cadu dlv', 'cadu')
       )
  `);
  if (mortos) console.log(`Desativados ${mortos} cadastros fantasmas (21658 / 25266 / 30970)`);

  const { rows: lojas } = await client.query(
    `SELECT id_loja, name, bk_number FROM lojas WHERE is_active = TRUE`,
  );
  const lojaPorBk = new Map(
    lojas.filter((l) => l.bk_number).map((l) => [String(l.bk_number).trim(), l]),
  );

  let upserts = 0;
  let horarios = 0;
  let celulas = 0;
  const fim = addDaysIso(SEMANA, 6);

  for (let ordem = 0; ordem < TURMA.length; ordem += 1) {
    const g = TURMA[ordem];
    const bk = g.bk;
    const loja = bk ? lojaPorBk.get(bk) : null;
    const { rows: existentes } = await client.query(
      `SELECT id_gestor FROM escala_gestores
       WHERE ativo = TRUE AND LOWER(BTRIM(nome)) = LOWER(BTRIM($1))
         AND COALESCE(bk_number, '') = COALESCE($2, '')
       LIMIT 1`,
      [g.nome, bk],
    );
    let idGestor = existentes[0]?.id_gestor;
    if (!idGestor && bk) {
      const byBk = await client.query(
        `SELECT id_gestor FROM escala_gestores
         WHERE ativo = TRUE AND bk_number = $1
         LIMIT 1`,
        [bk],
      );
      idGestor = byBk.rows[0]?.id_gestor;
    }
    if (!idGestor) {
      const byNome = await client.query(
        `SELECT id_gestor FROM escala_gestores
         WHERE ativo = TRUE
           AND translate(lower(btrim(nome)), 'áàâãéêíóôõúç', 'aaaaeeiooouc')
             = translate(lower(btrim($1)), 'áàâãéêíóôõúç', 'aaaaeeiooouc')
         LIMIT 1`,
        [g.nome],
      );
      idGestor = byNome.rows[0]?.id_gestor;
    }
    if (!idGestor && g.grupo === 'loja' && !loja) {
      console.warn(`PULOU ${g.nome} BKN ${bk} — loja não existe, não cria fantasma`);
      continue;
    }
    if (!idGestor) {
      const ins = await client.query(
        `INSERT INTO escala_gestores (id_loja, bk_number, nome, grupo, folga_padrao, ordem, ativo)
         VALUES ($1,$2,$3,$4,$5,$6, TRUE)
         RETURNING id_gestor`,
        [loja?.id_loja || null, bk, g.nome, g.grupo, g.folga, ordem + 1],
      );
      idGestor = ins.rows[0].id_gestor;
    } else {
      await client.query(
        `UPDATE escala_gestores
         SET nome = $6,
             id_loja = COALESCE($2, id_loja),
             bk_number = COALESCE($7, bk_number),
             grupo = $3,
             folga_padrao = $4,
             ordem = $5,
             ativo = TRUE
         WHERE id_gestor = $1`,
        [idGestor, loja?.id_loja || null, g.grupo, g.folga, ordem + 1, g.nome, bk],
      );
    }
    upserts += 1;
    if (bk && !loja) console.warn(`Loja BKN ${bk} não encontrada (${g.nome})`);

    await client.query(
      `DELETE FROM escala_gestores_celula WHERE id_gestor = $1 AND data >= $2::date AND data <= $3::date`,
      [idGestor, SEMANA, fim],
    );
    await client.query(
      `DELETE FROM escala_gestores_horario WHERE id_gestor = $1 AND data >= $2::date AND data <= $3::date`,
      [idGestor, SEMANA, fim],
    );

    const diasFolga = diasDaFolgaPadrao(g.folga);
    const tipos = g.tipos || {};
    for (let dia = 0; dia < 7; dia += 1) {
      const data = addDaysIso(SEMANA, dia);
      const tipo = tipos[dia] || (diasFolga.includes(dia) ? 'folga' : null);
      if (tipo) {
        await client.query(
          `INSERT INTO escala_gestores_celula (id_gestor, data, tipo)
           VALUES ($1, $2::date, $3)
           ON CONFLICT (id_gestor, data) DO UPDATE SET tipo = EXCLUDED.tipo`,
          [idGestor, data, tipo],
        );
        celulas += 1;
        continue;
      }
      const hr = g.dias[dia];
      if (!hr) continue;
      await client.query(
        `INSERT INTO escala_gestores_horario (id_gestor, data, hora_inicio, hora_fim)
         VALUES ($1, $2::date, $3::time, $4::time)
         ON CONFLICT (id_gestor, data) DO UPDATE
           SET hora_inicio = EXCLUDED.hora_inicio, hora_fim = EXCLUDED.hora_fim`,
        [idGestor, data, `${hr[0]}:00`, `${hr[1]}:00`],
      );
      horarios += 1;
    }
  }

  await client.query('COMMIT');
  console.log(`OK ${DB_NAME} semana ${SEMANA}`);
  console.log(`  gestores: ${upserts}`);
  console.log(`  horários: ${horarios}`);
  console.log(`  células: ${celulas}`);
} catch (e) {
  await client.query('ROLLBACK');
  console.error('Falha:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
  process.exit(process.exitCode || 0);
}
