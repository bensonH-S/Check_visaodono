import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { cleanEnvValue, cleanSmtpHost, sanitizeMailEnvInProcess } from '../config/envSanitize.js';
import { findBrandAsset } from '../projectPaths.js';
import { obterCredenciaisSmtpAtivas, cacheSmtpConfigurado } from './smtpConfig.js';

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
  return cacheSmtpConfigurado();
}

function createTransporter(customCreds) {
  const creds = customCreds || mailCreds();
  const host = creds.host;
  const port = Number(creds.port || 587);
  const secure = Boolean(creds.secure);
  const user = creds.usuario || creds.user;
  const pass = creds.senha || creds.pass;
  const service = creds.service;

  const transportConfig = host
    ? {
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      }
    : {
        service: service || 'gmail',
        auth: user && pass ? { user, pass } : undefined,
      };
  return { transporter: nodemailer.createTransport(transportConfig), host, service, user };
}

/** Probe SMTP (login/verify) para Status API. */
export async function verifySmtp(timeoutMs = 5000) {
  const creds = await obterCredenciaisSmtpAtivas();
  if (!creds.ativo || (!creds.usuario && !creds.user) || (!creds.senha && !creds.pass)) {
    return { ok: false, configured: false, detail: 'N/A' };
  }
  const { transporter, host, service } = createTransporter(creds);
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

async function sendWithTransport(mailOptions, creds) {
  const { transporter, host, service } = createTransporter(creds);
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    const hostHint = host ? ` (host SMTP: ${host})` : ` (service: ${service})`;
    const msg = String(error?.message || error);
    if (/EBADNAME|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
      throw new Error(
        `Falha ao ligar ao servidor de e-mail${hostHint}. Verifique o servidor SMTP, porta e credenciais. Detalhe: ${msg}`,
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
  const creds = await obterCredenciaisSmtpAtivas();
  const user = creds.usuario || creds.user;
  const pass = creds.senha || creds.pass;

  if (!creds.ativo || !user || !pass) {
    throw new Error('Configuração SMTP ausente ou inativa. Configure em Manutenção → SMTP ou defina SMTP_USER/SMTP_PASS no .env.');
  }

  const recipients = normalizeEmails(to);
  if (recipients.length === 0) {
    throw new Error('Destinatário de e-mail não informado.');
  }

  const recipientsLower = new Set(recipients.map((e) => e.toLowerCase()));
  const ccList = normalizeEmails(cc).filter((e) => !recipientsLower.has(e.toLowerCase()));

  const fromName = creds.nome_from || cleanEnvValue(process.env.MAIL_FROM_NAME) || 'MERIDIAN';
  const fromEmail = creds.email_from || cleanEnvValue(process.env.MAIL_FROM) || user;
  const fromAddr = fromEmail.includes('<') ? fromEmail : `"${fromName}" <${fromEmail}>`;

  const reply =
    cleanEnvValue(replyTo || process.env.MAIL_REPLY_TO) ||
    cleanEnvValue(process.env.SUPPORT_EMAIL) ||
    fromEmail;

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
    from: fromAddr,
    replyTo: reply,
    subject: String(subject || '').trim() || 'MERIDIAN',
    text: plain || 'MERIDIAN - Relatorio de visita.',
    html: html || undefined,
    attachments: normalizedAttachments.length ? normalizedAttachments : undefined,
    headers: {
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'X-Mailer': 'MERIDIAN',
    },
  };

  mailOptions.to = recipients.join(', ');
  if (ccList.length) {
    mailOptions.cc = ccList.join(', ');
  }

  await sendWithTransport(mailOptions, creds);
  console.info(
    `[mailer] E-mail enviado para ${recipients.length} destinatário(s)` +
      (ccList.length ? ` + ${ccList.length} em CC` : '') +
      '.',
  );
  return true;
}

/**
 * Envia um e-mail de teste para validar as configurações SMTP.
 */
export async function testarEnvioSmtp({ para, assunto, mensagem }) {
  if (!para || !para.includes('@')) {
    throw new Error('Informe um e-mail válido para envio do teste.');
  }

  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #1B2A6B 0%, #2a3d8f 100%); padding: 18px 24px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">MERIDIAN | Visão do Dono</h2>
        <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0 0; font-size: 13px;">Teste de Configuração do Servidor de E-mail (SMTP)</p>
      </div>
      <div style="padding: 8px 4px; color: #1E293B; line-height: 1.6;">
        <p style="font-size: 15px; margin: 0 0 16px 0;">Olá,</p>
        <p style="font-size: 14px; margin: 0 0 16px 0;">
          Este é um e-mail de confirmação enviado pelo sistema <strong>MERIDIAN</strong> para validar as credenciais e parâmetros do servidor <strong>SMTP</strong>.
        </p>
        <div style="background-color: #F8FAFC; border-left: 4px solid #E8520A; padding: 14px 16px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;"><strong>Status:</strong> <span style="color: #16A34A; font-weight: 600;">Conexão e envio bem-sucedidos!</span></p>
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;"><strong>Data/Hora:</strong> ${dataHora}</p>
          <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Destinatário do Teste:</strong> ${para}</p>
        </div>
        ${mensagem ? `<p style="font-size: 13px; color: #64748B; font-style: italic;">"${mensagem}"</p>` : ''}
        <p style="font-size: 13px; color: #64748B; margin-top: 24px;">
          Se você recebeu esta mensagem, as credenciais e o remetente configurados estão operando corretamente.
        </p>
      </div>
    </div>
  `;

  await sendMail({
    to: para,
    subject: assunto || 'Teste de Envio de E-mail — MERIDIAN',
    html,
  });

  return { ok: true, mensagem: `E-mail de teste enviado com sucesso para ${para}!` };
}
