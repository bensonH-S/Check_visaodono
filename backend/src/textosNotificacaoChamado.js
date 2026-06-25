/** Textos de notificação — lê templates do banco (com fallback em código). */
import {
  renderMensagemNotificacao,
  renderMensagemSync,
} from './services/notificacaoTemplates.js';

export async function mensagemUrgenteRegiao(numero, nomeLoja) {
  const num = Number(numero) || 0;
  const loja = String(nomeLoja || '').trim() || 'Loja';
  return renderMensagemNotificacao('chamado_urgente_regiao', { numero: num, loja });
}

export async function mensagemChamadoAtribuido(numero, tecnicoNome, { paraVoce = false } = {}) {
  const num = Number(numero) || 0;
  const nome = String(tecnicoNome || '').trim();
  return renderMensagemNotificacao(
    'assumido',
    { numero: num, tecnico: nome },
    { destinatario: paraVoce },
  );
}

export function extrairTecnicoDaMensagemAtribuido(mensagem) {
  const msg = String(mensagem || '');
  if (/atribu[ií]do a você/i.test(msg)) return { paraVoce: true, nome: null };
  const m = msg.match(/atribu[ií]do (?:a )?(.+?)\.?$/i);
  return { paraVoce: false, nome: m?.[1]?.trim() || null };
}

export function tituloNotificacaoOps(tipo, { numero, loja, mensagem, tecnicoNome }) {
  const num = Number(numero) || 0;
  if (tipo === 'chamado_urgente_regiao') {
    return renderMensagemSync('chamado_urgente_regiao', {
      numero: num,
      loja: String(loja || '').trim() || 'Loja',
    });
  }
  if (tipo === 'assumido') {
    if (tecnicoNome) {
      return renderMensagemSync('assumido', { numero: num, tecnico: String(tecnicoNome).trim() });
    }
    const parsed = extrairTecnicoDaMensagemAtribuido(mensagem);
    if (parsed.paraVoce) {
      return renderMensagemSync('assumido', { numero: num }, { destinatario: true });
    }
    return renderMensagemSync('assumido', { numero: num, tecnico: parsed.nome || '' });
  }
  return mensagem || '';
}

export async function mensagemPorEvento(codigo, vars = {}, opts = {}) {
  return renderMensagemNotificacao(codigo, vars, opts);
}
