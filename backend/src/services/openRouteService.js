const ORS_BASE = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
const MAX_WAYPOINTS_ORS = 15;
const RAIO_SNAP_ORS = 500;

function normalizarCoords(coords = []) {
  return coords
    .map((c) => [Number(c[0]), Number(c[1])])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function simplificarCoords(coords, maxPontos = MAX_WAYPOINTS_ORS) {
  if (coords.length <= maxPontos) return coords;
  const resultado = [];
  const passo = (coords.length - 1) / (maxPontos - 1);
  for (let i = 0; i < maxPontos; i += 1) {
    const idx = Math.min(coords.length - 1, Math.round(i * passo));
    resultado.push(coords[idx]);
  }
  return resultado;
}

function coordsDaGeometria(geometry) {
  if (!geometry?.coordinates?.length) return [];
  return geometry.coordinates
    .map(([lng, lat]) => [lat, lng])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

export async function ajustarRotaOpenRouteService(coords = [], apiKey) {
  const chave = String(apiKey || '').trim();
  if (!chave) return null;

  const entrada = simplificarCoords(normalizarCoords(coords), MAX_WAYPOINTS_ORS);
  if (entrada.length < 2) return entrada;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(ORS_BASE, {
      method: 'POST',
      headers: {
        Authorization: chave,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json',
      },
      body: JSON.stringify({
        coordinates: entrada.map(([lat, lng]) => [lng, lat]),
        radiuses: entrada.map(() => RAIO_SNAP_ORS),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const coordsAjustadas = coordsDaGeometria(data?.features?.[0]?.geometry);
    if (coordsAjustadas.length < 2) return null;
    if (coordsAjustadas.length <= entrada.length + 2) return null;
    return coordsAjustadas;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
