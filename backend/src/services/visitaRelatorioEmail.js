import { pool } from '../db.js';
import { carregarVisitaDetalhe } from './visitaDetalhe.js';
import { gerarPdfVisitaBuffer } from './gerarPdfVisita.js';
import { sendMail, getLogoAttachment, smtpConfigurado } from './mailer.js';
import { fmtData, fmtNota, formatarHoraVisita } from '../utils/visitaFormat.js';
import {
  resolverRegionaisLoja,
  REGIONAIS_SUPERVISORES_EMAIL,
  RELATORIO_EMAIL_SEMPRE,
} from './timeCampoRegional.js';

const APP_BASE = '/auditoria';
const TIPO_NOTIF = 'relatorio_email';
const REGIONAIS_SET = new Set(REGIONAIS_SUPERVISORES_EMAIL.map((e) => e.toLowerCase()));

function publicBaseUrl() {
  const raw = String(process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (!raw) return '';
  if (raw.endsWith(APP_BASE)) return raw;
  return `${raw}${APP_BASE}`;
}

function linkRelatorio(idVisita) {
  const base = publicBaseUrl();
  return base ? `${base}/relatorio/visita/${idVisita}` : `${APP_BASE}/relatorio/visita/${idVisita}`;
}

export function emailRelatorioHabilitado() {
  if (String(process.env.VISITA_RELATORIO_EMAIL_ENABLED || 'true').toLowerCase() === 'false') {
    return false;
  }
  return smtpConfigurado();
}

function tituloChecklist(visita) {
  if (visita.tipo_checklist_codigo === 'time_de_campo') return 'Time de Campo';
  if (visita.tipo_checklist_nome) return visita.tipo_checklist_nome;
  return 'Auditoria Operacional';
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function jaEnviouRelatorio(idVisita) {
  const { rows } = await pool.query(
    `SELECT 1 FROM time_campo_notificacoes WHERE id_visita = $1 AND tipo = $2 LIMIT 1`,
    [idVisita, TIPO_NOTIF],
  );
  return rows.length > 0;
}

async function registrarEnvio({ idVisita, idLoja, idUsuario, email, metadata = {} }) {
  await pool.query(
    `INSERT INTO time_campo_notificacoes (id_visita, id_loja, tipo, id_usuario_destino, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT DO NOTHING`,
    [idVisita, idLoja, TIPO_NOTIF, idUsuario ?? null, JSON.stringify({ email, ...metadata })],
  );
}

/**
 * Destinatários do relatório:
 * - Regional da loja (só Bárbara / Fagno / Plínio, conforme região)
 * - Sempre: Igor (supervisor geral), diretor, dono (CEO), TI
 */
export async function resolverDestinatariosRelatorio(idLoja) {
  const mapa = new Map();

  const regionais = await resolverRegionaisLoja(idLoja);
  for (const r of regionais) {
    const email = String(r.email || '').trim().toLowerCase();
    if (!email || !REGIONAIS_SET.has(email)) continue;
    mapa.set(email, {
      email,
      id_usuario: r.id_usuario,
      nome: r.nome,
      papel: 'regional',
      regiao: r.nome_regiao,
    });
  }

  for (const fixo of RELATORIO_EMAIL_SEMPRE) {
    const email = String(fixo.email || '').trim().toLowerCase();
    if (!email || mapa.has(email)) continue;
    mapa.set(email, {
      email,
      id_usuario: null,
      nome: fixo.nome,
      papel: fixo.papel,
      regiao: null,
    });
  }

  return [...mapa.values()];
}

function corNotaHex(nota) {
  const n = Number(nota);
  if (Number.isNaN(n)) return '#94A3B8';
  if (n >= 85) return '#15803D';
  if (n >= 75) return '#E8520A';
  return '#B91C1C';
}

function renderHtmlEmail({ visita, dados, link, teste = false }) {
  const hora = formatarHoraVisita(visita.hora_inicio);
  const dataTxt = hora ? `${fmtData(visita.data_visita)} às ${hora}` : fmtData(visita.data_visita);
  const titulo = tituloChecklist(visita);
  const notaNum = Number(visita.nota_final);
  const nota = fmtNota(visita.nota_final);
  const ncs = dados.nao_conformidades.length;
  const catsOk = dados.desempenho_categorias.filter((c) => Number(c.percentual) >= 80).length;
  const loja = escHtml(visita.name);
  const bkn = visita.bk_number ? ` · BKN ${escHtml(visita.bk_number)}` : '';
  const auditor = escHtml(visita.nome_usuario);

  const catsRows = dados.desempenho_categorias
    .slice(0, 8)
    .map((c) => {
      const pct = Number(c.percentual) || 0;
      const cor = pct >= 80 ? '#15803D' : pct >= 60 ? '#E8520A' : '#1B2A6B';
      return `
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#334155;width:40%;">${escHtml(c.categoria)}</td>
          <td style="padding:6px 8px;width:45%;">
            <div style="background:#E2E8F0;border-radius:4px;height:8px;overflow:hidden;">
              <div style="background:${cor};width:${Math.min(100, pct)}%;height:8px;border-radius:4px;"></div>
            </div>
          </td>
          <td style="padding:6px 0;font-size:12px;font-weight:700;color:${cor};text-align:right;width:15%;">${pct}%</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MERIDIAN — Relatório de Visita</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F1F5F9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <!-- Header marca: logo em fundo claro (navy da marca some no navy) -->
          <tr>
            <td style="background:#ffffff;padding:22px 28px 16px;text-align:center;border-bottom:1px solid #E2E8F0;">
              <img src="cid:grupo-alvim-logo" alt="Grupo Alvim" width="200" style="display:block;margin:0 auto;max-width:200px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:#0B1A3B;padding:16px 28px;text-align:center;">
              <div style="color:#A0B0C8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">MERIDIAN</div>
              <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:4px;">Relatório de Visita</div>
              ${
                teste
                  ? '<div style="margin-top:10px;display:inline-block;background:#E8520A;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;">ENVIO DE TESTE</div>'
                  : ''
              }
            </td>
          </tr>
          <tr><td style="height:4px;background:#E8520A;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Corpo -->
          <tr>
            <td style="padding:24px 28px;">
              <!-- Aviso anexo -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#FFF7ED;border:1px solid #FDBA74;border-left:4px solid #E8520A;border-radius:8px;padding:14px 16px;">
                    <div style="font-size:13px;font-weight:800;color:#9A3412;margin-bottom:4px;">📎 Relatório em anexo</div>
                    <div style="font-size:13px;color:#9A3412;line-height:1.45;">
                      O <strong>relatório completo em PDF</strong> desta visita está anexado a este e-mail
                      (respostas, evidências fotográficas e não conformidades).
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:11px;color:#94A3B8;letter-spacing:1px;font-weight:700;">${escHtml(titulo.toUpperCase())}</p>
              <h1 style="margin:0 0 6px;font-size:22px;color:#0B1A3B;line-height:1.25;">${loja}${bkn}</h1>
              <p style="margin:0 0 20px;font-size:13px;color:#64748B;">Auditor: <strong style="color:#334155;">${auditor}</strong> · ${escHtml(dataTxt)} · Visita #${visita.id_visita}</p>

              <!-- Cards -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">
                <tr>
                  <td width="32%" style="background:#0B1A3B;border-radius:8px;padding:14px 12px;text-align:center;vertical-align:top;">
                    <div style="font-size:10px;color:#A0B0C8;letter-spacing:0.5px;font-weight:700;">NOTA FINAL</div>
                    <div style="font-size:28px;font-weight:800;color:${corNotaHex(notaNum)};margin-top:4px;">${escHtml(nota)}</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 12px;text-align:center;vertical-align:top;">
                    <div style="font-size:10px;color:#94A3B8;letter-spacing:0.5px;font-weight:700;">CATEGORIAS</div>
                    <div style="font-size:22px;font-weight:800;color:#0B1A3B;margin-top:4px;">${dados.desempenho_categorias.length}</div>
                    <div style="font-size:11px;color:#64748B;margin-top:2px;">${catsOk} ≥ 80%</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 12px;text-align:center;vertical-align:top;">
                    <div style="font-size:10px;color:#94A3B8;letter-spacing:0.5px;font-weight:700;">NCs</div>
                    <div style="font-size:22px;font-weight:800;color:${ncs ? '#B91C1C' : '#15803D'};margin-top:4px;">${ncs}</div>
                    <div style="font-size:11px;color:#64748B;margin-top:2px;">${ncs ? 'pendências' : 'nenhuma'}</div>
                  </td>
                </tr>
              </table>

              ${
                catsRows
                  ? `<div style="margin-bottom:22px;">
                      <div style="font-size:12px;font-weight:800;color:#0B1A3B;margin-bottom:8px;letter-spacing:0.3px;">DESEMPENHO POR CATEGORIA</div>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${catsRows}</table>
                    </div>`
                  : ''
              }

              <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.5;">
                Baixe o arquivo PDF anexado para ver o relatório completo, ou abra a versão online no MERIDIAN:
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:#E8520A;border-radius:8px;">
                    <a href="${escHtml(link)}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">
                      Abrir relatório no MERIDIAN
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 28px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94A3B8;line-height:1.5;">
                <span style="color:#1B2A6B;font-weight:700;">grupo</span><span style="color:#E8520A;font-weight:700;">alvim</span>
                · MERIDIAN — e-mail automático. Não responda a esta mensagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderTextEmail({ visita, dados, link, teste = false }) {
  const hora = formatarHoraVisita(visita.hora_inicio);
  const dataTxt = hora ? `${fmtData(visita.data_visita)} às ${hora}` : fmtData(visita.data_visita);
  const titulo = tituloChecklist(visita);
  const nota = fmtNota(visita.nota_final);
  const ncs = dados.nao_conformidades.length;
  return [
    teste ? 'ENVIO DE TESTE' : null,
    'MERIDIAN - Grupo Alvim',
    'Relatorio de visita',
    '',
    '>>> O RELATORIO COMPLETO EM PDF ESTA EM ANEXO NESTE E-MAIL <<<',
    '',
    titulo,
    `Loja: ${visita.name}${visita.bk_number ? ` (BKN ${visita.bk_number})` : ''}`,
    `Auditor: ${visita.nome_usuario}`,
    `Data: ${dataTxt}`,
    `Visita: #${visita.id_visita}`,
    `Nota final: ${nota}`,
    `Respostas: ${dados.respostas.length}`,
    `Nao conformidades: ${ncs}`,
    '',
    'Baixe o PDF anexo para ver respostas, evidencias e NCs.',
    `Abrir no MERIDIAN: ${link}`,
    '',
    'Este e um e-mail automatico. Nao responda esta mensagem.',
  ]
    .filter((l) => l != null)
    .join('\n');
}

function nomeArquivoPdf(visita) {
  const dataArq = fmtData(visita.data_visita).replace(/\//g, '-');
  const bkn = visita.bk_number || 'loja';
  return `relatorio-visita-${visita.id_visita}-${bkn}-${dataArq}.pdf`;
}

async function montarEnvio(dados, { to, teste = false, registrar = true } = {}) {
  const v = dados.visita;
  const pdfBuffer = await gerarPdfVisitaBuffer(dados);
  const link = linkRelatorio(v.id_visita);
  const titulo = tituloChecklist(v);
  const subject = `MERIDIAN - ${titulo} - ${v.name} (${fmtNota(v.nota_final)})`;

  const logo = getLogoAttachment();
  const attachments = [
    {
      filename: nomeArquivoPdf(v),
      content: pdfBuffer,
      contentType: 'application/pdf',
      contentDisposition: 'attachment',
    },
  ];
  if (logo) {
    attachments.push({
      ...logo,
      contentDisposition: 'inline',
      contentType: 'image/png',
    });
  }

  await sendMail({
    to,
    subject,
    text: renderTextEmail({ visita: v, dados, link, teste }),
    html: renderHtmlEmail({ visita: v, dados, link, teste }),
    attachments,
  });

  if (registrar) {
    for (const d of to) {
      const email = typeof d === 'string' ? d : d.email;
      const idUsuario = typeof d === 'string' ? null : d.id_usuario;
      const metadata = typeof d === 'string' ? {} : { papel: d.papel, regiao: d.regiao };
      await registrarEnvio({
        idVisita: v.id_visita,
        idLoja: v.id_loja,
        idUsuario,
        email,
        metadata,
      });
    }
  }

  return {
    enviado: true,
    destinatarios: (Array.isArray(to) ? to : [to]).map((d) =>
      typeof d === 'string' ? d : { email: d.email, papel: d.papel },
    ),
  };
}

/** Envia relatório PDF por e-mail ao finalizar visita. */
export async function processarEnvioRelatorioVisita(idVisita) {
  if (!emailRelatorioHabilitado()) {
    return { ignorado: true, motivo: 'smtp_desabilitado' };
  }

  const dados = await carregarVisitaDetalhe(idVisita);
  if (!dados?.visita) return { ignorado: true, motivo: 'visita_nao_encontrada' };
  if (dados.visita.status !== 'Finalizada') return { ignorado: true, motivo: 'nao_finalizada' };

  if (await jaEnviouRelatorio(idVisita)) {
    return { ignorado: true, motivo: 'ja_enviado' };
  }

  const destinatarios = await resolverDestinatariosRelatorio(dados.visita.id_loja);
  if (!destinatarios.length) {
    console.warn('[visita-email] Sem destinatários para loja', dados.visita.id_loja);
    return { ignorado: true, motivo: 'sem_destinatarios' };
  }

  const result = await montarEnvio(dados, { to: destinatarios, registrar: true });
  console.info(
    `[visita-email] Relatório visita #${dados.visita.id_visita} enviado para ${destinatarios.length} destinatário(s)`,
  );
  return result;
}

/**
 * Envio de teste (não marca como enviado).
 * @param {number} idVisita
 * @param {string|string[]} destinos
 */
export async function enviarRelatorioVisitaTeste(idVisita, destinos) {
  if (!smtpConfigurado()) {
    throw new Error('SMTP não configurado no .env');
  }
  const dados = await carregarVisitaDetalhe(idVisita);
  if (!dados?.visita) throw new Error(`Visita #${idVisita} não encontrada`);

  const to = Array.isArray(destinos) ? destinos : [destinos];
  return montarEnvio(dados, { to, teste: true, registrar: false });
}
