export const NOTIFICACOES_REFRESH = 'manut:notificacoes-atualizar';

export function dispararAtualizacaoNotificacoes() {
  window.dispatchEvent(new CustomEvent(NOTIFICACOES_REFRESH));
}
