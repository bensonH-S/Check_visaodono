/** Caminho base do app em produção: /auditoria (sem barra final) */
export const appBasePath =
  (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '';

/** Prefixo da API no mesmo domínio: /auditoria/api */
export const apiBasePath = `${appBasePath}/api`.replace(/\/+/g, '/');

/** Caminho relativo à raiz do app (ex: /ranking, não /auditoria/ranking) */
export function toAppPath(pathname: string): string {
  if (!appBasePath) return pathname || '/';
  if (pathname === appBasePath) return '/';
  if (pathname.startsWith(`${appBasePath}/`)) {
    return pathname.slice(appBasePath.length) || '/';
  }
  return pathname || '/';
}

/** URL de arquivo em public/ (logo, favicon) */
export function assetUrl(file: string): string {
  const name = file.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${name}`;
}
