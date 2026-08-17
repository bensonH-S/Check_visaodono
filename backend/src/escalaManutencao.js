import { pool } from './db.js';
import {
  segundaFeiraDaSemana,
  podeVerEscalaVisitas,
  podeGerenciarEscalaVisitas,
  lojaExcluidaDaGradeEscala,
} from './escalaVisitas.js';

let schemaOk = false;

export async function garantirSchemaManutencao(client = pool) {
  if (schemaOk) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_manutencao_visita (
      id_celula SERIAL PRIMARY KEY,
      id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      data DATE NOT NULL,
      id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
      UNIQUE (id_usuario, data, id_loja)
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_escala_manutencao_visita_data
      ON escala_manutencao_visita (data, id_usuario)
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_manutencao_horario (
      id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      data DATE NOT NULL,
      hora_inicio TIME,
      hora_fim TIME,
      PRIMARY KEY (id_usuario, data)
    )
  `);
  schemaOk = true;
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function horaSql(v) {
  if (v == null || v === '') return null;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

function horaApi(v) {
  if (v == null || v === '') return null;
  return String(v).slice(0, 5);
}

export async function carregarGradeManutencao(user, { semana_inicio } = {}) {
  if (!podeVerEscalaVisitas(user)) {
    throw new Error('Sem permissão para ver a escala de manutenção');
  }
  await garantirSchemaManutencao();
  const inicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const fim = addDaysIso(inicio, 6);

  const { rows: tecnicosRows } = await pool.query(
    `SELECT u.id_usuario, u.nome,
            MIN(r.id_regiao) AS id_regiao,
            MIN(r.nome) AS nome_regiao
     FROM usuarios u
     LEFT JOIN frota_regiao_tecnicos rt ON rt.id_usuario = u.id_usuario
     LEFT JOIN frota_regioes r ON r.id_regiao = rt.id_regiao AND r.ativo = TRUE
     WHERE u.ativo = TRUE AND u.perfil = 'tecnico'
     GROUP BY u.id_usuario, u.nome
     ORDER BY MIN(r.id_regiao) NULLS LAST, u.nome`,
  );

  const { rows: lojaRows } = await pool.query(
    `SELECT l.id_loja, l.name, l.bk_number
     FROM lojas l
     WHERE l.is_active = TRUE
     ORDER BY
       CASE
         WHEN TRIM(l.bk_number) = '15022'
           OR UPPER(TRIM(l.name)) LIKE '%VALPARA%'
         THEN 1
         ELSE 0
       END,
       COALESCE(NULLIF(TRIM(l.bk_number), ''), '99999'),
       l.name`,
  );

  const { rows: visitaRows } = await pool.query(
    `SELECT id_usuario, data::text AS data, id_loja
     FROM escala_manutencao_visita
     WHERE data >= $1::date AND data <= $2::date`,
    [inicio, fim],
  );

  const tecnicos = tecnicosRows.map((t) => ({
    id_usuario: Number(t.id_usuario),
    nome: t.nome,
    id_regiao: t.id_regiao != null ? Number(t.id_regiao) : null,
    nome_regiao: t.nome_regiao || null,
    grupo: t.nome_regiao || 'Sem região',
  }));

  const lojas = lojaRows
    .filter((l) => !lojaExcluidaDaGradeEscala(l.name))
    .map((l) => ({
      id_loja: Number(l.id_loja),
      nome: l.name,
      bk_number: l.bk_number || null,
    }));

  const visitas = visitaRows.map((v) => {
    const data = String(v.data).slice(0, 10);
    const dia = Math.round((new Date(`${data}T12:00:00`) - new Date(`${inicio}T12:00:00`)) / 86400000);
    return {
      id_usuario: Number(v.id_usuario),
      dia,
      id_loja: Number(v.id_loja),
    };
  }).filter((v) => v.dia >= 0 && v.dia <= 6);

  const { rows: horarioRows } = await pool.query(
    `SELECT id_usuario, data::text AS data, hora_inicio::text AS hora_inicio, hora_fim::text AS hora_fim
     FROM escala_manutencao_horario
     WHERE data >= $1::date AND data <= $2::date`,
    [inicio, fim],
  );
  const horarios = horarioRows.map((h) => {
    const data = String(h.data).slice(0, 10);
    const dia = Math.round((new Date(`${data}T12:00:00`) - new Date(`${inicio}T12:00:00`)) / 86400000);
    return {
      id_usuario: Number(h.id_usuario),
      dia,
      hora_inicio: horaApi(h.hora_inicio),
      hora_fim: horaApi(h.hora_fim),
    };
  }).filter((h) => h.dia >= 0 && h.dia <= 6);

  return {
    semana_inicio: inicio,
    semana_fim: fim,
    pode_editar: podeGerenciarEscalaVisitas(user),
    tecnicos,
    lojas,
    visitas,
    horarios,
  };
}

export async function salvarGradeManutencao(user, body) {
  if (!podeGerenciarEscalaVisitas(user)) {
    throw new Error('Sem permissão para editar a escala de manutenção');
  }
  await garantirSchemaManutencao();
  const inicio = segundaFeiraDaSemana(body?.semana_inicio || new Date());
  const lista = Array.isArray(body?.celulas) ? body.celulas : [];
  const horarios = Array.isArray(body?.horarios) ? body.horarios : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of lista) {
      const idUsuario = Number(item.id_usuario);
      const dia = Number(item.dia);
      if (!idUsuario || dia < 0 || dia > 6) continue;
      const data = addDaysIso(inicio, dia);
      const idsLoja = Array.isArray(item.id_lojas)
        ? [...new Set(item.id_lojas.map(Number).filter(Boolean))]
        : [];
      await client.query(
        `DELETE FROM escala_manutencao_visita WHERE id_usuario = $1 AND data = $2::date`,
        [idUsuario, data],
      );
      for (const idLoja of idsLoja) {
        await client.query(
          `INSERT INTO escala_manutencao_visita (id_usuario, data, id_loja)
           VALUES ($1, $2::date, $3)
           ON CONFLICT (id_usuario, data, id_loja) DO NOTHING`,
          [idUsuario, data, idLoja],
        );
      }
    }
    for (const item of horarios) {
      const idUsuario = Number(item.id_usuario);
      const dia = Number(item.dia);
      if (!idUsuario || dia < 0 || dia > 6) continue;
      const data = addDaysIso(inicio, dia);
      const horaInicio = horaSql(item.hora_inicio);
      const horaFim = horaSql(item.hora_fim);
      if (!horaInicio && !horaFim) {
        await client.query(
          `DELETE FROM escala_manutencao_horario WHERE id_usuario = $1 AND data = $2::date`,
          [idUsuario, data],
        );
      } else {
        await client.query(
          `INSERT INTO escala_manutencao_horario (id_usuario, data, hora_inicio, hora_fim)
           VALUES ($1, $2::date, $3::time, $4::time)
           ON CONFLICT (id_usuario, data) DO UPDATE
             SET hora_inicio = EXCLUDED.hora_inicio, hora_fim = EXCLUDED.hora_fim`,
          [idUsuario, data, horaInicio, horaFim],
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return carregarGradeManutencao(user, { semana_inicio: inicio });
}
