/**
 * Mapa BKN antigo → BKN atual (trocas de código no BK Office).
 * Ex.: Píer fechou / virou Sobradinho → baixa 21274 no BK e grava na loja 30784.
 */
import { pool } from '../../db.js';

let cache = null;
let cacheAt = 0;
/** @type {Map<string, string>|null} atual → antigo (para download no Playwright) */
let cacheReverse = null;
const TTL_MS = 60_000;

/** Fallback se a migration ainda não rodou no banco. */
const FALLBACK_ANTIGO_PARA_ATUAL = new Map([['21274', '30784']]);

function soDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

/** @returns {Promise<{ direto: Map<string, string>, reverso: Map<string, string> }>} */
async function carregarMapas(force = false) {
  if (!force && cache && cacheReverse && Date.now() - cacheAt < TTL_MS) {
    return { direto: cache, reverso: cacheReverse };
  }
  const direto = new Map(FALLBACK_ANTIGO_PARA_ATUAL);
  try {
    const { rows } = await pool.query(
      `SELECT bkn_antigo, bkn_atual FROM bkoffice_bkn_alias`,
    );
    for (const r of rows) {
      const a = soDigitos(r.bkn_antigo);
      const b = soDigitos(r.bkn_atual);
      if (a && b) direto.set(a, b);
    }
  } catch (e) {
    if (e.code !== '42P01') throw e;
  }
  const reverso = new Map();
  for (const [antigo, atual] of direto) {
    // Se vários antigos apontam ao mesmo atual, o último ganha — ok para Sobradinho.
    reverso.set(atual, antigo);
  }
  cache = direto;
  cacheReverse = reverso;
  cacheAt = Date.now();
  return { direto, reverso };
}

/** @returns {Promise<Map<string, string>>} antigo → atual (só dígitos) */
export async function carregarAliasesBkn(force = false) {
  const { direto } = await carregarMapas(force);
  return direto;
}

/**
 * BKN a digitar no autocomplete do BK Office ao sincronizar a loja cadastrada.
 * Se a loja tem código novo (30784) mas o BK ainda exporta no antigo (21274), devolve o antigo.
 */
export async function bknParaDownloadNoBkOffice(bkNumberCadastro) {
  const atual = soDigitos(bkNumberCadastro);
  if (!atual) return null;
  const { reverso } = await carregarMapas();
  return reverso.get(atual) || atual;
}

/** Aplica alias no bk_number do item (mutável cópia). */
export function aplicarAliasBknItem(item, aliases) {
  if (!aliases?.size) return item;
  const bkn = soDigitos(item.bk_number);
  if (!bkn || !aliases.has(bkn)) return item;
  return { ...item, bk_number: aliases.get(bkn) };
}

export function invalidarCacheAliasesBkn() {
  cache = null;
  cacheReverse = null;
  cacheAt = 0;
}
