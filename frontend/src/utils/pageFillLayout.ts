/** Página que preenche a área útil e rola só dentro de tabelas/kanban */
export const pageFillLayoutSx = {
  flex: 1,
  minHeight: 0,
  height: '100%',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  gap: 1.5,
} as const;

export function isPaginaScrollInterno(path: string): boolean {
  const emFrotaPortal =
    path === '/frota' || (path.startsWith('/frota/') && !path.startsWith('/frota/mobile'));
  return (
    path === '/chamados' ||
    path === '/energia' ||
    path === '/visitas' ||
    path === '/escalas/visitas' ||
    path === '/estoque' ||
    path.startsWith('/estoque/') ||
    path === '/chamados/aprovacoes' ||
    emFrotaPortal ||
    path.startsWith('/configuracoes/')
  );
}
