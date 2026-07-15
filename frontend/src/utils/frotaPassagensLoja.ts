import type { FrotaVeiculoHistoricoPonto, Loja } from '../api/client';
import { distanciaKm } from './mapaGeo';

/** Raio de proximidade da loja (metros) — alinhado ao mapa de localização. */
export const RAIO_PASSAGEM_LOJA_METROS = 80;

/** Tempo mínimo fora do raio para contar uma nova passagem (evita flicker de GPS). */
const MIN_FORA_MS = 3 * 60 * 1000;

export type PassagemLojaResumo = {
  id_loja: number;
  nome: string;
  bk_number: string | null;
  passagens: number;
  /** Primeira entrada no período */
  primeira_em: string | null;
  /** Última entrada no período */
  ultima_em: string | null;
};

function tempoPontoMs(p: FrotaVeiculoHistoricoPonto): number {
  if (!p.atualizado_em) return 0;
  const t = new Date(p.atualizado_em).getTime();
  return Number.isFinite(t) ? t : 0;
}

function ordenarPontos(pontos: FrotaVeiculoHistoricoPonto[]) {
  return [...pontos].sort((a, b) => tempoPontoMs(a) - tempoPontoMs(b));
}

function lojaComCoord(loja: Loja): { id_loja: number; nome: string; bk_number: string | null; lat: number; lng: number } | null {
  const lat = Number(loja.latitude);
  const lng = Number(loja.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id_loja: loja.id_loja,
    nome: loja.name,
    bk_number: loja.bk_number ?? null,
    lat,
    lng,
  };
}

/**
 * Conta quantas vezes o veículo entrou no raio de cada loja (fora → dentro).
 * Não conta cada ponto GPS — só a entrada no geofence.
 */
export function contarPassagensPorLoja(
  pontos: FrotaVeiculoHistoricoPonto[],
  lojas: Loja[],
  raioMetros = RAIO_PASSAGEM_LOJA_METROS,
): PassagemLojaResumo[] {
  const lojasOk = lojas.map(lojaComCoord).filter((l): l is NonNullable<typeof l> => l != null);
  if (!lojasOk.length || pontos.length < 1) return [];

  const ordenados = ordenarPontos(pontos);
  const raioKm = raioMetros / 1000;

  type Estado = {
    dentro: boolean;
    saiuEm: number | null;
    passagens: number;
    primeira: string | null;
    ultima: string | null;
  };

  const estados = new Map<number, Estado>();
  for (const l of lojasOk) {
    estados.set(l.id_loja, {
      dentro: false,
      saiuEm: null,
      passagens: 0,
      primeira: null,
      ultima: null,
    });
  }

  for (const p of ordenados) {
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const t = tempoPontoMs(p);

    for (const loja of lojasOk) {
      const st = estados.get(loja.id_loja)!;
      const dist = distanciaKm(lat, lng, loja.lat, loja.lng);
      const agoraDentro = dist <= raioKm;

      if (agoraDentro && !st.dentro) {
        const saiuHa = st.saiuEm != null && t > 0 ? t - st.saiuEm : Infinity;
        if (st.passagens === 0 || saiuHa >= MIN_FORA_MS) {
          st.passagens += 1;
          const iso = p.atualizado_em ?? null;
          if (!st.primeira) st.primeira = iso;
          st.ultima = iso;
        }
        st.dentro = true;
        st.saiuEm = null;
      } else if (!agoraDentro && st.dentro) {
        st.dentro = false;
        st.saiuEm = t || Date.now();
      }
    }
  }

  return lojasOk
    .map((l) => {
      const st = estados.get(l.id_loja)!;
      return {
        id_loja: l.id_loja,
        nome: l.nome,
        bk_number: l.bk_number,
        passagens: st.passagens,
        primeira_em: st.primeira,
        ultima_em: st.ultima,
      };
    })
    .filter((r) => r.passagens > 0)
    .sort((a, b) => b.passagens - a.passagens || a.nome.localeCompare(b.nome, 'pt-BR'));
}
