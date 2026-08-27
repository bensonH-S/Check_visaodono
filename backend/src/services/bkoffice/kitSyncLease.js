/**
 * Lease ativo/passivo: só um kit PC sincroniza; o outro assume se o lease expirar.
 */
import { pool } from '../../db.js';

const SLOT = 'sync';
/** TTL padrão: cobre download longo + folga antes do standby assumir. */
export const LEASE_TTL_DEFAULT_S = 300;

function rowToJson(row, holderId) {
  if (!row) {
    return {
      ok: true,
      acquired: false,
      holder_id: null,
      holder_name: null,
      expires_at: null,
      renewed_at: null,
      sou_eu: false,
    };
  }
  return {
    ok: true,
    acquired: row.holder_id === holderId,
    holder_id: row.holder_id,
    holder_name: row.holder_name || null,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    renewed_at: row.renewed_at ? new Date(row.renewed_at).toISOString() : null,
    sou_eu: row.holder_id === holderId,
  };
}

/**
 * Tenta adquirir ou renovar o lease.
 * @param {{ holder_id: string, holder_name?: string, ttl_s?: number }} opts
 */
export async function adquirirLease({
  holder_id,
  holder_name = null,
  ttl_s = LEASE_TTL_DEFAULT_S,
} = {}) {
  const id = String(holder_id || '').trim();
  if (!id) {
    throw Object.assign(new Error('holder_id obrigatório'), { status: 400 });
  }
  const ttl = Math.max(60, Math.min(3600, Number(ttl_s) || LEASE_TTL_DEFAULT_S));
  const name = String(holder_name || id).trim().slice(0, 120);

  const { rows } = await pool.query(
    `INSERT INTO kit_bkoffice_lease (slot, holder_id, holder_name, expires_at, renewed_at)
     VALUES ($1, $2, $3, NOW() + ($4::text || ' seconds')::interval, NOW())
     ON CONFLICT (slot) DO UPDATE
       SET holder_id = EXCLUDED.holder_id,
           holder_name = EXCLUDED.holder_name,
           expires_at = EXCLUDED.expires_at,
           renewed_at = NOW()
     WHERE kit_bkoffice_lease.expires_at < NOW()
        OR kit_bkoffice_lease.holder_id = EXCLUDED.holder_id
     RETURNING *`,
    [SLOT, id, name, String(ttl)],
  );

  if (rows.length) return rowToJson(rows[0], id);

  const { rows: cur } = await pool.query(
    `SELECT * FROM kit_bkoffice_lease WHERE slot = $1`,
    [SLOT],
  );
  return rowToJson(cur[0] || null, id);
}

export async function statusLease({ holder_id = null } = {}) {
  const { rows } = await pool.query(`SELECT * FROM kit_bkoffice_lease WHERE slot = $1`, [SLOT]);
  const row = rows[0] || null;
  const id = holder_id ? String(holder_id).trim() : null;
  const base = rowToJson(row, id || '');
  if (!id) {
    base.acquired = false;
    base.sou_eu = false;
  }
  const expirado = row ? new Date(row.expires_at).getTime() < Date.now() : true;
  return { ...base, expirado, livre: !row || expirado };
}

/** Libera só se o caller ainda for o holder (shutdown limpo). */
export async function liberarLease({ holder_id } = {}) {
  const id = String(holder_id || '').trim();
  if (!id) {
    throw Object.assign(new Error('holder_id obrigatório'), { status: 400 });
  }
  const { rowCount } = await pool.query(
    `DELETE FROM kit_bkoffice_lease WHERE slot = $1 AND holder_id = $2`,
    [SLOT, id],
  );
  return { ok: true, liberado: rowCount > 0 };
}
