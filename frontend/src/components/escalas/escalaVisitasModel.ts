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
  if (d.id_loja_destino != null) {
    return [
      {
        id_loja_destino: d.id_loja_destino,
        nome_loja_destino: d.nome_loja_destino ?? null,
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

export function idsLojasDestinoDoDia(d: EscalaVisitasDia): number[] {
  return atribuicoesDoDia(d)
    .map((a) => a.id_loja_destino)
    .filter((id): id is number => id != null);
}

export function diaTemRegional(d: EscalaVisitasDia, idUsuario: number): boolean {
  return idsRegionaisDoDia(d).includes(idUsuario);
}

export function totalAtribuicoesDias(dias: EscalaVisitasDia[]): number {
  return dias.reduce((acc, d) => acc + atribuicoesDoDia(d).length, 0);
}

export function rotuloLojaDestino(
  id: number,
  mapa?: Map<number, { nome: string; bk_number?: string | null }>,
): string {
  const loja = mapa?.get(id);
  if (!loja) return String(id);
  if (loja.bk_number) return loja.bk_number;
  const nome = loja.nome.split(' - ').pop() ?? loja.nome;
  return nome.length > 12 ? `${nome.slice(0, 11)}…` : nome;
}
