import type { FrotaRegiaoLoja, FrotaTecnicoPosicao } from '../api/client';

export function extrairIndiceRegiaoNome(nome: string): number | null {
  const m =
    nome.match(/regi[oã]o\s*[#.]?\s*(\d+)/i) ??
    nome.match(/\breg\.?\s*(\d+)/i) ??
    nome.match(/(\d+)\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Rótulo da região no mapa mobile — em telas pequenas usa "Reg. 1", "Reg. 2", etc. */
export function rotuloRegiaoMapa(
  regiao: { id_regiao: number; nome: string },
  opts?: { compacto?: boolean; indiceLista?: number },
): string {
  if (!opts?.compacto) return regiao.nome;
  const num =
    extrairIndiceRegiaoNome(regiao.nome) ??
    (opts.indiceLista != null ? opts.indiceLista + 1 : regiao.id_regiao);
  return `Reg. ${num}`;
}

export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatarDistanciaMapa(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function iniciaisNomeMapa(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) {
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
  }
  return (partes[0]?.slice(0, 2) ?? '?').toUpperCase();
}

export function primeiroNomeMapa(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

export function mesmaRegiaoLojaTecnico(
  loja: Pick<FrotaRegiaoLoja, 'id_regiao'>,
  tecnico: Pick<FrotaTecnicoPosicao, 'id_regiao'>,
): boolean {
  if (loja.id_regiao == null || tecnico.id_regiao == null) return false;
  return Number(loja.id_regiao) === Number(tecnico.id_regiao);
}

export function tecnicoGpsHabilitado(tecnico: Pick<FrotaTecnicoPosicao, 'gps_habilitado'>): boolean {
  return tecnico.gps_habilitado !== false;
}

export function lojaTemGpsTecnicosHabilitados(
  loja: Pick<FrotaRegiaoLoja, 'id_regiao'>,
  tecnicos: FrotaTecnicoPosicao[],
): boolean {
  if (loja.id_regiao == null) return false;
  const idRegiaoLoja = Number(loja.id_regiao);
  return tecnicos.some(
    (t) =>
      t.id_regiao != null &&
      Number(t.id_regiao) === idRegiaoLoja &&
      tecnicoGpsHabilitado(t),
  );
}

export function tecnicoMaisProximoLoja(
  loja: Pick<FrotaRegiaoLoja, 'latitude' | 'longitude' | 'id_regiao'>,
  tecnicos: FrotaTecnicoPosicao[],
): { tecnico: FrotaTecnicoPosicao; distanciaKm: number } | null {
  const latLoja = Number(loja.latitude);
  const lngLoja = Number(loja.longitude);
  if (!Number.isFinite(latLoja) || !Number.isFinite(lngLoja)) return null;
  if (loja.id_regiao == null) return null;

  const idRegiaoLoja = Number(loja.id_regiao);
  const tecnicosDaRegiao = tecnicos.filter(
    (t) =>
      t.id_regiao != null &&
      Number(t.id_regiao) === idRegiaoLoja &&
      tecnicoGpsHabilitado(t),
  );

  let melhor: { tecnico: FrotaTecnicoPosicao; distanciaKm: number } | null = null;
  for (const tecnico of tecnicosDaRegiao) {
    const lat = Number(tecnico.latitude);
    const lng = Number(tecnico.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const dist = distanciaKm(latLoja, lngLoja, lat, lng);
    if (!melhor || dist < melhor.distanciaKm) {
      melhor = { tecnico, distanciaKm: dist };
    }
  }
  return melhor;
}
