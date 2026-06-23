import { toAppPath } from './paths';

/** Rotas do app instalado (PWA) — login/mobile + chamados/mobile + checklist/mobile */
export function isMobileAppPath(pathname: string): boolean {
  const p = toAppPath(pathname);
  return (
    path.startsWith('/chamados/mobile') ||
    path.startsWith('/checklist/mobile') ||
    path.startsWith('/frota/mobile') ||
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
