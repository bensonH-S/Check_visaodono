/**
 * Configuração do app — edite aqui (não use .env para rotas).
 * Produção: https://grupoalvim.com.br/auditoria/
 */

export const APP_BASE_PATH = '/auditoria';

export const PROD_PORT = 3007;
export const DEV_PORT = 5000;

export const isProd = process.argv.includes('--production');

export const SERVE_WEB = isProd;

export const PORT = Number(process.env.PORT) || (isProd ? PROD_PORT : DEV_PORT);

export function apiPrefix() {
  return `${APP_BASE_PATH}/api`;
}

export function staticBase() {
  return `${APP_BASE_PATH}/`;
}
