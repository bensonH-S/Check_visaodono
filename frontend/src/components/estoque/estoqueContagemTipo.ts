export type TipoContagemEstoque = 'completa' | 'critica_semanal' | 'diaria';

export function rotuloTipoContagem(tipo?: string | null) {
  if (tipo === 'diaria') return 'Diária';
  if (tipo === 'critica_semanal') return 'Semanal · segunda';
  return 'Completa';
}

export function ehContagemParcial(tipo?: string | null) {
  return tipo === 'diaria' || tipo === 'critica_semanal';
}
