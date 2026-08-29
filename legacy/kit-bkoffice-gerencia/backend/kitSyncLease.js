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

/**
 * Registra último sync ok (mesmo PC do lease ou qualquer kit com bypass).
 * Usado pelo portal para alertar "kit parado".
 */
export async function registrarHeartbeat({
  holder_id,
  holder_name = null,
  ok = true,
  de = null,
  ate = null,
  lojas_ok = null,
  venda_total = null,
  produtos = null,
} = {}) {
  const id = String(holder_id || '').trim() || 'kit';
  const name = String(holder_name || id).trim().slice(0, 120);
  await pool.query(
    `INSERT INTO kit_bkoffice_lease (
       slot, holder_id, holder_name, expires_at, renewed_at,
       last_sync_ok_at, last_sync_de, last_sync_ate, last_sync_lojas,
       last_sync_venda, last_sync_produtos, last_sync_ok
     ) VALUES (
       $1, $2, $3,
       NOW() + interval '5 minutes', NOW(),
       NOW(), $4::date, $5::date, $6, $7, $8, $9
     )
     ON CONFLICT (slot) DO UPDATE SET
       renewed_at = NOW(),
       expires_at = GREATEST(kit_bkoffice_lease.expires_at, NOW() + interval '5 minutes'),
       holder_id = COALESCE(kit_bkoffice_lease.holder_id, EXCLUDED.holder_id),
       holder_name = COALESCE(EXCLUDED.holder_name, kit_bkoffice_lease.holder_name),
       last_sync_ok_at = EXCLUDED.last_sync_ok_at,
       last_sync_de = EXCLUDED.last_sync_de,
       last_sync_ate = EXCLUDED.last_sync_ate,
       last_sync_lojas = EXCLUDED.last_sync_lojas,
       last_sync_venda = EXCLUDED.last_sync_venda,
       last_sync_produtos = EXCLUDED.last_sync_produtos,
       last_sync_ok = EXCLUDED.last_sync_ok`,
    [
      SLOT,
      id,
      name,
      de || null,
      ate || null,
      lojas_ok != null ? Number(lojas_ok) : null,
      venda_total != null ? Number(venda_total) : null,
      produtos != null ? Number(produtos) : null,
      Boolean(ok),
    ],
  );
  return statusLease({ holder_id: id });
}

/** Status do kit para o portal (JWT). */
export async function statusKitParaPortal() {
  const { rows } = await pool.query(`SELECT * FROM kit_bkoffice_lease WHERE slot = $1`, [SLOT]);
  const row = rows[0] || null;
  if (!row) {
    return {
      ok: true,
      kit_ativo: false,
      stale: true,
      minutos_sem_sync: null,
      holder_name: null,
      last_sync_ok_at: null,
      last_sync_de: null,
      last_sync_ate: null,
      last_sync_lojas: null,
      last_sync_venda: null,
      aviso: 'Nenhum kit registrou sync ainda.',
    };
  }
  const last = row.last_sync_ok_at ? new Date(row.last_sync_ok_at).getTime() : 0;
  const minutos = last ? Math.max(0, Math.round((Date.now() - last) / 60000)) : null;
  const hora = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
  const horarioComercial = hora >= 8 && hora <= 23;
  // Sem heartbeat ainda (API antiga / 1º boot): NÃO alarmar — usa só last_sync_ok_at.
  const stale = Boolean(horarioComercial && last && minutos != null && minutos > 15);
  return {
    ok: true,
    kit_ativo: !row.expires_at || new Date(row.expires_at).getTime() > Date.now(),
    stale,
    minutos_sem_sync: minutos,
    holder_id: row.holder_id,
    holder_name: row.holder_name,
    last_sync_ok_at: row.last_sync_ok_at ? new Date(row.last_sync_ok_at).toISOString() : null,
    last_sync_de: row.last_sync_de,
    last_sync_ate: row.last_sync_ate,
    last_sync_lojas: row.last_sync_lojas,
    last_sync_venda: row.last_sync_venda != null ? Number(row.last_sync_venda) : null,
    last_sync_ok: row.last_sync_ok,
    aviso: stale
      ? `Kit BK Office parado há ${minutos} min — vendas/estoque podem estar atrasados.`
      : !last
        ? null
        : null,
  };
}
