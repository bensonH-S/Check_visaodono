/** Normaliza variáveis SMTP vindas do Docker --env-file (mantém aspas literais). */

export function cleanEnvValue(value) {
  if (value == null) return '';
  let s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\r/g, '');
}

export function cleanSmtpHost(raw) {
  let host = cleanEnvValue(raw);
  if (!host) return '';
  host = host.replace(/^smtps?:\/\//i, '');
  host = host.replace(/\/.*$/, '');
  const colon = host.indexOf(':');
  if (colon > 0) host = host.slice(0, colon);
  return host.trim();
}

const MAIL_ENV_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_SERVICE',
  'EMAIL_USER',
  'EMAIL_PASS',
  'MAIL_FROM',
];

export function sanitizeMailEnvInProcess() {
  for (const key of MAIL_ENV_KEYS) {
    if (process.env[key] == null) continue;
    process.env[key] = cleanEnvValue(process.env[key]);
  }
  if (process.env.SMTP_HOST) {
    process.env.SMTP_HOST = cleanSmtpHost(process.env.SMTP_HOST);
  }
}
