import { pool } from '../db.js';
import { dataHojeSp } from './horario.js';
import { garantirSchemaAlvim } from './persona.js';

export function chaveDedup(ferramenta, partes, dia = dataHojeSp()) {
  const miolo = (Array.isArray(partes) ? partes : [partes])
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(':');
  return `${ferramenta}:${miolo}:${dia}`;
}

export async function jaEnviou(chave) {
  await garantirSchemaAlvim();
  const { rows } = await pool.query(
    'SELECT 1 FROM agente_alvim_envios WHERE chave = $1 LIMIT 1',
    [chave],
  );
  return rows.length > 0;
}

export async function registrarEnvio({ chave, ferramenta, destino = null, payload = {} }) {
  await garantirSchemaAlvim();
  const { rows } = await pool.query(
    `INSERT INTO agente_alvim_envios (chave, ferramenta, destino, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (chave) DO NOTHING
     RETURNING id_envio`,
    [chave, ferramenta, destino, JSON.stringify(payload ?? {})],
  );
  return Boolean(rows[0]?.id_envio);
}

export async function filtrarNovos(chaves) {
  if (!chaves.length) return [];
  await garantirSchemaAlvim();
  const { rows } = await pool.query(
    'SELECT chave FROM agente_alvim_envios WHERE chave = ANY($1::text[])',
    [chaves],
  );
  const ja = new Set(rows.map((r) => r.chave));
  return chaves.filter((c) => !ja.has(c));
}
