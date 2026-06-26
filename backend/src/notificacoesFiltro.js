/** Alertas operacionais de chamados (push, sino, WhatsApp). */
export const TIPOS_ALERTA_CHAMADOS_OPS = [
  'chamado_urgente_regiao',
  'novo_chamado',
  'assumido',
  'sla_alerta_80',
  'sla_estourado',
];

/** Movimentações (mensagens, anexos, fechamento). */
export const TIPOS_MOVIMENTACAO_CHAMADO = ['resposta', 'anexo', 'fechamento', 'reabertura'];

export const TIPOS_NOTIF_APROVACOES = ['envio_aprovacao', 'encaminhar_diretor', 'aprovacao_diretor'];

export const TIPOS_APROVACAO_RESULTADO = ['aguardando_aprovacao', 'aprovacao', 'recusa_aprovacao'];

/** Painel unificado do Diretor no sino de chamados. */
export const TIPOS_PAINEL_DIRETOR = [
  ...TIPOS_ALERTA_CHAMADOS_OPS,
  ...TIPOS_MOVIMENTACAO_CHAMADO,
  ...TIPOS_NOTIF_APROVACOES,
  ...TIPOS_APROVACAO_RESULTADO,
];

const TIPOS_PUSH_APROVACAO = new Set([
  ...TIPOS_NOTIF_APROVACOES,
  ...TIPOS_APROVACAO_RESULTADO,
]);

/** Push no celular — operacional + movimentações + aprovações. */
export const TIPOS_PUSH_PERMITIDOS = new Set([
  ...TIPOS_ALERTA_CHAMADOS_OPS,
  ...TIPOS_MOVIMENTACAO_CHAMADO,
  ...TIPOS_PUSH_APROVACAO,
]);

/** Tipos que podem ser gravados no banco (chamados + aprovação). */
const TIPOS_ALERTA_GRAVAR = new Set(TIPOS_PAINEL_DIRETOR);

export function tipoEnviaPush(tipo) {
  return TIPOS_PUSH_PERMITIDOS.has(tipo);
}

export function tipoGeraAlertaChamado(tipo) {
  return TIPOS_ALERTA_GRAVAR.has(tipo);
}

export function tipoVisivelContextoMobile(tipo) {
  return TIPOS_ALERTA_CHAMADOS_OPS.includes(tipo);
}

export function tipoMovimentacaoChamado(tipo) {
  return TIPOS_MOVIMENTACAO_CHAMADO.includes(tipo);
}

export function tipoAprovacaoChamado(tipo) {
  return TIPOS_NOTIF_APROVACOES.includes(tipo) || TIPOS_APROVACAO_RESULTADO.includes(tipo);
}

/**
 * Push por perfil:
 * - equipe operacional: abertura + atribuição
 * - diretoria (chamados.aprovar): tudo do painel diretor
 */
export function tipoVisivelPushUsuario(tipo, { podeVer, podeAssumir, podeAbrir, podeAprovar }) {
  if (!tipoEnviaPush(tipo)) return false;

  const administraChamados = podeVer || podeAssumir;
  if (tipoMovimentacaoChamado(tipo) || tipoAprovacaoChamado(tipo)) return podeAprovar;
  if (administraChamados) return true;
  if (podeAprovar && tipoVisivelContextoMobile(tipo)) return true;
  if (podeAbrir) return tipoVisivelContextoMobile(tipo);
  return false;
}

export function urlPushChamado(idChamado, tipo, { podeVer, podeAssumir, podeAprovar }) {
  const cid = Number(idChamado);
  if (!Number.isFinite(cid)) return '/chamados/mobile';
  if (podeAprovar && (tipoAprovacaoChamado(tipo) || tipoMovimentacaoChamado(tipo))) {
    return podeVer || podeAssumir ? `/chamados/${cid}` : `/chamados/aprovacoes/${cid}`;
  }
  if (podeVer || podeAssumir) return `/chamados/${cid}`;
  return `/chamados/mobile/${cid}`;
}

export function sqlFiltroContextoNotificacoes(
  contexto,
  alias = 'n',
  { painelDiretor = false } = {},
) {
  if (contexto === 'aprovacoes') {
    return ` AND ${alias}.tipo IN ('${TIPOS_NOTIF_APROVACOES.join("','")}')`;
  }
  if (contexto === 'chamados-mobile' || contexto === 'chamados') {
    const tipos = painelDiretor ? TIPOS_PAINEL_DIRETOR : TIPOS_ALERTA_CHAMADOS_OPS;
    return ` AND ${alias}.tipo IN ('${tipos.join("','")}')`;
  }
  return '';
}
