export function centroCoordenadas(pontos) {
  const pts = (pontos || []).filter((p) => (
    Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  ));
  if (!pts.length) return null;
  const lats = pts.map((p) => Number(p.lat)).sort((a, b) => a - b);
  const lngs = pts.map((p) => Number(p.lng)).sort((a, b) => a - b);
  const mid = (arr) => arr[Math.floor((arr.length - 1) / 2)];
  return { lat: mid(lats), lng: mid(lngs) };
}

export function kmEntre(a, b) {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const toRad = (n) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  const m = 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(m / 100) / 10;
}

export function resumoEmprestimo(todos, { minimo = 0, raioKm = 45 } = {}) {
  const ordenados = [...(todos || [])].sort((a, b) => {
    if (a.km != null && b.km != null && a.km !== b.km) return a.km - b.km;
    return (b.qtd || 0) - (a.qtd || 0);
  });
  const mais_perto = ordenados[0] || null;
  const com_minimo = ordenados.filter((l) => Number(l.qtd) > Number(minimo));
  const atende = com_minimo[0] || null;
  const unica_longe = !!(
    atende
    && mais_perto
    && atende.loja !== mais_perto.loja
    && mais_perto.km != null
    && atende.km != null
    && (atende.km - mais_perto.km) >= raioKm
  );
  return {
    mais_perto,
    com_minimo: com_minimo.slice(0, 5),
    unica_longe,
  };
}
