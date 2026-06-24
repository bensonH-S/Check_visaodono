/** Textos padronizados — sino, push e WhatsApp (chamados operacionais). */

export function mensagemUrgenteRegiao(numero, nomeLoja) {
  const num = Number(numero) || 0;
  const loja = String(nomeLoja || '').trim() || 'Loja';
  return `Novo chamado urgente #${num} - ${loja}. Verifique Imediatamente!`;
}

export function mensagemChamadoAtribuido(numero, tecnicoNome, { paraVoce = false } = {}) {
  const num = Number(numero) || 0;
  if (paraVoce) {
    return `Chamado atribuído! Chamado #${num} atribuído a você`;
  }
  const nome = String(tecnicoNome || '').trim();
  return nome
    ? `Chamado atribuído! Chamado #${num} atribuído ${nome}`
    : `Chamado atribuído! Chamado #${num}`;
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
    return mensagemUrgenteRegiao(num, loja);
  }
  if (tipo === 'assumido') {
    if (tecnicoNome) return mensagemChamadoAtribuido(num, tecnicoNome);
    const parsed = extrairTecnicoDaMensagemAtribuido(mensagem);
    if (parsed.paraVoce) return mensagemChamadoAtribuido(num, null, { paraVoce: true });
    return mensagemChamadoAtribuido(num, parsed.nome);
  }
  return mensagem || '';
}
