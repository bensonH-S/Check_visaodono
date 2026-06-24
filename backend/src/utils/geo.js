/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const la1 = Number(lat1);
  const lo1 = Number(lon1);
  const la2 = Number(lat2);
  const lo2 = Number(lon2);
  if (![la1, lo1, la2, lo2].every(Number.isFinite)) return Infinity;

  const R = 6371;
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLon = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
