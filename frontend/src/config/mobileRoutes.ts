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
    p === '/escalas/visitas/mobile' ||
    p === '/nc/mobile' ||
    p === '/energia/mobile' ||
    p === '/energia/mobile/novo' ||
    /^\/energia\/mobile\/\d+$/.test(p) ||
    p === '/estoque/mobile' ||
    p === '/freelancers/aprovacao/mobile' ||
    p === '/mapa/mobile' ||
    p === '/frota/mobile' ||
    p === '/portais/mobile' ||
    p === '/checklist/mobile' ||
    p.startsWith('/relatorio/mobile/visita/')
  );
}

/** Rotas do app instalado (PWA) — login/mobile + chamados/mobile + checklist/mobile */
export function isMobileAppPath(pathname: string): boolean {
  const p = toAppPath(pathname);
  return (
    p.startsWith('/chamados/mobile') ||
    p.startsWith('/checklist/mobile') ||
    p.startsWith('/frota/mobile') ||
    p.startsWith('/mapa/mobile') ||
    p.startsWith('/visitas/mobile') ||
    p.startsWith('/escalas/visitas/mobile') ||
    p.startsWith('/nc/mobile') ||
    p.startsWith('/energia/mobile') ||
    p.startsWith('/estoque/mobile') ||
    p.startsWith('/freelancers/aprovacao/mobile') ||
    p.startsWith('/portais/mobile') ||
    p.startsWith('/relatorio/mobile/visita/') ||
    p === '/login/mobile'
  );
}

/** Link do relatório: mobile e desktop em rotas distintas. */
export function relatorioVisitaPath(id: number | string, mobile = false) {
  return mobile ? `/relatorio/mobile/visita/${id}` : `/relatorio/visita/${id}`;
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
