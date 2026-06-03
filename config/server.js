/**
 * Configuração pública do deploy (edite aqui).
 * Produção: https://grupoalvim.com.br/auditoria/
 */

const isProduction =
  process.env.NODE_ENV === 'production' || process.argv.includes('--production');

/** Subcaminho no domínio (sem barra no final) */
export const APP_BASE_PATH = isProduction ? '/auditoria' : '';

/** Em produção, Node entrega frontend/dist */
export const SERVE_WEB = isProduction;

/** Produção: 3007 (.env na raiz). Dev: 5000 (backend/.env) */
export const PORT = Number(process.env.PORT || 5000);

export function apiPrefix() {
  return APP_BASE_PATH ? `${APP_BASE_PATH}/api` : '/api';
}

export function staticBase() {
  return APP_BASE_PATH ? `${APP_BASE_PATH}/` : '/';
}

export const isProd = isProduction;
