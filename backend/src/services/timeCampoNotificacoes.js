import { pool } from '../db.js';
import { NOTA_MINIMA_NC } from '../naoConformidadesChecklist.js';
import { DIAS_SEMANA, formatarDataBr } from '../escalaVisitas.js';
import { enviarWhatsAppParaUsuario } from './whatsappNotificacoes.js';
import { wppEnabled } from './wppClient.js';
import {
  resolverSupervisorRegionalLoja,
  proximaVisitaEscalaLoja,
  visitasEscalaHojeComPendencias,
  carregarCeoEDiretor,
} from './timeCampoRegional.js';

const APP_BASE = '/auditoria';
const INTERVALO_MS = 15 * 60 * 1000;
const TZ = 'America/Sao_Paulo';
/** Checklist que dispara o fluxo regional (Auditoria Operacional na UI). */
const CHECKLIST_CODIGO = 'auditoria_operacional';

let timer = null;

function publicBaseUrl() {
  const raw = String(process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (!raw) return '';
  if (raw.endsWith(APP_BASE)) return raw;
  return `${raw}${APP_BASE}`;
}

function linkNcMobile() {
  const base = publicBaseUrl();
  return base ? `${base}/nc/mobile` : `${APP_BASE}/nc/mobile`;
}

function horaSp() {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

function dataHojeSp() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

async function jaEnviou(idVisita, tipo, idUsuario) {
  const { rows } = await pool.query(
    `SELECT 1 FROM time_campo_notificacoes
     WHERE id_visita = $1 AND tipo = $2 AND id_usuario_destino IS NOT DISTINCT FROM $3`,
    [idVisita, tipo, idUsuario ?? null],
  );
  return rows.length > 0;
}

async function registrarEnvio({ idVisita, idLoja, tipo, idUsuario, metadata = {} }) {
  await pool.query(
    `INSERT INTO time_campo_notificacoes (id_visita, id_loja, tipo, id_usuario_destino, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT DO NOTHING`,
    [idVisita, idLoja, tipo, idUsuario ?? null, JSON.stringify(metadata)],
  );
}

async function carregarVisitaTimeCampo(idVisita) {
  const { rows } = await pool.query(
    `SELECT v.id_visita, v.id_loja, v.id_usuario, v.nota_final, v.data_visita,
            l.name AS nome_loja, l.bk_number,
            ua.nome AS nome_auditor,
            tc.codigo AS tipo_codigo
     FROM visitas v
     JOIN lojas l ON l.id_loja = v.id_loja
     JOIN usuarios ua ON ua.id_usuario = v.id_usuario
     LEFT JOIN tipos_checklist tc ON tc.id_tipo_checklist = v.id_tipo_checklist
     WHERE v.id_visita = $1 AND v.status = 'Finalizada'`,
    [idVisita],
  );
  return rows[0] || null;
}

async function contagemNcs(idVisita) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'Em aberto')::int AS abertas,
       COUNT(*)::int AS total
     FROM nao_conformidades WHERE id_visita = $1`,
    [idVisita],
  );
  return rows[0] || { abertas: 0, total: 0 };
}

function rotuloLoja(loja) {
  const bk = loja.bk_number ? `BK ${String(loja.bk_number).trim()} — ` : '';
  return `${bk}${loja.nome_loja || loja.name || 'Loja'}`;
}

function diasAteData(dataIso, referencia = new Date()) {
  const alvo = String(dataIso).slice(0, 10);
  const hoje = referencia.toLocaleDateString('en-CA', { timeZone: TZ });
  const t0 = new Date(`${hoje}T12:00:00`).getTime();
  const t1 = new Date(`${alvo}T12:00:00`).getTime();
  return Math.round((t1 - t0) / (24 * 60 * 60 * 1000));
}

function montarMsgReprovacaoRegional({
  nomeRegional,
  loja,
  auditor,
  dataAuditoria,
  nota,
  proximaVisita,
}) {
  const linhas = [
    '🔔 *Vision Check — Auditoria Operacional*',
    '',
    `REGIONAL *${nomeRegional?.toUpperCase() || 'REGIONAL'}*, a unidade *${loja}* recebeu auditoria de *${auditor}* em *${dataAuditoria}* e foi *REPROVADA* (${nota}%).`,
    '',
  ];

  if (proximaVisita) {
    const diaNome = DIAS_SEMANA[proximaVisita.dia] || '';
    const dias = proximaVisita.diasRestantes ?? 0;
    if (dias <= 0) {
      linhas.push(
        `Você tem visita agendada nesta unidade *hoje* (${diaNome}).`,
        'Priorize as pendências críticas antes ou durante a visita.',
        '',
      );
    } else if (dias === 1) {
      linhas.push(
        `Você tem visita agendada nesta unidade *amanhã* (${proximaVisita.dataLabel}, ${diaNome}).`,
        'Oriente a loja e priorize o que for possível resolver antes da visita.',
        '',
      );
    } else {
      linhas.push(
        `Sua escala tem visita agendada para esta unidade em *${proximaVisita.dataLabel}* (${diaNome}).`,
        'Por gentileza, acompanhe a resolução das pendências em aberto antes da visita.',
        '',
      );
    }
  } else {
    linhas.push(
      'Esta unidade está sob sua supervisão e possui pendências em aberto.',
      'Por gentileza, oriente a loja a resolver o quanto antes.',
      '',
    );
  }

  linhas.push(`👉 Pendências: ${linkNcMobile()}`);
  return linhas.join('\n');
}

function montarMsgLembreteDiaVisita({ nomeRegional, loja, dataAuditoria, nota }) {
  return [
    '🔔 *Vision Check — Lembrete de visita*',
    '',
    `REGIONAL *${nomeRegional?.toUpperCase() || 'REGIONAL'}*, hoje é o dia da sua visita à unidade *${loja}*.`,
    '',
    `Esta loja foi reprovada na auditoria de *${dataAuditoria}* (${nota}%) e ainda possui pendências em aberto.`,
    '',
    `👉 Resolver agora: ${linkNcMobile()}`,
  ].join('\n');
}

function montarMsgStatusLideranca({ resolvido, loja, auditor, dataAuditoria, nota, dataVisitaEscala }) {
  const status = resolvido
    ? '✅ *Pendências resolvidas*'
    : '⚠️ *Pendências NÃO resolvidas*';
  const linhas = [
    '🔔 *Vision Check — Auditoria Operacional*',
    status,
    '',
    `Unidade: *${loja}*`,
    `Auditoria: *${auditor}* em *${dataAuditoria}* — nota *${nota}%*`,
  ];
  if (dataVisitaEscala) {
    linhas.push(`Visita regional na escala: *${dataVisitaEscala}*`);
  }
  if (!resolvido) {
    linhas.push('', `👉 Acompanhar: ${linkNcMobile()}`);
  }
  return linhas.join('\n');
}

async function enviarSePossivel(idUsuario, mensagem) {
  if (!wppEnabled()) return false;
  try {
    return await enviarWhatsAppParaUsuario(idUsuario, mensagem);
  } catch (e) {
    console.error('[time-campo-wpp]', e.message);
    return false;
  }
}

/** Disparado ao finalizar visita auditoria_operacional reprovada (< 80%). */
export async function processarVisitaTimeCampoReprovada(idVisita) {
  const visita = await carregarVisitaTimeCampo(idVisita);
  if (!visita || visita.tipo_codigo !== CHECKLIST_CODIGO) return { ignorado: true };

  const nota = visita.nota_final != null ? Number(visita.nota_final) : null;
  if (nota == null || Number.isNaN(nota) || nota >= NOTA_MINIMA_NC) {
    return { ignorado: true, motivo: 'nota_ok' };
  }

  const ncs = await contagemNcs(idVisita);
  if (ncs.total === 0) return { ignorado: true, motivo: 'sem_nc' };

  const supervisor = await resolverSupervisorRegionalLoja(visita.id_loja);
  if (!supervisor?.id_usuario) {
    console.warn('[time-campo] Sem supervisor regional para loja', visita.id_loja);
    return { ignorado: true, motivo: 'sem_supervisor' };
  }

  if (await jaEnviou(idVisita, 'reprovacao_regional', supervisor.id_usuario)) {
    return { ignorado: true, motivo: 'ja_enviado' };
  }

  const proxima = await proximaVisitaEscalaLoja(visita.id_loja, new Date(), supervisor.id_usuario);
  const proximaFmt = proxima
    ? {
        dia: proxima.dia,
        dataLabel: formatarDataBr(String(proxima.data_visita).slice(0, 10)),
        diasRestantes: diasAteData(proxima.data_visita),
      }
    : null;

  const mensagem = montarMsgReprovacaoRegional({
    nomeRegional: supervisor.grupo_nome || supervisor.nome,
    loja: rotuloLoja(visita),
    auditor: visita.nome_auditor,
    dataAuditoria: formatarDataBr(String(visita.data_visita).slice(0, 10)),
    nota: Math.round(nota),
    proximaVisita: proximaFmt,
  });

  const ok = await enviarSePossivel(supervisor.id_usuario, mensagem);
  if (ok) {
    await registrarEnvio({
      idVisita,
      idLoja: visita.id_loja,
      tipo: 'reprovacao_regional',
      idUsuario: supervisor.id_usuario,
      metadata: { nota, id_proxima_visita_escala: proxima?.id_celula ?? null },
    });
  }
  return { enviado: ok, destino: supervisor.nome };
}

/** Ao resolver NC: se todas da visita foram resolvidas, avisa CEO e Diretor. */
export async function processarNcsVisitaResolvidas(idVisita) {
  const visita = await carregarVisitaTimeCampo(idVisita);
  if (!visita || visita.tipo_codigo !== CHECKLIST_CODIGO) return;

  const nota = Number(visita.nota_final);
  if (Number.isNaN(nota) || nota >= NOTA_MINIMA_NC) return;

  const ncs = await contagemNcs(idVisita);
  if (ncs.total === 0 || ncs.abertas > 0) return;

  const lideres = await carregarCeoEDiretor();
  const proxima = await proximaVisitaEscalaLoja(visita.id_loja);
  const dataEscala = proxima
    ? formatarDataBr(String(proxima.data_visita).slice(0, 10))
    : null;

  for (const lider of lideres) {
    if (await jaEnviou(idVisita, 'pendencias_resolvidas', lider.id_usuario)) continue;

    const mensagem = montarMsgStatusLideranca({
      resolvido: true,
      loja: rotuloLoja(visita),
      auditor: visita.nome_auditor,
      dataAuditoria: formatarDataBr(String(visita.data_visita).slice(0, 10)),
      nota: Math.round(nota),
      dataVisitaEscala: dataEscala,
    });

    const ok = await enviarSePossivel(lider.id_usuario, mensagem);
    if (ok) {
      await registrarEnvio({
        idVisita,
        idLoja: visita.id_loja,
        tipo: 'pendencias_resolvidas',
        idUsuario: lider.id_usuario,
        metadata: { antecipado: true },
      });
    }
  }
}

/** Job periódico: lembrete no dia da visita + status ao fim do dia para liderança. */
export async function processarAgendaTimeCampo() {
  if (!wppEnabled()) return;

  const hora = horaSp();
  const itens = await visitasEscalaHojeComPendencias();

  for (const item of itens) {
    const idVisita = item.id_visita;
    const lojaLabel = rotuloLoja(item);
    const dataAuditoria = formatarDataBr(String(item.data_auditoria).slice(0, 10));
    const nota = Math.round(Number(item.nota_final));

    const destinoRegional = item.id_regional;
    if (destinoRegional && hora >= 7 && hora < 12) {
      if (!(await jaEnviou(idVisita, 'lembrete_dia_visita', destinoRegional))) {
        const { rows: reg } = await pool.query(
          'SELECT nome FROM usuarios WHERE id_usuario = $1',
          [destinoRegional],
        );
        const mensagem = montarMsgLembreteDiaVisita({
          nomeRegional: reg[0]?.nome || item.nome_regional_escala,
          loja: lojaLabel,
          dataAuditoria,
          nota,
        });
        const ok = await enviarSePossivel(destinoRegional, mensagem);
        if (ok) {
          await registrarEnvio({
            idVisita,
            idLoja: item.id_loja,
            tipo: 'lembrete_dia_visita',
            idUsuario: destinoRegional,
          });
        }
      }
    }

    if (hora >= 17) {
      const ncs = await contagemNcs(idVisita);
      const resolvido = ncs.abertas === 0;
      const tipoStatus = resolvido ? 'status_resolvido_visita' : 'status_pendente_visita';
      const lideres = await carregarCeoEDiretor();
      const dataEscala = formatarDataBr(dataHojeSp());

      for (const lider of lideres) {
        if (await jaEnviou(idVisita, tipoStatus, lider.id_usuario)) continue;

        const mensagem = montarMsgStatusLideranca({
          resolvido,
          loja: lojaLabel,
          auditor: item.nome_auditor,
          dataAuditoria,
          nota,
          dataVisitaEscala: dataEscala,
        });

        const ok = await enviarSePossivel(lider.id_usuario, mensagem);
        if (ok) {
          await registrarEnvio({
            idVisita,
            idLoja: item.id_loja,
            tipo: tipoStatus,
            idUsuario: lider.id_usuario,
            metadata: { ncs_abertas: ncs.abertas },
          });
        }
      }
    }
  }
}

export function iniciarMonitorTimeCampoNotificacoes() {
  if (timer) return;
  void processarAgendaTimeCampo();
  timer = setInterval(() => void processarAgendaTimeCampo(), INTERVALO_MS);
}
