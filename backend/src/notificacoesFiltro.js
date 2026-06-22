/** Tipos ocultos no sino mobile — loja (só abrir chamado) não recebe push. */
export const TIPOS_NOTIF_MOBILE_EXCLUIDOS = ['envio_aprovacao', 'recusa_aprovacao', 'novo_chamado'];

export const TIPOS_NOTIF_APROVACOES = ['envio_aprovacao', 'encaminhar_diretor', 'aprovacao_diretor'];

export function tipoVisivelContextoMobile(tipo) {
  return !TIPOS_NOTIF_MOBILE_EXCLUIDOS.includes(tipo);
}

/**
 * Push espelha o que cada perfil vê no app:
 * - chamados.ver / assumir (técnicos): portal — inclui novo_chamado
 * - chamados.aprovar: tipos de aprovação
 * - chamados.abrir (loja): mobile — sem novo_chamado
 */
export function tipoVisivelPushUsuario(tipo, { podeVer, podeAssumir, podeAbrir, podeAprovar }) {
  const administraChamados = podeVer || podeAssumir;

  if (tipo === 'envio_aprovacao') return podeAprovar;

  if (administraChamados) return true;

  if (podeAprovar && TIPOS_NOTIF_APROVACOES.includes(tipo)) return true;

  if (podeAbrir) return tipoVisivelContextoMobile(tipo);

  return false;
}

export function urlPushChamado(idChamado, tipo, { podeVer, podeAssumir, podeAprovar }) {
  const cid = Number(idChamado);
  if (!Number.isFinite(cid)) return '/chamados/mobile';
  if (podeAprovar && TIPOS_NOTIF_APROVACOES.includes(tipo)) {
    return `/chamados/aprovacoes/${cid}`;
  }
  if (podeVer || podeAssumir) return `/chamados/${cid}`;
  return `/chamados/mobile/${cid}`;
}

export function sqlFiltroContextoNotificacoes(contexto, alias = 'n') {
  if (contexto === 'aprovacoes') {
    return ` AND ${alias}.tipo IN ('envio_aprovacao', 'encaminhar_diretor', 'aprovacao_diretor')`;
  }
  if (contexto === 'chamados-mobile') {
    return ` AND ${alias}.tipo NOT IN ('${TIPOS_NOTIF_MOBILE_EXCLUIDOS.join("','")}')`;
  }
  if (contexto === 'chamados') {
    return ` AND ${alias}.tipo <> 'envio_aprovacao'`;
  }
  return '';
}
