/** Telefone ou tablet em modo mobile — usado para rotear login/chamados mobile. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/** App no telefone: layout antigo (claro). Tema escuro fica no desktop. */
export function deveForcarTemaClaroMobile(): boolean {
  if (typeof window === 'undefined') return false;
  if (isMobileDevice()) return true;
  return window.matchMedia('(max-width: 899.95px)').matches;
}
