import { pool } from '../db.js';
import { logger } from '../logger.js';
import { cleanEnvValue, cleanSmtpHost, sanitizeMailEnvInProcess } from '../config/envSanitize.js';

let _cachedSmtp = null;

export async function garantirTabelaConfiguracaoSmtp() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracao_smtp (
        id SERIAL PRIMARY KEY,
        host VARCHAR(255),
        port INTEGER DEFAULT 587,
        secure BOOLEAN DEFAULT false,
        usuario VARCHAR(255),
        senha VARCHAR(255),
        service VARCHAR(100),
        email_from VARCHAR(255),
        nome_from VARCHAR(255),
        ativo BOOLEAN DEFAULT true,
        atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        atualizado_por VARCHAR(255)
      )
    `);
  } catch (e) {
    logger.warn('smtpConfig', 'Falha ao garantir tabela configuracao_smtp: ' + e.message);
  }
}

function getEnvCreds() {
  sanitizeMailEnvInProcess();
  const host = cleanSmtpHost(process.env.SMTP_HOST);
  const port = Number(cleanEnvValue(process.env.SMTP_PORT) || 587);
  const secure = cleanEnvValue(process.env.SMTP_SECURE).toLowerCase() === 'true';
  const user = cleanEnvValue(process.env.SMTP_USER || process.env.EMAIL_USER);
  const pass = cleanEnvValue(process.env.SMTP_PASS || process.env.EMAIL_PASS);
  const service = cleanEnvValue(process.env.SMTP_SERVICE) || 'gmail';
  const fromName = cleanEnvValue(process.env.MAIL_FROM_NAME) || 'MERIDIAN';
  const fromAddr = cleanEnvValue(process.env.MAIL_FROM) || '';
  return { host, port, secure, user, pass, service, fromName, fromAddr };
}

export async function obterConfiguracaoSmtp() {
  await garantirTabelaConfiguracaoSmtp();
  try {
    const { rows } = await pool.query(
      `SELECT id, host, port, secure, usuario, senha, service, email_from, nome_from, ativo, atualizado_em, atualizado_por
       FROM configuracao_smtp
       ORDER BY id ASC
       LIMIT 1`
    );

    if (rows.length > 0) {
      const row = rows[0];
      const env = getEnvCreds();
      const senhaEfetiva = row.senha || env.pass || '';
      _cachedSmtp = { ...row, senha: senhaEfetiva };
      return {
        id: row.id,
        host: row.host || env.host || '',
        port: Number(row.port) || env.port || 587,
        secure: Boolean(row.secure),
        usuario: row.usuario || env.user || '',
        senha: senhaEfetiva,
        tem_senha: Boolean(senhaEfetiva && senhaEfetiva.trim().length > 0),
        service: row.service || env.service || '',
        email_from: row.email_from || env.fromAddr || (env.user ? env.user : ''),
        nome_from: row.nome_from || env.fromName || 'MERIDIAN',
        ativo: row.ativo !== false,
        atualizado_em: row.atualizado_em,
        atualizado_por: row.atualizado_por || null,
        origem: 'banco',
      };
    }

    // Se ainda não houver registro no banco, inicializa a partir do .env
    const env = getEnvCreds();
    return {
      id: null,
      host: env.host || '',
      port: env.port || 587,
      secure: env.secure || false,
      usuario: env.user || '',
      senha: env.pass || '',
      tem_senha: Boolean(env.pass),
      service: env.service || '',
      email_from: env.fromAddr || (env.user ? env.user : ''),
      nome_from: env.fromName || 'MERIDIAN',
      ativo: Boolean(env.user && env.pass),
      atualizado_em: null,
      atualizado_por: null,
      origem: 'env',
    };
  } catch (e) {
    logger.error('smtpConfig', 'Erro ao obter configuracao SMTP: ' + e.message);
    const env = getEnvCreds();
    return {
      id: null,
      host: env.host || '',
      port: env.port || 587,
      secure: env.secure || false,
      usuario: env.user || '',
      senha: env.pass || '',
      tem_senha: Boolean(env.pass),
      service: env.service || '',
      email_from: env.fromAddr || '',
      nome_from: env.fromName || 'MERIDIAN',
      ativo: Boolean(env.user && env.pass),
      atualizado_em: null,
      atualizado_por: null,
      origem: 'env',
    };
  }
}

export async function salvarConfiguracaoSmtp(dados, usuarioNome = 'Sistema') {
  await garantirTabelaConfiguracaoSmtp();

  const { rows: existentes } = await pool.query(
    `SELECT id, senha FROM configuracao_smtp ORDER BY id ASC LIMIT 1`
  );

  let senhaFinal = dados.senha;
  const existente = existentes[0];

  // Se a senha enviada estiver vazia ou mascarada, mantém a anterior
  if (!senhaFinal || senhaFinal.trim() === '' || senhaFinal === '••••••••') {
    if (existente?.senha) {
      senhaFinal = existente.senha;
    } else {
      const env = getEnvCreds();
      senhaFinal = env.pass || '';
    }
  }

  const host = cleanSmtpHost(dados.host || '');
  const port = Number(dados.port) || 587;
  const secure = Boolean(dados.secure);
  const usuario = String(dados.usuario || '').trim();
  const email_from = String(dados.email_from || '').trim();
  const nome_from = String(dados.nome_from || '').trim();
  const ativo = dados.ativo !== false;
  const service = String(dados.service || '').trim();

  let idSalvo = existente?.id;

  if (existente) {
    await pool.query(
      `UPDATE configuracao_smtp
       SET host = $1, port = $2, secure = $3, usuario = $4, senha = $5,
           email_from = $6, nome_from = $7, ativo = $8, service = $9,
           atualizado_em = NOW(), atualizado_por = $10
       WHERE id = $11`,
      [host, port, secure, usuario, senhaFinal, email_from, nome_from, ativo, service, usuarioNome, existente.id]
    );
  } else {
    const { rows: inserted } = await pool.query(
      `INSERT INTO configuracao_smtp
        (host, port, secure, usuario, senha, email_from, nome_from, ativo, service, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [host, port, secure, usuario, senhaFinal, email_from, nome_from, ativo, service, usuarioNome]
    );
    idSalvo = inserted[0]?.id;
  }

  _cachedSmtp = {
    id: idSalvo,
    host,
    port,
    secure,
    usuario,
    senha: senhaFinal,
    email_from,
    nome_from,
    ativo,
    service,
  };

  logger.info('smtpConfig', 'Configuração SMTP atualizada com sucesso', {
    host,
    port,
    usuario,
    ativo,
    atualizado_por: usuarioNome,
  });

  return await obterConfiguracaoSmtp();
}

/**
 * Retorna as credenciais ativas para envio de e-mail (usado pelo mailer).
 */
export async function obterCredenciaisSmtpAtivas() {
  if (_cachedSmtp && _cachedSmtp.usuario) {
    return _cachedSmtp;
  }

  try {
    await garantirTabelaConfiguracaoSmtp();
    const { rows } = await pool.query(
      `SELECT id, host, port, secure, usuario, senha, service, email_from, nome_from, ativo
       FROM configuracao_smtp
       WHERE ativo = true
       ORDER BY id ASC
       LIMIT 1`
    );

    if (rows.length > 0 && rows[0].usuario && rows[0].senha) {
      _cachedSmtp = { ...rows[0] };
      return _cachedSmtp;
    }
  } catch (e) {
    logger.warn('smtpConfig', 'Erro ao ler credenciais ativas do banco: ' + e.message);
  }

  // Fallback para .env
  const env = getEnvCreds();
  return {
    id: null,
    host: env.host,
    port: env.port,
    secure: env.secure,
    usuario: env.user,
    senha: env.pass,
    service: env.service,
    email_from: env.fromAddr || env.user,
    nome_from: env.fromName,
    ativo: Boolean(env.user && env.pass),
  };
}

export function cacheSmtpConfigurado() {
  if (_cachedSmtp && _cachedSmtp.ativo && _cachedSmtp.usuario && _cachedSmtp.senha) {
    return true;
  }
  const env = getEnvCreds();
  return Boolean(env.user && env.pass);
}
