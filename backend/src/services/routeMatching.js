import { ajustarRotaOpenRouteService } from './openRouteService.js';
import { ajustarRotaOsrm } from './osrmRouting.js';

export async function ajustarRotaAsRuas(coords = []) {
  const normalizadas = coords
    .map((c) => [Number(c[0]), Number(c[1])])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  if (normalizadas.length < 2) return normalizadas;

  const orsKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (orsKey) {
    const ors = await ajustarRotaOpenRouteService(normalizadas, orsKey);
    if (ors?.length >= 2) return ors;
  }

  return ajustarRotaOsrm(normalizadas);
}
