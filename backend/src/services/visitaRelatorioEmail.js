import { pool } from '../db.js';
import { carregarVisitaDetalhe } from './visitaDetalhe.js';
import { gerarPdfVisitaBuffer } from './gerarPdfVisita.js';
import { sendMail, getBrandEmailAttachments, smtpConfigurado } from './mailer.js';
import { fmtData, fmtNota, formatarHoraVisita } from '../utils/visitaFormat.js';
import {
  resolverRegionaisLoja,
  resolverGerentesLoja,
  REGIONAIS_SUPERVISORES_EMAIL,
  RELATORIO_EMAIL_SEMPRE,
  RELATORIO_EMAIL_CC,
} from './timeCampoRegional.js';

const TIPO_NOTIF = 'relatorio_email';
const REGIONAIS_SET = new Set(REGIONAIS_SUPERVISORES_EMAIL.map((e) => e.toLowerCase()));

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

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function bodyToHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;line-height:1.5">${escHtml(p).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('');
}

async function jaEnviouRelatorio(idVisita) {
  const { rows } = await pool.query(
    `SELECT 1 FROM time_campo_notificacoes WHERE id_visita = $1 AND tipo = $2 LIMIT 1`,
    [idVisita, TIPO_NOTIF],
  );
  return rows.length > 0;
}

/** Limpa marca de envio (ex.: ao reabrir visita) para permitir reenvio na próxima finalização. */
export async function limparEnvioRelatorioVisita(idVisita, client = pool) {
  await client.query(
    `DELETE FROM time_campo_notificacoes WHERE id_visita = $1 AND tipo = $2`,
    [idVisita, TIPO_NOTIF],
  );
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
 * Destinatários do relatório de Auditoria Operacional:
 * - To: gestor/gerente da unidade (só da loja)
 * - Cc: regional da loja (só da região) + liderança fixa (Felipe, Renato, Igor, Benson — todas as lojas)
 * - Sem gerente: liderança fixa no To
 */
export async function resolverDestinatariosRelatorio(idLoja) {
  const toMap = new Map();
  const ccMap = new Map();

  const add = (mapa, entry) => {
    const email = normalizeEmail(entry.email);
    if (!email) return;
    if (toMap.has(email) || ccMap.has(email) || mapa.has(email)) return;
    mapa.set(email, { ...entry, email });
  };

  const gerentes = await resolverGerentesLoja(idLoja);
  for (const g of gerentes) {
    add(toMap, {
      email: g.email,
      id_usuario: g.id_usuario,
      nome: g.nome,
      papel: 'gerente',
      regiao: null,
    });
  }

  const regionais = await resolverRegionaisLoja(idLoja);
  for (const r of regionais) {
    const email = normalizeEmail(r.email);
    if (!email || !REGIONAIS_SET.has(email)) continue;
    add(ccMap, {
      email,
      id_usuario: r.id_usuario,
      nome: r.nome,
      papel: 'regional',
      regiao: r.nome_regiao,
    });
  }

  const liderancaMap = toMap.size === 0 ? toMap : ccMap;
  for (const fixo of RELATORIO_EMAIL_SEMPRE) {
    add(liderancaMap, {
      email: fixo.email,
      id_usuario: null,
      nome: fixo.nome,
      papel: fixo.papel,
      regiao: null,
    });
  }

  for (const emailTi of RELATORIO_EMAIL_CC) {
    add(ccMap, {
      email: emailTi,
      id_usuario: null,
      nome: 'TI',
      papel: 'ti',
      regiao: null,
    });
  }

  return {
    to: [...toMap.values()],
    cc: [...ccMap.values()],
  };
}

function ehAuditoriaOperacional(visita) {
  const codigo = String(visita?.tipo_checklist_codigo || '').trim();
  // Visitas antigas sem tipo = operacional
  return !codigo || codigo === 'auditoria_operacional';
}

function corNotaHex(nota) {
  const n = Number(nota);
  if (Number.isNaN(n)) return '#94A3B8';
  if (n >= 85) return '#15803D';
  if (n >= 75) return '#E8520A';
  return '#B91C1C';
}

function montarAssunto({ titulo, loja, dataTxt, teste = false }) {
  const base = `${titulo} — ${loja} — ${dataTxt}`;
  return teste ? `[TESTE] ${base}` : base;
}

function montarCorpoTexto({ visita, dados, teste = false }) {
  const titulo = tituloChecklist(visita);
  const hora = formatarHoraVisita(visita.hora_inicio);
  const dataTxt = hora ? `${fmtData(visita.data_visita)} às ${hora}` : fmtData(visita.data_visita);
  const nota = fmtNota(visita.nota_final);
  const ncs = dados.nao_conformidades.length;
  const loja = visita.name;

  return [
    teste ? 'ENVIO DE TESTE — ignore se não solicitou.' : null,
    'Olá,',
    '',
    `Segue o relatório de ${titulo} da loja ${loja} referente à visita de ${dataTxt}.`,
    '',
    `Auditor: ${visita.nome_usuario}`,
    `Nota final: ${nota}`,
    `Não conformidades: ${ncs}`,
    '',
    'Obrigado,',
    'MERIDIAN — Grupo Alvim',
  ]
    .filter((l) => l != null)
    .join('\n');
}

/** HTML no padrão FreeControl (navy + laranja, wordmark, KPIs, corpo). */
function renderHtmlEmail({ visita, dados, bodyText, teste = false }) {
  const hora = formatarHoraVisita(visita.hora_inicio);
  const dataTxt = hora ? `${fmtData(visita.data_visita)} às ${hora}` : fmtData(visita.data_visita);
  const titulo = tituloChecklist(visita);
  const notaNum = Number(visita.nota_final);
  const nota = fmtNota(visita.nota_final);
  const ncs = dados.nao_conformidades.length;
  const catsOk = dados.desempenho_categorias.filter((c) => Number(c.percentual) >= 80).length;
  const loja = escHtml(visita.name);

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
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0b1a3b">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px">
    <div style="background:#0b1a3b;border-bottom:3px solid #e8520a;padding:18px 20px;border-radius:8px 8px 0 0">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:12px">
        <tr>
          <td style="vertical-align:middle;width:52%">
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr>
                <td style="vertical-align:middle;padding-right:10px">
                  <img src="cid:grupo-alvim-logo" alt="Grupo Alvim" width="44" height="44" style="display:block;width:44px;height:44px;object-fit:contain;border:0;outline:none" />
                </td>
                <td style="vertical-align:middle">
                  <div style="font-size:20px;font-weight:800;letter-spacing:0.01em;line-height:1">
                    <span style="color:#c5d0e0">grupo</span><span style="color:#e8520a">alvim</span>
                  </div>
                  <div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:0.08em;margin-top:4px;text-transform:uppercase">MERIDIAN</div>
                </td>
              </tr>
            </table>
          </td>
          <td style="vertical-align:middle;text-align:right;width:48%">
            <img src="cid:ciga-logo" alt="CIGA — Centro de Inteligência Grupo Alvim" width="210" height="52" style="display:inline-block;max-width:210px;width:210px;height:auto;object-fit:contain;border:0;outline:none" />
          </td>
        </tr>
      </table>
      ${
        teste
          ? '<div style="display:inline-block;background:#e8520a;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:8px">ENVIO DE TESTE</div>'
          : ''
      }
      <div style="color:#fff;font-size:18px;font-weight:800;margin-top:4px">${escHtml(titulo)}</div>
      <div style="color:#e8520a;font-size:12px;font-weight:700;margin-top:2px">${loja} · ${escHtml(dataTxt)}</div>
    </div>
    <div style="background:#fff;padding:20px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <div style="flex:1;min-width:100px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;background:#0b1a3b;color:#fff">
          <div style="font-size:10px;color:#a0b0c8;font-weight:700;text-transform:uppercase">Nota final</div>
          <div style="font-size:20px;font-weight:800;color:${corNotaHex(notaNum)}">${escHtml(nota)}</div>
        </div>
        <div style="flex:1;min-width:100px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">Categorias</div>
          <div style="font-size:16px;font-weight:800">${dados.desempenho_categorias.length}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${catsOk} ≥ 80%</div>
        </div>
        <div style="flex:1;min-width:100px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">NCs</div>
          <div style="font-size:16px;font-weight:800;color:${ncs ? '#c2410c' : '#0b1a3b'}">${ncs}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${ncs ? 'pendências' : 'nenhuma'}</div>
        </div>
        <div style="flex:1;min-width:100px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">Auditor</div>
          <div style="font-size:13px;font-weight:800">${escHtml(visita.nome_usuario)}</div>
        </div>
      </div>

      ${
        catsRows
          ? `<div style="margin:0 0 16px">
              <div style="font-size:11px;font-weight:800;color:#0b1a3b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Desempenho por categoria</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${catsRows}</table>
            </div>`
          : ''
      }

      ${bodyToHtml(bodyText)}
    </div>
  </div>
</body></html>`;
}

function nomeArquivoPdf(visita) {
  const dataArq = fmtData(visita.data_visita).replace(/\//g, '-');
  const bkn = visita.bk_number || 'loja';
  return `relatorio-visita-${visita.id_visita}-${bkn}-${dataArq}.pdf`;
}

function emailsDeLista(list) {
  const raw = Array.isArray(list) ? list : list ? [list] : [];
  return raw
    .map((d) => (typeof d === 'string' ? d : d?.email))
    .map((e) => String(e || '').trim())
    .filter(Boolean);
}

async function montarEnvio(dados, { to, cc = [], teste = false, registrar = true } = {}) {
  const v = dados.visita;
  const pdfBuffer = await gerarPdfVisitaBuffer(dados);
  const titulo = tituloChecklist(v);
  const hora = formatarHoraVisita(v.hora_inicio);
  const dataTxt = hora ? `${fmtData(v.data_visita)} às ${hora}` : fmtData(v.data_visita);
  const subject = montarAssunto({ titulo, loja: v.name, dataTxt, teste });
  const bodyText = montarCorpoTexto({ visita: v, dados, teste });

  const brands = getBrandEmailAttachments();
  const attachments = [
    {
      filename: nomeArquivoPdf(v),
      content: pdfBuffer,
      contentType: 'application/pdf',
      contentDisposition: 'attachment',
    },
    ...brands,
  ];

  const toList = Array.isArray(to) ? to.filter(Boolean) : to ? [to] : [];
  const ccList = Array.isArray(cc) ? cc.filter(Boolean) : cc ? [cc] : [];
  if (!toList.length) {
    throw new Error('Sem destinatários To para o relatório de visita');
  }

  await sendMail({
    to: toList,
    cc: ccList,
    subject,
    text: bodyText,
    html: renderHtmlEmail({ visita: v, dados, bodyText, teste }),
    attachments,
  });

  if (registrar) {
    const ccEmails = emailsDeLista(ccList);
    for (const d of [...toList, ...ccList]) {
      const email = typeof d === 'string' ? d : d.email;
      const idUsuario = typeof d === 'string' ? null : d.id_usuario;
      const metadata =
        typeof d === 'string'
          ? { destino: 'cc_or_to' }
          : { papel: d.papel, regiao: d.regiao, destino: toList.includes(d) ? 'to' : 'cc' };
      await registrarEnvio({
        idVisita: v.id_visita,
        idLoja: v.id_loja,
        idUsuario,
        email,
        metadata: { ...metadata, cc: ccEmails },
      });
    }
  }

  return {
    enviado: true,
    subject,
    destinatarios: toList.map((d) =>
      typeof d === 'string' ? d : { email: d.email, papel: d.papel },
    ),
    cc: ccList.map((d) => (typeof d === 'string' ? d : { email: d.email, papel: d.papel })),
  };
}

/** Envia relatório PDF por e-mail ao finalizar visita (somente Auditoria Operacional). */
export async function processarEnvioRelatorioVisita(idVisita, { force = false } = {}) {
  if (!emailRelatorioHabilitado()) {
    return { ignorado: true, motivo: 'smtp_desabilitado' };
  }

  const dados = await carregarVisitaDetalhe(idVisita);
  if (!dados?.visita) return { ignorado: true, motivo: 'visita_nao_encontrada' };
  if (dados.visita.status !== 'Finalizada') return { ignorado: true, motivo: 'nao_finalizada' };
  if (!ehAuditoriaOperacional(dados.visita)) {
    return { ignorado: true, motivo: 'somente_auditoria_operacional' };
  }

  if (!force && (await jaEnviouRelatorio(idVisita))) {
    return { ignorado: true, motivo: 'ja_enviado' };
  }
  if (force) {
    await limparEnvioRelatorioVisita(idVisita);
  }

  const { to, cc } = await resolverDestinatariosRelatorio(dados.visita.id_loja);
  if (!to.length) {
    console.warn('[visita-email] Sem destinatários para loja', dados.visita.id_loja);
    return { ignorado: true, motivo: 'sem_destinatarios' };
  }

  const result = await montarEnvio(dados, { to, cc, registrar: true });
  console.info(
    `[visita-email] Relatório visita #${dados.visita.id_visita} enviado To=${to.length} Cc=${cc.length} assunto="${result.subject}"`,
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
  return montarEnvio(dados, { to, cc: [], teste: true, registrar: false });
}
