/** Alertas operacionais de chamados (push, sino, WhatsApp). */
export const TIPOS_ALERTA_CHAMADOS_OPS = ['chamado_urgente_regiao', 'assumido'];

/** Push no celular: só estes dois. */
export const TIPOS_PUSH_PERMITIDOS = new Set(TIPOS_ALERTA_CHAMADOS_OPS);

export const TIPOS_NOTIF_APROVACOES = ['envio_aprovacao', 'encaminhar_diretor', 'aprovacao_diretor'];

/** Tipos que podem ser gravados no banco (chamados + aprovação). */
const TIPOS_ALERTA_GRAVAR = new Set([
  ...TIPOS_ALERTA_CHAMADOS_OPS,
  ...TIPOS_NOTIF_APROVACOES,
  'aguardando_aprovacao',
  'aprovacao',
  'recusa_aprovacao',
]);

export function tipoEnviaPush(tipo) {
  return TIPOS_PUSH_PERMITIDOS.has(tipo);
}

/** Só grava notificação se o tipo estiver na lista permitida. */
export function tipoGeraAlertaChamado(tipo) {
  return TIPOS_ALERTA_GRAVAR.has(tipo);
}

export function tipoVisivelContextoMobile(tipo) {
  return TIPOS_ALERTA_CHAMADOS_OPS.includes(tipo);
}

/**
 * Push espelha o que cada perfil vê no app:
 * - chamados.assumir / frota.regioes: região de atuação
 * - chamados.abrir / chamados.ver (sem região): lojas vinculadas
 * - chamados.aprovar: tipos de aprovação
 */
export function tipoVisivelPushUsuario(tipo, { podeVer, podeAssumir, podeAbrir, podeAprovar }) {
  if (!tipoEnviaPush(tipo)) return false;

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
    return ` AND ${alias}.tipo IN ('${TIPOS_NOTIF_APROVACOES.join("','")}')`;
  }
  if (contexto === 'chamados-mobile' || contexto === 'chamados') {
    return ` AND ${alias}.tipo IN ('${TIPOS_ALERTA_CHAMADOS_OPS.join("','")}')`;
  }
  return '';
}
