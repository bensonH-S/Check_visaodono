import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { cleanEnvValue, cleanSmtpHost, sanitizeMailEnvInProcess } from '../config/envSanitize.js';
import { findBrandAsset } from '../projectPaths.js';

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

/** Probe SMTP (login/verify) para Status API. */
export async function verifySmtp(timeoutMs = 5000) {
  if (!smtpConfigurado()) {
    return { ok: false, configured: false, detail: 'N/A' };
  }
  const { transporter, host, service } = createTransporter();
  const verifyPromise = transporter.verify();
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout SMTP')), timeoutMs);
  });
  try {
    await Promise.race([verifyPromise, timeout]);
    return {
      ok: true,
      configured: true,
      detail: host ? `SMTP OK (${host})` : `SMTP OK (${service})`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, configured: true, detail: msg.slice(0, 120) };
  }
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

function firstExistingAttachment(candidates, cid) {
  for (const logoPath of candidates) {
    if (fs.existsSync(logoPath)) {
      return {
        filename: path.basename(logoPath),
        path: logoPath,
        cid,
        contentDisposition: 'inline',
        contentType: 'image/png',
      };
    }
  }
  return null;
}

function attachmentFromNames(names, cid) {
  const logoPath = findBrandAsset(...names);
  return logoPath ? firstExistingAttachment([logoPath], cid) : null;
}

/** Ícone GA nítido (sem wordmark embutido) — legível em header navy; texto no HTML. */
export function getLogoAttachment() {
  return attachmentFromNames(
    ['Logo_Alvim_Icone.png', 'Logo_Icon-clear.png', 'Logo_GA.png', 'logo-grupo-alvim.png'],
    'grupo-alvim-logo',
  );
}

/** Logo CIGA (Centro de Inteligência Grupo Alvim) para e-mails/relatórios. */
export function getCigaAttachment() {
  return attachmentFromNames(['CIGA.png', 'CIGA_email.png'], 'ciga-logo');
}

/** Anexos de marca para e-mail (GA + CIGA). */
export function getBrandEmailAttachments() {
  const brands = [getLogoAttachment(), getCigaAttachment()].filter(Boolean);
  if (brands.length < 2) {
    console.warn(
      `[mailer] Logo de e-mail ausente (${brands.length}/2). No Docker os PNG precisam estar em frontend/dist ou frontend/public.`,
    );
  }
  return brands;
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

  // Mesmo padrão FreeControl: To / Cc explícitos (sem BCC oculto).
  mailOptions.to = recipients.join(', ');
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
