export const CHECKLIST_REFRESH = 'checklist:atualizar';

export function dispararAtualizacaoChecklist() {
  window.dispatchEvent(new CustomEvent(CHECKLIST_REFRESH));
}
