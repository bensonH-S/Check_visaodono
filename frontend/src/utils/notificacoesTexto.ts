import type { ContextoNotificacoesManut, ManutNotificacao } from '../api/client';
import { tituloAlertaChamadoOps } from '../constants/notificacoesChamados';

type OpcoesTituloNotificacao = {
  contexto?: ContextoNotificacoesManut;
};

function prefixoChamado(num: number, contexto?: ContextoNotificacoesManut): string {
  return contexto === 'aprovacoes' ? `#${num} · ` : `Chamado #${num} - `;
}

function limparMensagemAprovacao(mensagem: string, num: number): string {
  return mensagem
    .replace(/^Chamado\s*#\d+\s*[-–—·]\s*/i, `#${num} · `)
    .replace(/^Chamado\s*#\d+\s*/i, `#${num} · `)
    .trim();
}

function tituloEnvioAprovacao(n: ManutNotificacao, contexto?: ContextoNotificacoesManut): string {
  const num = n.numero;
  const p = prefixoChamado(num, contexto);
  const msg = n.mensagem || '';
  if (/aprovado pelo Diretor/i.test(msg) && /Financeiro/i.test(msg)) {
    return `${p}Orçamento aprovado pelo Diretor e enviado ao Financeiro`;
  }
  if (/aguarda avaliação do Diretor|encaminhado ao Diretor/i.test(msg)) {
    return `${p}Orçamento encaminhado ao Diretor para avaliação`;
  }
  if (/Diretor\)/i.test(msg) || /\(Diretor\)/i.test(msg)) {
    return `${p}Orçamento pendente de aprovação (Diretor)`;
  }
  if (/Financeiro\)/i.test(msg) || /\(Financeiro\)/i.test(msg)) {
    return `${p}Orçamento pendente de aprovação (Financeiro)`;
  }
  return `${p}Orçamento pendente de aprovação`;
}

export function tituloNotificacaoChamado(
  n: ManutNotificacao,
  opts?: OpcoesTituloNotificacao,
): string {
  const num = n.numero;
  const contexto = opts?.contexto;
  const tipo = String(n.tipo || '').trim();
  const p = prefixoChamado(num, contexto);

  if (contexto === 'chamados' || contexto === 'chamados-mobile') {
    if (tipo === 'assumido' || tipo === 'chamado_urgente_regiao') {
      if (n.mensagem?.trim()) return n.mensagem.trim();
      return tituloAlertaChamadoOps(tipo, num, { loja: n.loja, mensagem: n.mensagem });
    }
    return '';
  }

  switch (tipo) {
    case 'assumido':
    case 'chamado_urgente_regiao':
      return tituloAlertaChamadoOps(tipo, num, { loja: n.loja, mensagem: n.mensagem });
    case 'resposta':
      return `Nova Mensagem Chamado #${num}`;
    case 'fechamento':
      return /cancelado/i.test(n.mensagem)
        ? `Chamado #${num} - Cancelado`
        : `Chamado #${num} - Concluído`;
    case 'novo_chamado': {
      const loja = n.loja?.trim() || '';
      return loja
        ? `Novo Chamado #${num} - Aberto (${loja})`
        : `Novo Chamado #${num} - Aberto`;
    }
    case 'anexo':
      return `Novo anexo adicionado no chamado #${num}`;
    case 'aguardando_aprovacao':
      return `Chamado #${num} - Aguardando aprovação do Orçamento`;
    case 'envio_aprovacao':
      return tituloEnvioAprovacao(n, contexto);
    case 'encaminhar_diretor':
      return `${p}Orçamento encaminhado ao Diretor para avaliação`;
    case 'aprovacao_diretor':
      return `${p}Orçamento aprovado pelo Diretor e enviado ao Financeiro`;
    case 'aprovacao':
      return contexto === 'aprovacoes' ? `${p}Orçamento aprovado` : `Chamado #${num} - Orçamento aprovado`;
    case 'recusa_aprovacao':
      return `Orçamento do chamado #${num} - Não Aprovado`;
    case 'reabertura':
      return `Chamado #${num} - Reaberto`;
    default:
      return contexto === 'aprovacoes' ? limparMensagemAprovacao(n.mensagem, num) : n.mensagem;
  }
}
