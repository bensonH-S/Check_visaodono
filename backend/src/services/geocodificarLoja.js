import { pool } from '../db.js';

async function geocodificarEndereco(loja) {
  const parts = [loja.address, loja.neighborhood, loja.city, loja.state, 'Brasil'].filter(Boolean);
  if (parts.length < 2) return null;

  const q = encodeURIComponent(parts.join(', '));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, {
      headers: { 'User-Agent': 'VisionCheck/1.0 (chamados-frota)' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.[0]) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Retorna coordenadas da loja (cache no banco ou geocodificação por endereço). */
export async function obterCoordenadasLoja(idLoja) {
  const { rows } = await pool.query(
    `SELECT latitude, longitude, address, city, state, neighborhood, name
     FROM lojas WHERE id_loja = $1`,
    [idLoja],
  );
  const loja = rows[0];
  if (!loja) return null;

  if (loja.latitude != null && loja.longitude != null) {
    const lat = Number(loja.latitude);
    const lng = Number(loja.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const coords = await geocodificarEndereco(loja);
  if (!coords) return null;

  await pool.query(`UPDATE lojas SET latitude = $1, longitude = $2 WHERE id_loja = $3`, [
    coords.lat,
    coords.lng,
    idLoja,
  ]);

  return coords;
}
