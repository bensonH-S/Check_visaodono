import { pool } from '../db.js';
import {
  LIDERANCA_EMAIL,
  RELATORIO_EMAIL_SEMPRE,
  resolverGerentesLoja,
  resolverRegionaisLoja,
} from './timeCampoRegional.js';

export const TIPOS_EMAIL_RELATORIO = ['escala', 'estoque', 'visita'];

const PADRAO = {
  escala: {
    incluir_regional: true,
    incluir_gerente: false,
    incluir_cargo_ti: true,
    incluir_cargo_diretor: true,
    incluir_cargo_ceo: false,
    destinatarios: [
      { email: LIDERANCA_EMAIL.diretor, nome: 'Renato' },
      { email: LIDERANCA_EMAIL.ti, nome: 'Benson' },
      { email: 'benson.henrique@grupoalvim.com.br', nome: 'Benson' },
    ],
  },
  estoque: {
    incluir_regional: true,
    incluir_gerente: true,
    incluir_cargo_ti: true,
    incluir_cargo_diretor: false,
    incluir_cargo_ceo: false,
    destinatarios: [
      { email: LIDERANCA_EMAIL.diretor, nome: 'Renato' },
      { email: LIDERANCA_EMAIL.ti, nome: 'Benson' },
      { email: 'ti@grupoalvim.com.br', nome: 'TI' },
    ],
  },
  visita: {
    incluir_regional: true,
    incluir_gerente: true,
    incluir_cargo_ti: false,
    incluir_cargo_diretor: false,
    incluir_cargo_ceo: false,
    destinatarios: RELATORIO_EMAIL_SEMPRE.map((p) => ({ email: p.email, nome: p.nome })),
  },
};

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function flagsDe(row) {
  return {
    incluir_regional: Boolean(row?.incluir_regional),
    incluir_gerente: Boolean(row?.incluir_gerente),
    incluir_cargo_ti: Boolean(row?.incluir_cargo_ti),
    incluir_cargo_diretor: Boolean(row?.incluir_cargo_diretor),
    incluir_cargo_ceo: Boolean(row?.incluir_cargo_ceo),
  };
}

export async function garantirEmailRelatorio() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_relatorio_config (
      tipo TEXT PRIMARY KEY,
      incluir_regional BOOLEAN NOT NULL DEFAULT FALSE,
      incluir_gerente BOOLEAN NOT NULL DEFAULT FALSE,
      incluir_cargo_ti BOOLEAN NOT NULL DEFAULT FALSE,
      incluir_cargo_diretor BOOLEAN NOT NULL DEFAULT FALSE,
      incluir_cargo_ceo BOOLEAN NOT NULL DEFAULT FALSE,
      atualizado_em TIMESTAMPTZ,
      atualizado_por INTEGER
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_relatorio_destinatario (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      email TEXT NOT NULL,
      nome TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (tipo, email)
    )
  `);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM email_relatorio_config');
  if (Number(rows[0]?.n) > 0) return;
  for (const tipo of TIPOS_EMAIL_RELATORIO) {
    const padrao = PADRAO[tipo];
    await pool.query(
      `INSERT INTO email_relatorio_config
         (tipo, incluir_regional, incluir_gerente, incluir_cargo_ti, incluir_cargo_diretor, incluir_cargo_ceo)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tipo) DO NOTHING`,
      [
        tipo,
        padrao.incluir_regional,
        padrao.incluir_gerente,
        padrao.incluir_cargo_ti,
        padrao.incluir_cargo_diretor,
        padrao.incluir_cargo_ceo,
      ],
    );
    for (const pessoa of padrao.destinatarios) {
      const email = normEmail(pessoa.email);
      if (!email) continue;
      await pool.query(
        `INSERT INTO email_relatorio_destinatario (tipo, email, nome, ativo)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (tipo, email) DO NOTHING`,
        [tipo, email, pessoa.nome || null],
      );
    }
  }
}

async function lerTipo(tipo) {
  const { rows } = await pool.query(
    `SELECT tipo, incluir_regional, incluir_gerente, incluir_cargo_ti, incluir_cargo_diretor, incluir_cargo_ceo
     FROM email_relatorio_config WHERE tipo = $1`,
    [tipo],
  );
  const { rows: destinatarios } = await pool.query(
    `SELECT email, nome, ativo
     FROM email_relatorio_destinatario
     WHERE tipo = $1
     ORDER BY nome NULLS LAST, email`,
    [tipo],
  );
  return {
    tipo,
    ...flagsDe(rows[0] || PADRAO[tipo]),
    destinatarios: destinatarios.map((d) => ({
      email: d.email,
      nome: d.nome || '',
      ativo: d.ativo !== false,
    })),
  };
}

export async function listarEmailRelatorio() {
  await garantirEmailRelatorio();
  const tipos = [];
  for (const tipo of TIPOS_EMAIL_RELATORIO) tipos.push(await lerTipo(tipo));
  return tipos;
}

export async function salvarEmailRelatorio(tipo, body, idUsuario) {
  if (!TIPOS_EMAIL_RELATORIO.includes(tipo)) {
    const err = new Error('Tipo de e-mail inválido');
    err.status = 400;
    throw err;
  }
  await garantirEmailRelatorio();
  const vistos = new Set();
  const destinatarios = [];
  for (const item of Array.isArray(body?.destinatarios) ? body.destinatarios : []) {
    const email = normEmail(item?.email);
    if (!email || !email.includes('@') || vistos.has(email)) continue;
    vistos.add(email);
    destinatarios.push({
      email,
      nome: String(item?.nome || '').trim().slice(0, 80) || null,
      ativo: item?.ativo !== false,
    });
  }
  const flags = {
    incluir_regional: Boolean(body?.incluir_regional),
    incluir_gerente: Boolean(body?.incluir_gerente),
    incluir_cargo_ti: Boolean(body?.incluir_cargo_ti),
    incluir_cargo_diretor: Boolean(body?.incluir_cargo_diretor),
    incluir_cargo_ceo: Boolean(body?.incluir_cargo_ceo),
  };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO email_relatorio_config
         (tipo, incluir_regional, incluir_gerente, incluir_cargo_ti, incluir_cargo_diretor, incluir_cargo_ceo, atualizado_em, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       ON CONFLICT (tipo) DO UPDATE SET
         incluir_regional = EXCLUDED.incluir_regional,
         incluir_gerente = EXCLUDED.incluir_gerente,
         incluir_cargo_ti = EXCLUDED.incluir_cargo_ti,
         incluir_cargo_diretor = EXCLUDED.incluir_cargo_diretor,
         incluir_cargo_ceo = EXCLUDED.incluir_cargo_ceo,
         atualizado_em = NOW(),
         atualizado_por = EXCLUDED.atualizado_por`,
      [
        tipo,
        flags.incluir_regional,
        flags.incluir_gerente,
        flags.incluir_cargo_ti,
        flags.incluir_cargo_diretor,
        flags.incluir_cargo_ceo,
        Number(idUsuario) || null,
      ],
    );
    await client.query('DELETE FROM email_relatorio_destinatario WHERE tipo = $1', [tipo]);
    for (const pessoa of destinatarios) {
      await client.query(
        `INSERT INTO email_relatorio_destinatario (tipo, email, nome, ativo)
         VALUES ($1, $2, $3, $4)`,
        [tipo, pessoa.email, pessoa.nome, pessoa.ativo],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return lerTipo(tipo);
}

function acrescentar(mapa, email, nome, papel) {
  const chave = normEmail(email);
  if (!chave || !chave.includes('@') || mapa.has(chave)) return;
  mapa.set(chave, { email: chave, nome: nome || '', papel });
}

/** E-mails que recebem o relatório, já com gerente, regional e cargos ligados na configuração. */
export async function montarEmailsRelatorio(tipo, idsLoja = []) {
  await garantirEmailRelatorio();
  const cfg = await lerTipo(tipo);
  const mapa = new Map();
  for (const pessoa of cfg.destinatarios) {
    if (pessoa.ativo) acrescentar(mapa, pessoa.email, pessoa.nome, 'fixo');
  }
  const cargos = [];
  if (cfg.incluir_cargo_ti) cargos.push('ti');
  if (cfg.incluir_cargo_diretor) cargos.push('diretor');
  if (cfg.incluir_cargo_ceo) cargos.push('ceo');
  if (cargos.length) {
    const { rows } = await pool.query(
      `SELECT email, nome, lower(COALESCE(cargo_aprovacao, perfil::text, '')) AS cargo
       FROM usuarios
       WHERE ativo = TRUE
         AND email IS NOT NULL AND TRIM(email) <> ''
         AND lower(COALESCE(cargo_aprovacao, perfil::text, '')) = ANY($1::text[])`,
      [cargos],
    );
    for (const row of rows) acrescentar(mapa, row.email, row.nome, row.cargo);
  }
  const ids = [...new Set(idsLoja.map((id) => Number(id)).filter((id) => id > 0))];
  if (ids.length && (cfg.incluir_regional || cfg.incluir_gerente)) {
    for (const idLoja of ids) {
      if (cfg.incluir_regional) {
        const regionais = await resolverRegionaisLoja(idLoja);
        for (const pessoa of regionais) acrescentar(mapa, pessoa.email, pessoa.nome, 'regional');
      }
      if (cfg.incluir_gerente) {
        const gerentes = await resolverGerentesLoja(idLoja);
        for (const pessoa of gerentes) acrescentar(mapa, pessoa.email, pessoa.nome, 'gerente');
      }
    }
  }
  return {
    cfg,
    pessoas: [...mapa.values()],
    emails: [...mapa.keys()],
  };
}
