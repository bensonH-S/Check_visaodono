/** Espelha backend/notificacoesFiltro.js — alertas operacionais de chamados. */
export const TIPOS_ALERTA_CHAMADOS_OPS = ['chamado_urgente_regiao', 'novo_chamado', 'assumido'] as const;

export const TIPOS_MOVIMENTACAO_CHAMADO = ['resposta', 'anexo', 'fechamento', 'reabertura'] as const;

export const TIPOS_NOTIF_APROVACOES = [
  'envio_aprovacao',
  'encaminhar_diretor',
  'aprovacao_diretor',
] as const;

export const TIPOS_APROVACAO_RESULTADO = ['aguardando_aprovacao', 'aprovacao', 'recusa_aprovacao'] as const;

export const TIPOS_PAINEL_DIRETOR = [
  ...TIPOS_ALERTA_CHAMADOS_OPS,
  ...TIPOS_MOVIMENTACAO_CHAMADO,
  ...TIPOS_NOTIF_APROVACOES,
  ...TIPOS_APROVACAO_RESULTADO,
] as const;

export type TipoAlertaChamadoOps = (typeof TIPOS_ALERTA_CHAMADOS_OPS)[number];

const SET_OPS = new Set<string>(TIPOS_ALERTA_CHAMADOS_OPS);
const SET_PAINEL_DIRETOR = new Set<string>(TIPOS_PAINEL_DIRETOR);

export function tipoAlertaChamadoOps(tipo: string): tipo is TipoAlertaChamadoOps {
  return SET_OPS.has(tipo);
}

export function filtrarNotificacoesChamadosOps<T extends { tipo: string }>(lista: T[]): T[] {
  return lista.filter((n) => tipoAlertaChamadoOps(n.tipo));
}

export function filtrarNotificacoesVisiveisChamados<T extends { tipo: string }>(
  lista: T[],
  opts?: { painelDiretor?: boolean },
): T[] {
  if (opts?.painelDiretor) {
    return lista.filter((n) => SET_PAINEL_DIRETOR.has(n.tipo));
  }
  return filtrarNotificacoesChamadosOps(lista);
}

export function mensagemUrgenteRegiao(numero: number, nomeLoja?: string | null): string {
  const loja = String(nomeLoja || '').trim() || 'Loja';
  return `Novo chamado urgente #${numero} - ${loja}. Verifique Imediatamente!`;
}

export function mensagemNovoChamadoRegiao(numero: number, nomeLoja?: string | null): string {
  const loja = String(nomeLoja || '').trim() || 'Loja';
  return `Novo Chamado #${numero} - Aberto (${loja})`;
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
  if (tipo === 'novo_chamado') {
    return mensagemNovoChamadoRegiao(numero, opts?.loja);
  }
  const parsed = extrairTecnicoDaMensagemAtribuido(opts?.mensagem || '');
  if (parsed.paraVoce) return mensagemChamadoAtribuido(numero, null, { paraVoce: true });
  return mensagemChamadoAtribuido(numero, parsed.nome);
}
