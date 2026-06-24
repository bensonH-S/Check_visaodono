/** Tipos ocultos no sino (mobile e portal de chamados). */
export const TIPOS_NOTIF_MOBILE_EXCLUIDOS = ['envio_aprovacao', 'recusa_aprovacao', 'novo_chamado', 'anexo'];

/** Push e alertas operacionais: só urgente na região e chamado atribuído. */
export const TIPOS_PUSH_PERMITIDOS = new Set(['chamado_urgente_regiao', 'assumido']);

/** Não grava sino/push/WhatsApp para estes tipos. */
export const TIPOS_NOTIF_SEM_ALERTA = new Set(['novo_chamado', 'anexo']);

export function tipoEnviaPush(tipo) {
  return TIPOS_PUSH_PERMITIDOS.has(tipo);
}

export function tipoGeraAlertaChamado(tipo) {
  if (TIPOS_NOTIF_SEM_ALERTA.has(tipo)) return false;
  return true;
}

export const TIPOS_NOTIF_APROVACOES = ['envio_aprovacao', 'encaminhar_diretor', 'aprovacao_diretor'];

export function tipoVisivelContextoMobile(tipo) {
  return !TIPOS_NOTIF_MOBILE_EXCLUIDOS.includes(tipo);
}

/**
 * Push espelha o que cada perfil vê no app:
 * - chamados.assumir / frota.regioes: região de atuação
 * - chamados.abrir / chamados.ver (sem região): lojas vinculadas
 * - chamados.aprovar: tipos de aprovação
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
    return ` AND ${alias}.tipo NOT IN ('envio_aprovacao', 'novo_chamado', 'anexo')`;
  }
  return '';
}
