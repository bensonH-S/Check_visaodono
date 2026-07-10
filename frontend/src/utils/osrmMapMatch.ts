import { api } from '../api/client';

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
