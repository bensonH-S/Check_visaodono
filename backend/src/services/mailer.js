import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { cleanEnvValue, cleanSmtpHost, sanitizeMailEnvInProcess } from '../config/envSanitize.js';
import { getProjectRoot } from '../projectPaths.js';

function mailCreds() {
  sanitizeMailEnvInProcess();
  const host = cleanSmtpHost(process.env.SMTP_HOST);
  const port = Number(cleanEnvValue(process.env.SMTP_PORT) || 587);
  const secure = cleanEnvValue(process.env.SMTP_SECURE).toLowerCase() === 'true';
  const user = cleanEnvValue(process.env.SMTP_USER || process.env.EMAIL_USER);
  const pass = cleanEnvValue(process.env.SMTP_PASS || process.env.EMAIL_PASS);
  const service = cleanEnvValue(process.env.SMTP_SERVICE) || 'gmail';
  return { host, port, secure, user, pass, service };
}

export function smtpConfigurado() {
  const { user, pass } = mailCreds();
  return Boolean(user && pass);
}

function createTransporter() {
  const { host, port, secure, user, pass, service } = mailCreds();
  const transportConfig = host
    ? {
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      }
    : {
        service,
        auth: user && pass ? { user, pass } : undefined,
      };
  return { transporter: nodemailer.createTransport(transportConfig), host, service, user };
}

async function sendWithTransport(mailOptions) {
  const { transporter, host, service } = createTransporter();
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    const hostHint = host ? ` (host SMTP: ${host})` : ` (service: ${service})`;
    const msg = String(error?.message || error);
    if (/EBADNAME|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
      throw new Error(
        `Falha ao ligar ao servidor de e-mail${hostHint}. Verifique SMTP_HOST, SMTP_PORT e credenciais no .env. Detalhe: ${msg}`,
      );
    }
    throw error;
  }
}

export function getLogoAttachment() {
  const root = getProjectRoot();
  const candidates = [
    path.join(root, 'frontend', 'public', 'Logo_GA.png'),
    path.join(root, 'frontend', 'public', 'logo-grupo-alvim.png'),
    path.join(root, 'frontend', 'public', 'Grupo Alvim.png'),
    path.join(root, 'frontend', 'public', 'Logo_Alvim_Icone.png'),
  ];
  for (const logoPath of candidates) {
    if (fs.existsSync(logoPath)) {
      return {
        filename: path.basename(logoPath),
        path: logoPath,
        cid: 'grupo-alvim-logo',
      };
    }
  }
  return null;
}

function normalizeEmails(list) {
  const raw = Array.isArray(list) ? list.filter(Boolean) : list ? [list] : [];
  return [
    ...new Set(
      raw
        .map((r) => (typeof r === 'string' ? r : r?.email))
        .map((r) => String(r || '').trim())
        .filter(Boolean),
    ),
  ];
}

export async function sendMail({ to, cc, subject, html, text, attachments, replyTo }) {
  const { user } = mailCreds();
  if (!smtpConfigurado()) {
    throw new Error('Configuração SMTP ausente no ambiente (SMTP_USER/SMTP_PASS ou EMAIL_USER/EMAIL_PASS).');
  }

  const recipients = normalizeEmails(to);
  if (recipients.length === 0) {
    throw new Error('Destinatário de e-mail não informado.');
  }

  const recipientsLower = new Set(recipients.map((e) => e.toLowerCase()));
  const ccList = normalizeEmails(cc).filter((e) => !recipientsLower.has(e.toLowerCase()));

  const fromName = cleanEnvValue(process.env.MAIL_FROM_NAME) || 'MERIDIAN';
  const fromAddr = cleanEnvValue(process.env.MAIL_FROM) || `"${fromName}" <${user}>`;
  const reply =
    cleanEnvValue(replyTo || process.env.MAIL_REPLY_TO) ||
    cleanEnvValue(process.env.SUPPORT_EMAIL) ||
    user;

  const plain =
    text ||
    String(html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizedAttachments = (attachments || []).map((a) => {
    if (a?.cid && !a.contentDisposition) {
      return { ...a, contentDisposition: 'inline' };
    }
    return a;
  });

  const mailOptions = {
    from: fromAddr.includes('<') ? fromAddr : `"${fromName}" <${user}>`,
    replyTo: reply,
    subject: String(subject || '').trim() || 'MERIDIAN',
    text: plain || 'MERIDIAN - Relatorio de visita (veja o PDF em anexo).',
    html: html || undefined,
    attachments: normalizedAttachments.length ? normalizedAttachments : undefined,
    headers: {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'X-Mailer': 'MERIDIAN',
    },
  };

  if (recipients.length === 1) {
    mailOptions.to = recipients[0];
  } else {
    // Para Gmail: TO com o remetente + BCC destinatários reais
    // ajuda a não parecer "lista oculta" freestyle.
    mailOptions.to = user;
    mailOptions.bcc = recipients.join(', ');
  }

  if (ccList.length) {
    mailOptions.cc = ccList.join(', ');
  }

  await sendWithTransport(mailOptions);
  console.info(
    `[mailer] E-mail enviado para ${recipients.length} destinatário(s)` +
      (ccList.length ? ` + ${ccList.length} em CC` : '') +
      '.',
  );
  return true;
}
