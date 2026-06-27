import { toAppPath } from './paths';

/** Rotas hub mobile: título + resumo fixos; lista/conteúdo principal rola na página. */
export function mobileDetalheChamado(pathname: string): boolean {
  const p = toAppPath(pathname);
  return /^\/chamados\/mobile\/\d+$/.test(p);
}

export function mobilePaginaCabecalhoFixo(pathname: string): boolean {
  const p = toAppPath(pathname);
  return (
    p === '/chamados/mobile' ||
    mobileDetalheChamado(pathname) ||
    p === '/visitas/mobile' ||
    p === '/frota/mobile' ||
    p === '/checklist/mobile' ||
    p.startsWith('/relatorio/visita/')
  );
}

/** Rotas do app instalado (PWA) — login/mobile + chamados/mobile + checklist/mobile */
export function isMobileAppPath(pathname: string): boolean {
  const p = toAppPath(pathname);
  return (
    p.startsWith('/chamados/mobile') ||
    p.startsWith('/checklist/mobile') ||
    p.startsWith('/frota/mobile') ||
    p.startsWith('/visitas/mobile') ||
    p.startsWith('/relatorio/visita/') ||
    p === '/login/mobile'
  );
}

export function checklistPaths(pathname: string) {
  const mobile = toAppPath(pathname).startsWith('/checklist/mobile');
  const base = mobile ? '/checklist/mobile' : '/checklist';
  return {
    mobile,
    base,
    concluido: (id: number | string) => `${base}/concluido/${id}`,
  };
}
