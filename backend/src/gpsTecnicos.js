/** Rastreamento GPS dos técnicos — controlado por variável de ambiente. */
import { pool } from './db.js';

export function gpsTecnicosAtivo() {
  const v = String(process.env.GPS_TECNICOS_ENABLED ?? 'true').trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'off' && v !== 'no';
}

export function gpsTecnicosIntervaloMs() {
  const n = Number(process.env.GPS_TECNICOS_INTERVAL_MS);
  if (Number.isFinite(n) && n >= 30_000) return Math.round(n);
  return 120_000;
}

export function gpsTecnicosConfigPublica() {
  return {
    gpsTecnicosEnabled: gpsTecnicosAtivo(),
    gpsTecnicosIntervalMs: gpsTecnicosIntervaloMs(),
  };
}

/** Se o técnico não está em nenhuma região, permite captura (comportamento anterior). */
export async function gpsCapturaHabilitadaUsuario(idUsuario) {
  const { rows } = await pool.query(
    `SELECT BOOL_OR(gps_habilitado) AS habilitado, COUNT(*)::int AS qtd
     FROM frota_regiao_tecnicos
     WHERE id_usuario = $1`,
    [idUsuario],
  );
  const row = rows[0];
  if (!row || row.qtd === 0) return true;
  return row.habilitado === true;
}
