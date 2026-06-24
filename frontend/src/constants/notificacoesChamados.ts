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

export function mensagemUrgenteRegiao(numero: number, nomeLoja?: string | null): string {
  const loja = String(nomeLoja || '').trim() || 'Loja';
  return `Novo chamado urgente #${numero} - ${loja}. Verifique Imediatamente!`;
}

export function mensagemChamadoAtribuido(
  numero: number,
  tecnicoNome?: string | null,
  opts?: { paraVoce?: boolean },
): string {
  if (opts?.paraVoce) {
    return `Chamado atribuído! Chamado #${numero} atribuído a você`;
  }
  const nome = String(tecnicoNome || '').trim();
  return nome
    ? `Chamado atribuído! Chamado #${numero} atribuído ${nome}`
    : `Chamado atribuído! Chamado #${numero}`;
}

function extrairTecnicoDaMensagemAtribuido(mensagem: string): {
  paraVoce: boolean;
  nome: string | null;
} {
  const msg = String(mensagem || '');
  if (/atribu[ií]do a você/i.test(msg)) return { paraVoce: true, nome: null };
  const m = msg.match(/atribu[ií]do (?:a )?(.+?)\.?$/i);
  return { paraVoce: false, nome: m?.[1]?.trim() || null };
}

export function tituloAlertaChamadoOps(
  tipo: TipoAlertaChamadoOps,
  numero: number,
  opts?: { loja?: string | null; mensagem?: string | null },
): string {
  if (tipo === 'chamado_urgente_regiao') {
    return mensagemUrgenteRegiao(numero, opts?.loja);
  }
  const parsed = extrairTecnicoDaMensagemAtribuido(opts?.mensagem || '');
  if (parsed.paraVoce) return mensagemChamadoAtribuido(numero, null, { paraVoce: true });
  return mensagemChamadoAtribuido(numero, parsed.nome);
}
