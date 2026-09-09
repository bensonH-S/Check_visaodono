export type TipoContagemEstoque = 'completa' | 'critica_semanal' | 'diaria';

/** Mix/latas de segunda. Desligada: só diária e completa. */
export const CONTAGEM_SEMANAL_ATIVA = false;

export function rotuloTipoContagem(tipo?: string | null) {
  if (tipo === 'diaria') return 'Diária';
  if (tipo === 'critica_semanal') return 'Semanal · segunda';
  return 'Completa';
}

export function ehContagemParcial(tipo?: string | null) {
  return tipo === 'diaria' || tipo === 'critica_semanal';
}
