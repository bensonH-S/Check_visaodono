import { pool } from './db.js';
import { segundaFeiraDaSemana, podeVerEscalaVisitas, podeGerenciarEscalaVisitas } from './escalaVisitas.js';

const TIPOS = new Set(['folga', 'ferias', 'falta', 'ausencia']);

let schemaOk = false;

export async function garantirSchemaGestores(client = pool) {
  if (schemaOk) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_gestores (
      id_gestor SERIAL PRIMARY KEY,
      id_loja INTEGER REFERENCES lojas(id_loja) ON DELETE SET NULL,
      bk_number TEXT,
      nome TEXT NOT NULL,
      grupo TEXT NOT NULL DEFAULT 'loja'
        CHECK (grupo IN ('loja', 'campo')),
      folga_padrao TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      ordem INTEGER NOT NULL DEFAULT 0
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_gestores_celula (
      id_celula SERIAL PRIMARY KEY,
      id_gestor INTEGER NOT NULL REFERENCES escala_gestores(id_gestor) ON DELETE CASCADE,
      data DATE NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('folga', 'ferias', 'falta', 'ausencia')),
      UNIQUE (id_gestor, data)
    )
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

export async function carregarGradeGestores(user, { semana_inicio } = {}) {
  if (!podeVerEscalaVisitas(user)) {
    throw new Error('Sem permissão para ver a escala de gestores');
  }
  await garantirSchemaGestores();
  const inicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const fim = addDaysIso(inicio, 6);

  const { rows: gestores } = await pool.query(
    `SELECT g.id_gestor, g.id_loja, g.bk_number, g.nome, g.grupo, g.folga_padrao, g.ordem,
            l.name AS nome_loja, l.bk_number AS loja_bk
     FROM escala_gestores g
     LEFT JOIN lojas l ON l.id_loja = g.id_loja
     WHERE g.ativo = TRUE
     ORDER BY CASE WHEN g.grupo = 'loja' THEN 0 ELSE 1 END, g.ordem, g.nome`,
  );

  const { rows: celulas } = await pool.query(
    `SELECT id_gestor, data::text AS data, tipo
     FROM escala_gestores_celula
     WHERE data >= $1::date AND data <= $2::date`,
    [inicio, fim],
  );
  const porGestor = new Map();
  for (const c of celulas) {
    const key = Number(c.id_gestor);
    if (!porGestor.has(key)) porGestor.set(key, new Map());
    porGestor.get(key).set(String(c.data).slice(0, 10), c.tipo);
  }

  const linhas = gestores.map((g) => {
    const mapa = porGestor.get(Number(g.id_gestor)) || new Map();
    const dias = [];
    for (let i = 0; i < 7; i += 1) {
      const data = addDaysIso(inicio, i);
      dias.push({ dia: i, data, tipo: mapa.get(data) || null });
    }
    return {
      id_gestor: Number(g.id_gestor),
      id_loja: g.id_loja != null ? Number(g.id_loja) : null,
      bk_number: g.loja_bk || g.bk_number || null,
      nome_loja: g.nome_loja || null,
      nome: g.nome,
      grupo: g.grupo,
      folga_padrao: g.folga_padrao || null,
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

export async function salvarGradeGestores(user, body) {
  if (!podeGerenciarEscalaVisitas(user)) {
    throw new Error('Sem permissão para editar a escala de gestores');
  }
  await garantirSchemaGestores();
  const inicio = segundaFeiraDaSemana(body?.semana_inicio || new Date());
  const lista = Array.isArray(body?.celulas) ? body.celulas : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of lista) {
      const idGestor = Number(item.id_gestor);
      const dia = Number(item.dia);
      if (!idGestor || dia < 0 || dia > 6) continue;
      const data = addDaysIso(inicio, dia);
      const tipo = tipoOk(item.tipo);
      await client.query(
        `DELETE FROM escala_gestores_celula WHERE id_gestor = $1 AND data = $2::date`,
        [idGestor, data],
      );
      if (!tipo) continue;
      await client.query(
        `INSERT INTO escala_gestores_celula (id_gestor, data, tipo) VALUES ($1, $2::date, $3)`,
        [idGestor, data, tipo],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return carregarGradeGestores(user, { semana_inicio: inicio });
}
