import { api, type FrotaVeiculoRotaDiaRelatorio } from '../api/client';

export type LatLngPar = [number, number];

/** Reduz pontos GPS antes do OSRM (evita timeout com trajetos longos). */
export function simplificarCoords(coords: LatLngPar[], maxPontos = 48): LatLngPar[] {
  if (coords.length <= maxPontos) return coords;
  const resultado: LatLngPar[] = [];
  const passo = (coords.length - 1) / (maxPontos - 1);
  for (let i = 0; i < maxPontos; i += 1) {
    const idx = Math.min(coords.length - 1, Math.round(i * passo));
    resultado.push(coords[idx]);
  }
  return resultado;
}

export async function ajustarRotaAsRuas(coords: LatLngPar[]): Promise<LatLngPar[]> {
  if (coords.length < 2) return coords;
  try {
    const res = await api.frotaAjustarRotaMapa(coords);
    return res.coords?.length >= 2 ? res.coords : coords;
  } catch {
    return coords;
  }
}

/** coords_rua “de verdade” é bem mais densa que o GPS; cópia do GPS = match falhou. */
export function coordsRuaPareceSnap(coordsRua: LatLngPar[] | undefined, gps: LatLngPar[]): boolean {
  if (!coordsRua || coordsRua.length < 2) return false;
  if (gps.length < 2) return coordsRua.length >= 2;
  return coordsRua.length >= Math.max(gps.length + 5, Math.ceil(gps.length * 1.4));
}

/** Garante geometria encaixada nas ruas (OSRM). Evita retas atravessando quarteirões. */
export async function garantirRotaNasRuas(
  relatorio: FrotaVeiculoRotaDiaRelatorio,
): Promise<FrotaVeiculoRotaDiaRelatorio> {
  const rotas = await Promise.all(
    (relatorio.rotas ?? []).map(async (rota) => {
      const gps = (rota.pontos ?? [])
        .map((p) => {
          const lat = Number(p.latitude);
          const lng = Number(p.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return [lat, lng] as LatLngPar;
        })
        .filter((c): c is LatLngPar => c != null);
      const existente = (rota.coords_rua ?? [])
        .map(([lat, lng]) => [Number(lat), Number(lng)] as LatLngPar)
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
      if (coordsRuaPareceSnap(existente, gps)) return { ...rota, coords_rua: existente };
      if (gps.length < 2) return rota;
      const coords_rua = await ajustarRotaAsRuas(gps);
      return { ...rota, coords_rua };
    }),
  );
  return { ...relatorio, rotas };
}
