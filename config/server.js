const prod =
  process.env.APP_ENV === 'production' || process.argv.includes('--production');

export const isProd = prod;

export const APP_BASE_PATH = (process.env.APP_BASE_PATH ?? (prod ? '/auditoria' : ''))
  .replace(/\/$/, '');

export const SERVE_WEB =
  process.env.SERVE_WEB === '1' ||
  process.env.SERVE_WEB === 'true' ||
  (prod && process.env.SERVE_WEB !== '0' && process.env.SERVE_WEB !== 'false');

export const PORT = Number(process.env.PORT || (prod ? 3007 : 5000));

export function apiPrefix() {
  return APP_BASE_PATH ? `${APP_BASE_PATH}/api` : '/api';
}

export function staticBase() {
  return APP_BASE_PATH ? `${APP_BASE_PATH}/` : '/';
}
