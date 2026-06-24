import { pool } from '../db.js';
import { normalizarTelefoneBr } from '../utils/telefone.js';
import { enviarMensagemWpp, wppEnabled } from './wppClient.js';
import { carregarCredenciaisWpp } from './wppSession.js';

const APP_BASE = '/auditoria';
const TIPOS_APROVACAO = new Set(['envio_aprovacao', 'encaminhar_diretor', 'aprovacao_diretor']);
const dedupCache = new Map();
const DEDUP_TTL_MS = 2 * 60 * 1000;

function publicBaseUrl() {
  const raw = String(process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (!raw) return '';
  // Aceita domínio só (https://grupoalvim.com.br) ou URL completa do app (…/auditoria)
  if (raw.endsWith(APP_BASE)) return raw;
  return `${raw}${APP_BASE}`;
}

function dedupKey(idUsuario, idChamado, tipo, mensagem) {
  return `${idUsuario}|${idChamado}|${tipo}|${mensagem.slice(0, 120)}`;
}

function dedupRecente(key) {
  const now = Date.now();
  for (const [k, exp] of dedupCache) {
    if (exp <= now) dedupCache.delete(k);
  }
  const exp = dedupCache.get(key);
  if (exp && exp > now) return true;
  dedupCache.set(key, now + DEDUP_TTL_MS);
  return false;
}

async function eventoWhatsAppAtivo(tipo) {
  try {
    const { rows } = await pool.query(
      `SELECT ativo FROM manut_notificacao_eventos WHERE codigo = $1`,
      [tipo],
    );
    return rows[0]?.ativo !== false;
  } catch {
    return true;
  }
}

function tituloPorTipo(tipo, numero) {
  switch (tipo) {
    case 'novo_chamado':
      return `Novo chamado #${numero}`;
    case 'resposta':
      return `Nova mensagem no chamado #${numero}`;
    case 'anexo':
      return `Novo anexo no chamado #${numero}`;
    case 'assumido':
      return `Chamado #${numero} assumido`;
    case 'chamado_urgente_regiao':
      return `Chamado urgente #${numero}`;
    case 'fechamento':
      return `Chamado #${numero} encerrado`;
    case 'reabertura':
      return `Chamado #${numero} reaberto`;
    case 'envio_aprovacao':
      return `Orçamento pendente — chamado #${numero}`;
    case 'aguardando_aprovacao':
      return `Aguardando aprovação — chamado #${numero}`;
    case 'encaminhar_diretor':
      return `Orçamento encaminhado ao Diretor — #${numero}`;
    case 'aprovacao_diretor':
      return `Orçamento aprovado pelo Diretor — #${numero}`;
    case 'aprovacao':
      return `Orçamento aprovado — chamado #${numero}`;
    case 'recusa_aprovacao':
      return `Orçamento recusado — chamado #${numero}`;
    default:
      return `Chamado #${numero}`;
  }
}

function montarLink(idChamado, tipo, podeAprovar) {
  const base = publicBaseUrl();
  if (!base) return null;
  const path =
    TIPOS_APROVACAO.has(tipo) && podeAprovar
      ? `/chamados/aprovacoes/${idChamado}`
      : `/chamados/mobile/${idChamado}`;
  return `${base}${path}`;
}

function montarMensagemWhatsApp({ tipo, numero, mensagem, link }) {
  const titulo = tituloPorTipo(tipo, numero);
  const linhas = ['🔔 *Vision Check*', titulo, ''];
  const corpo = String(mensagem || '').trim();
  if (corpo) linhas.push(corpo, '');
  if (link) linhas.push(`👉 Abrir: ${link}`);
  return linhas.join('\n').trim();
}

export async function dispatchWhatsAppNotificacao({ idUsuario, idChamado, tipo, mensagem }) {
  if (!wppEnabled()) return false;

  const uid = Number(idUsuario);
  const cid = Number(idChamado);
  if (!Number.isFinite(uid) || !Number.isFinite(cid)) return false;

  const key = dedupKey(uid, cid, tipo, mensagem);
  if (dedupRecente(key)) return false;

  if (!(await eventoWhatsAppAtivo(tipo))) return false;

  const { rows: usuarios } = await pool.query(
    `SELECT u.telefone_whatsapp, u.notifica_whatsapp, u.ativo,
            EXISTS (
              SELECT 1 FROM usuario_permissoes up
              WHERE up.id_usuario = u.id_usuario AND up.codigo = 'chamados.aprovar'
            ) AS pode_aprovar
     FROM usuarios u
     WHERE u.id_usuario = $1`,
    [uid],
  );
  const u = usuarios[0];
  if (!u?.ativo || u.notifica_whatsapp === false) return false;

  const telefone = normalizarTelefoneBr(u.telefone_whatsapp);
  if (!telefone) return false;

  const { rows: chamados } = await pool.query(
    'SELECT numero FROM manut_chamados WHERE id_chamado = $1',
    [cid],
  );
  const numero = chamados[0]?.numero ?? cid;

  const link = montarLink(cid, tipo, !!u.pode_aprovar);
  const texto = montarMensagemWhatsApp({ tipo, numero, mensagem, link });

  const cred = await carregarCredenciaisWpp();
  if (!cred?.token) {
    console.warn('[whatsapp] Credenciais WPP indisponíveis');
    return false;
  }

  try {
    await enviarMensagemWpp(cred.token, telefone, texto);
    return true;
  } catch (e) {
    console.error('[whatsapp] Falha ao enviar:', e.message);
    return false;
  }
}

export async function enviarWhatsAppTeste(telefone, mensagem) {
  if (!wppEnabled()) throw new Error('WhatsApp desabilitado (WPP_ENABLED=false)');
  const tel = normalizarTelefoneBr(telefone);
  if (!tel) throw new Error('Telefone inválido');
  const cred = await carregarCredenciaisWpp();
  if (!cred?.token) throw new Error('Sessão WPP não configurada');
  const texto = mensagem?.trim() || '✅ Teste Vision Check — notificações WhatsApp ativas.';
  await enviarMensagemWpp(cred.token, tel, texto);
  return { ok: true, telefone: tel };
}
