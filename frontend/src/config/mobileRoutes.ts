import { toAppPath } from './paths';

/** Rotas do app instalado (PWA) — login/mobile + chamados/mobile + checklist/mobile */
export function isMobileAppPath(pathname: string): boolean {
  const p = toAppPath(pathname);
  return (
    p.startsWith('/chamados/mobile') ||
    p.startsWith('/checklist/mobile') ||
    p.startsWith('/frota/mobile') ||
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
