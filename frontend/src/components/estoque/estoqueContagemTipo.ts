export type TipoContagemEstoque = 'completa' | 'critica_semanal' | 'diaria';

/** Mix/latas de segunda. Desligada: só diária e completa. */
export const CONTAGEM_SEMANAL_ATIVA = false;

/**
 * Dia 01 do mês em Brasília (00:00–23:59): diária oculta; só contagem completa.
 * Usa America/Sao_Paulo para todos os dispositivos (mesma regra nas lojas).
 */
export function ehDiaContagemCompletaObrigatoria(agora = new Date()): boolean {
  return agendaContagem(agora).dia1;
}

/** Mesma regra do servidor, no fuso de Brasília. */
export function agendaContagem(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: 'numeric',
  }).formatToParts(agora);
  const dia = Number(partes.find((p) => p.type === 'day')?.value);
  const segunda = partes.find((p) => p.type === 'weekday')?.value === 'Mon';
  if (dia === 1) {
    return { dia1: true, segunda, diaria: false, semanal: false, mensal: true };
  }
  if (segunda) {
    return { dia1: false, segunda: true, diaria: false, semanal: true, mensal: false };
  }
  return { dia1: false, segunda: false, diaria: true, semanal: false, mensal: true };
}

export function rotuloTipoContagem(tipo?: string | null) {
  if (tipo === 'diaria') return 'Diária';
  if (tipo === 'critica_semanal') return 'Semanal · segunda';
  return 'Completa';
}

export function ehContagemParcial(tipo?: string | null) {
  return tipo === 'diaria' || tipo === 'critica_semanal';
}
