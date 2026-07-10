const OSRM_BASE = String(process.env.OSRM_API_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const TAMANHO_CHUNK = 80;
const SOBREPOSICAO_CHUNK = 2;
const RAIO_SNAP_METROS = 100;
const MAX_PONTOS_SEGMENTO = 32;
const CONCORRENCIA_SEGMENTOS = 10;

function coordenadasIguais(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}

function normalizarCoords(coords = []) {
  return coords
    .map((c) => [Number(c[0]), Number(c[1])])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function simplificarCoords(coords, maxPontos = MAX_PONTOS_SEGMENTO) {
  if (coords.length <= maxPontos) return coords;
  const resultado = [];
  const passo = (coords.length - 1) / (maxPontos - 1);
  for (let i = 0; i < maxPontos; i += 1) {
    const idx = Math.min(coords.length - 1, Math.round(i * passo));
    resultado.push(coords[idx]);
  }
  return resultado;
}

function unirCoordenadas(partes) {
  const resultado = [];
  for (const parte of partes) {
    for (const coord of parte) {
      const ultima = resultado[resultado.length - 1];
      if (ultima && coordenadasIguais(ultima, coord)) continue;
      resultado.push(coord);
    }
  }
  return resultado;
}

function dividirEmChunks(coords) {
  if (coords.length <= TAMANHO_CHUNK) return [coords];
  const chunks = [];
  let inicio = 0;
  while (inicio < coords.length) {
    const fim = Math.min(inicio + TAMANHO_CHUNK, coords.length);
    chunks.push(coords.slice(inicio, fim));
    if (fim >= coords.length) break;
    inicio = fim - SOBREPOSICAO_CHUNK;
  }
  return chunks;
}

function geometriaNasRuas(ajustada, entrada) {
  return ajustada.length > entrada.length + 2;
}

function coordsDaGeometria(geometry) {
  if (!geometry?.coordinates?.length) return [];
  return geometry.coordinates
    .map(([lng, lat]) => [lat, lng])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function coordsParaOsrm(coords) {
  return coords.map(([lat, lng]) => [lng, lat]);
}

async function osrmPost(servico, coords) {
  const coordinates = coordsParaOsrm(coords);
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
  });
  const body = { coordinates };
  if (servico === 'match') {
    params.set('tidy', 'true');
    params.set('gaps', 'ignore');
    body.radiuses = coordinates.map(() => RAIO_SNAP_METROS);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${OSRM_BASE}/${servico}/v1/driving?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function matchChunkOsrm(coords) {
  if (coords.length < 2) return coords;
  const data = await osrmPost('match', coords);
  if (data?.code !== 'Ok' || !data.matchings?.length) return coords;

  const ajustadas = [];
  for (const match of data.matchings) {
    ajustadas.push(...coordsDaGeometria(match.geometry));
  }
  return ajustadas.length >= 2 ? ajustadas : coords;
}

async function routeChunkOsrm(coords) {
  if (coords.length < 2) return coords;
  const data = await osrmPost('route', coords);
  if (data?.code !== 'Ok' || !data.routes?.[0]?.geometry) return coords;
  const ajustadas = coordsDaGeometria(data.routes[0].geometry);
  return ajustadas.length >= 2 ? ajustadas : coords;
}

async function ajustarChunk(coords) {
  const match = await matchChunkOsrm(coords);
  if (match.length >= 2 && geometriaNasRuas(match, coords)) return match;
  const route = await routeChunkOsrm(coords);
  return route.length >= 2 ? route : coords;
}

async function rotearSegmentosParalelo(coords, concorrencia = CONCORRENCIA_SEGMENTOS) {
  if (coords.length < 2) return coords;
  const partes = new Array(coords.length - 1);
  for (let i = 0; i < coords.length - 1; i += concorrencia) {
    const lote = [];
    for (let j = i; j < Math.min(i + concorrencia, coords.length - 1); j += 1) {
      const origem = coords[j];
      const destino = coords[j + 1];
      lote.push(
        routeChunkOsrm([origem, destino]).then((seg) => {
          partes[j] = seg.length >= 2 ? seg : [origem, destino];
        }),
      );
    }
    await Promise.all(lote);
  }
  return unirCoordenadas(partes.filter(Boolean));
}

export async function ajustarRotaOsrm(coords = []) {
  const normalizadas = normalizarCoords(coords);
  if (normalizadas.length < 2) return normalizadas;

  const entrada = simplificarCoords(normalizadas, MAX_PONTOS_SEGMENTO);

  try {
    if (entrada.length === 2) {
      const direta = await routeChunkOsrm(entrada);
      return direta.length >= 2 ? direta : normalizadas;
    }

    const porSegmentos = await rotearSegmentosParalelo(entrada);
    if (porSegmentos.length >= 2 && geometriaNasRuas(porSegmentos, entrada)) {
      return porSegmentos;
    }

    const chunks = dividirEmChunks(entrada);
    const partes = await Promise.all(chunks.map((chunk) => ajustarChunk(chunk)));
    const porMatch = unirCoordenadas(partes);
    if (porMatch.length >= 2 && geometriaNasRuas(porMatch, entrada)) {
      return porMatch;
    }

    return porSegmentos.length >= 2 ? porSegmentos : normalizadas;
  } catch {
    return normalizadas;
  }
}
