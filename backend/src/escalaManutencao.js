import { pool } from './db.js';
import { segundaFeiraDaSemana, podeVerEscalaVisitas, podeGerenciarEscalaVisitas } from './escalaVisitas.js';

const TIPOS = new Set(['folga', 'ferias', 'falta', 'ausencia']);

let schemaOk = false;

export async function garantirSchemaManutencao(client = pool) {
  if (schemaOk) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_manutencao_celula (
      id_celula SERIAL PRIMARY KEY,
      id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      data DATE NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('folga', 'ferias', 'falta', 'ausencia')),
      UNIQUE (id_usuario, data)
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_escala_manutencao_celula_data
      ON escala_manutencao_celula (data, id_usuario)
  `);
  schemaOk = true;
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function tipoOk(v) {
  const t = String(v || '').trim().toLowerCase();
  return TIPOS.has(t) ? t : null;
}

export async function carregarGradeManutencao(user, { semana_inicio } = {}) {
  if (!podeVerEscalaVisitas(user)) {
    throw new Error('Sem permissão para ver a escala de manutenção');
  }
  await garantirSchemaManutencao();
  const inicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const fim = addDaysIso(inicio, 6);

  const { rows: tecnicos } = await pool.query(
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

  const { rows: celulas } = await pool.query(
    `SELECT id_usuario, data::text AS data, tipo
     FROM escala_manutencao_celula
     WHERE data >= $1::date AND data <= $2::date`,
    [inicio, fim],
  );
  const porTecnico = new Map();
  for (const c of celulas) {
    const key = Number(c.id_usuario);
    if (!porTecnico.has(key)) porTecnico.set(key, new Map());
    porTecnico.get(key).set(String(c.data).slice(0, 10), c.tipo);
  }

  const linhas = tecnicos.map((t) => {
    const mapa = porTecnico.get(Number(t.id_usuario)) || new Map();
    const dias = [];
    for (let i = 0; i < 7; i += 1) {
      const data = addDaysIso(inicio, i);
      dias.push({ dia: i, data, tipo: mapa.get(data) || null });
    }
    return {
      id_usuario: Number(t.id_usuario),
      nome: t.nome,
      id_regiao: t.id_regiao != null ? Number(t.id_regiao) : null,
      nome_regiao: t.nome_regiao || null,
      grupo: t.nome_regiao || 'Sem região',
      dias,
    };
  });

  return {
    semana_inicio: inicio,
    semana_fim: fim,
    pode_editar: podeGerenciarEscalaVisitas(user),
    linhas,
  };
}

export async function salvarGradeManutencao(user, body) {
  if (!podeGerenciarEscalaVisitas(user)) {
    throw new Error('Sem permissão para editar a escala de manutenção');
  }
  await garantirSchemaManutencao();
  const inicio = segundaFeiraDaSemana(body?.semana_inicio || new Date());
  const lista = Array.isArray(body?.celulas) ? body.celulas : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of lista) {
      const idUsuario = Number(item.id_usuario);
      const dia = Number(item.dia);
      if (!idUsuario || dia < 0 || dia > 6) continue;
      const data = addDaysIso(inicio, dia);
      const tipo = tipoOk(item.tipo);
      await client.query(
        `DELETE FROM escala_manutencao_celula WHERE id_usuario = $1 AND data = $2::date`,
        [idUsuario, data],
      );
      if (!tipo) continue;
      await client.query(
        `INSERT INTO escala_manutencao_celula (id_usuario, data, tipo) VALUES ($1, $2::date, $3)`,
        [idUsuario, data, tipo],
      );
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
