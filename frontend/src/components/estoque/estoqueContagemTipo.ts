export type TipoContagemEstoque = 'completa' | 'critica_semanal' | 'diaria';

/** Mix/latas de segunda. Desligada: só diária e completa. */
export const CONTAGEM_SEMANAL_ATIVA = false;

/**
 * Dia 01 do mês em Brasília (00:00–23:59): diária oculta; só contagem completa.
 * Usa America/Sao_Paulo para todos os dispositivos (mesma regra nas lojas).
 */
export function ehDiaContagemCompletaObrigatoria(agora = new Date()): boolean {
  const dia = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      day: 'numeric',
    }).format(agora),
  );
  return dia === 1;
}

export function rotuloTipoContagem(tipo?: string | null) {
  if (tipo === 'diaria') return 'Diária';
  if (tipo === 'critica_semanal') return 'Semanal · segunda';
  return 'Completa';
}

export function ehContagemParcial(tipo?: string | null) {
  return tipo === 'diaria' || tipo === 'critica_semanal';
}
