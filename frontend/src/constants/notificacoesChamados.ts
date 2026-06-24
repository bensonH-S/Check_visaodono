/** Espelha backend/notificacoesFiltro.js — alertas operacionais de chamados. */
export const TIPOS_ALERTA_CHAMADOS_OPS = ['chamado_urgente_regiao', 'assumido'] as const;

export type TipoAlertaChamadoOps = (typeof TIPOS_ALERTA_CHAMADOS_OPS)[number];

const SET_OPS = new Set<string>(TIPOS_ALERTA_CHAMADOS_OPS);

export function tipoAlertaChamadoOps(tipo: string): tipo is TipoAlertaChamadoOps {
  return SET_OPS.has(tipo);
}

export function filtrarNotificacoesChamadosOps<T extends { tipo: string }>(lista: T[]): T[] {
  return lista.filter((n) => tipoAlertaChamadoOps(n.tipo));
}

export function tituloAlertaChamadoOps(tipo: TipoAlertaChamadoOps, numero: number): string {
  if (tipo === 'chamado_urgente_regiao') return `Novo chamado urgente #${numero}`;
  return `Chamado atribuído #${numero}`;
}
