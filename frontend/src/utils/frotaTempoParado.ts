import type { FrotaVeiculoHistoricoPonto } from '../api/client';
import { parseDataApi } from './dateBr';

/** Intervalo máximo entre pings para contar como a mesma parada (30 min). */
export const MAX_INTERVALO_PARADO_MS = 30 * 60 * 1000;

const VELOCIDADE_MINIMA_MOVIMENTO_KMH = 3;

function ordenarPontos(pontos: FrotaVeiculoHistoricoPonto[]) {
  return [...pontos].sort((a, b) => {
    const ta = parseDataApi(a.atualizado_em).getTime();
    const tb = parseDataApi(b.atualizado_em).getTime();
    return ta - tb;
  });
}

function intervaloMs(
  atual: FrotaVeiculoHistoricoPonto,
  prox: FrotaVeiculoHistoricoPonto,
): number {
  const ta = parseDataApi(atual.atualizado_em ?? '').getTime();
  const tb = parseDataApi(prox.atualizado_em ?? '').getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta) return 0;
  return Math.min(tb - ta, MAX_INTERVALO_PARADO_MS);
}

function pontoLigadoOuMovimento(p: FrotaVeiculoHistoricoPonto) {
  if (p.ignicao === false) return false;
  return p.ignicao === true || (Number(p.velocidade) || 0) > VELOCIDADE_MINIMA_MOVIMENTO_KMH;
}

/** Soma o tempo com velocidade zero, sem inflar por longos intervalos sem sinal GPS. */
export function calcularTempoParadoMs(pontos: FrotaVeiculoHistoricoPonto[]): number {
  const ordenados = ordenarPontos(pontos);
  let total = 0;
  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const atual = ordenados[i];
    if ((Number(atual.velocidade) || 0) > 0) continue;
    total += intervaloMs(atual, ordenados[i + 1]);
  }
  return total;
}

export function calcularTemposIgnicaoMs(pontos: FrotaVeiculoHistoricoPonto[]) {
  const ordenados = ordenarPontos(pontos);
  let tempoLigadoMs = 0;
  let tempoDesligadoMs = 0;
  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const atual = ordenados[i];
    const delta = intervaloMs(atual, ordenados[i + 1]);
    if (!delta) continue;
    if (atual.ignicao === false) tempoDesligadoMs += delta;
    else if (pontoLigadoOuMovimento(atual)) tempoLigadoMs += delta;
  }
  return { tempoLigadoMs, tempoDesligadoMs };
}
