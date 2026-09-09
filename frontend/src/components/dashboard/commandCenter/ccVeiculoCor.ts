/** Percursos no mapa: laranja/ouro saturados — leem no preto, da família da logo. */
export const CORES_VEICULO_CC = [
  '#FF5C00',
  '#FFB703',
  '#FF8C38',
  '#E8520A',
  '#FFD60A',
  '#FF6B35',
  '#E63900',
  '#FFAA33',
  '#FF7A18',
  '#F77F00',
  '#FFC300',
  '#FF9F1C',
] as const;

export function corVeiculoId(id: number): string {
  const n = Math.abs(Number(id)) || 0;
  const h = Math.imul(n, 2654435761) >>> 0;
  return CORES_VEICULO_CC[h % CORES_VEICULO_CC.length];
}

export function coresRotaVeiculo(cor: string): string[] {
  return [cor, cor, cor, cor];
}
