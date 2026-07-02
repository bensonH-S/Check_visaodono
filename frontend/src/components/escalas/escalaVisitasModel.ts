import type { EscalaVisitasAtribuicao, EscalaVisitasDia } from '../../api/client';

/** Normaliza dia da API (legado ou com várias atribuições). */
export function atribuicoesDoDia(d: EscalaVisitasDia): EscalaVisitasAtribuicao[] {
  if (d.atribuicoes?.length) return d.atribuicoes;
  if (d.id_regional != null) {
    return [
      {
        id_regional: d.id_regional,
        nome_regional: d.nome_regional ?? null,
        cor: d.cor ?? null,
        observacao: d.observacao ?? null,
      },
    ];
  }
  return [];
}

export function idsRegionaisDoDia(d: EscalaVisitasDia): number[] {
  return atribuicoesDoDia(d)
    .map((a) => a.id_regional)
    .filter((id): id is number => id != null);
}

export function diaTemRegional(d: EscalaVisitasDia, idUsuario: number): boolean {
  return idsRegionaisDoDia(d).includes(idUsuario);
}

export function totalAtribuicoesDias(dias: EscalaVisitasDia[]): number {
  return dias.reduce((acc, d) => acc + atribuicoesDoDia(d).length, 0);
}
