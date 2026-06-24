import type { ManutChamadoDetalhe } from '../api/client';
import type { UsuarioSessao } from '../lib/auth';
import { temPermissao } from '../lib/auth';
import { limparTextoAprovacao } from './manutencaoUi';

const TIPOS_EVENTO_APROVACAO = new Set([
  'envio_aprovacao',
  'encaminhar_diretor',
  'aprovacao_diretor',
  'aprovacao',
  'recusa_aprovacao',
]);

/** Equipe de manutenção vê detalhes do fluxo de aprovação conforme permissões. */
export function podeVerDetalhesAprovacaoChamado(
  sessao?: UsuarioSessao | null,
  _detalhe?: ManutChamadoDetalhe,
) {
  if (!sessao) return false;
  return (
    temPermissao('chamados.assumir', sessao) ||
    temPermissao('chamados.ver', sessao) ||
    temPermissao('chamados.aprovar', sessao)
  );
}

export function textosEventosAprovacao(detalhe: ManutChamadoDetalhe) {
  const textos = new Set<string>();
  for (const ev of detalhe.eventos ?? []) {
    if (!TIPOS_EVENTO_APROVACAO.has(ev.tipo)) continue;
    const bruto = ev.texto?.trim();
    if (bruto) textos.add(bruto);
    const limpo = limparTextoAprovacao(bruto);
    if (limpo) textos.add(limpo);
  }
  return textos;
}

export function atualizacaoDuplicaAprovacao(
  texto: string,
  textosEventos: Set<string>,
) {
  const t = texto.trim();
  if (!t) return false;
  const limpo = limparTextoAprovacao(t);
  if (!limpo) return true;
  for (const ev of textosEventos) {
    if (t === ev || limpo === ev || t.includes(ev) || ev.includes(t)) return true;
  }
  return false;
}

/** Encaminhamento interno não aparece no histórico do ticket. */
export function deveOcultarEventoAprovacaoNoHistorico(tipo: string) {
  return tipo === 'encaminhar_diretor';
}

/** No mobile do gerente da loja: oculta etapas internas do fluxo de aprovação. */
export const TIPOS_EVENTO_APROVACAO_INTERNO_MOBILE = new Set([
  'envio_aprovacao',
  'recusa_aprovacao',
  'aprovacao_diretor',
]);

export function corpoEventoAprovacaoExibicao(
  texto: string | null | undefined,
  ocultarDetalhe: boolean,
) {
  if (ocultarDetalhe) return undefined;
  const limpo = limparTextoAprovacao(texto);
  return limpo || undefined;
}
