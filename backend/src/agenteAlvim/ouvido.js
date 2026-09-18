import { logger } from '../logger.js';
import { listarMensagensChatWpp, marcarLidaWpp, wppEnabled } from '../services/wppClient.js';
import { carregarCredenciaisWpp } from '../services/wppSession.js';
import { enqueueInboundAlvim } from './conversa.js';

const vistos = new Set();
const ultimoTs = new Map();
let timer = null;
let primeiraVarredura = true;

const HOMOLOG_PHONE = '5561991094654';
const HOMOLOG_CHAT = `${HOMOLOG_PHONE}@c.us`;

export function iniciarOuvidoAlvim() {
  if (timer) return;
  if (!wppEnabled()) {
    logger.info('agente-alvim', 'Ouvido desligado (WPP_ENABLED=false)');
    return;
  }
  logger.info('agente-alvim', 'Ouvido Zap ligado (lê o chat de homologação a cada 12s)');
  timer = setInterval(() => void varrerNaoLidas(), 12000);
  void varrerNaoLidas();
}

function tsMsg(raw) {
  const millis = Number(raw?.clientReceivedTsMillis || 0);
  if (millis > 1e12) return millis;
  const t = Number(raw?.timestamp || raw?.t || 0);
  if (!t) return 0;
  return t > 1e12 ? t : t * 1000;
}

function textoMsg(raw) {
  if (!raw || raw.fromMe === true) return '';
  const direto = raw.body || raw.content || raw.caption || raw.text;
  if (direto) return String(direto).trim();
  const nested = raw.message;
  if (typeof nested === 'string') return nested.trim();
  if (nested && typeof nested === 'object') {
    return String(nested.body || nested.content || nested.conversation || nested.caption || '').trim();
  }
  return '';
}

function idMsg(raw, texto) {
  return String(raw?.id?._serialized || raw?.id?.id || raw?.id || `${texto}:${tsMsg(raw)}`).slice(0, 180);
}

function ingestir(raw) {
  const body = textoMsg(raw);
  if (!body) return false;
  const id = idMsg(raw, body);
  if (vistos.has(id)) return false;
  vistos.add(id);
  if (vistos.size > 800) {
    vistos.clear();
    vistos.add(id);
  }
  const nome = String(raw?.notifyName || raw?.sender?.pushname || 'Benson').trim();
  logger.info('agente-alvim', 'Ouviu Zap', { de: nome, texto: body.slice(0, 80) });
  void enqueueInboundAlvim(HOMOLOG_PHONE, body, {
    chatId: HOMOLOG_CHAT,
    nomePessoa: nome,
  });
  return true;
}

async function varrerNaoLidas() {
  try {
    const cred = await carregarCredenciaisWpp();
    if (!cred?.token) return;

    const msgs = await listarMensagensChatWpp(cred.token, HOMOLOG_CHAT, { count: 40, isGroup: false });
    const ordenadas = [...(msgs || [])].sort((a, b) => tsMsg(a) - tsMsg(b));
    const piso = primeiraVarredura
      ? Date.now() - 8 * 60 * 1000
      : (ultimoTs.get(HOMOLOG_CHAT) || Date.now() - 60000);

    const candidatas = ordenadas.filter((m) => {
      if (m?.fromMe === true) return false;
      const texto = textoMsg(m);
      if (!texto) return false;
      const ts = tsMsg(m);
      return !ts || ts >= piso;
    });

    logger.info('agente-alvim', 'Ouvido varreu chat', {
      msgs: ordenadas.length,
      candidatas: candidatas.length,
      primeira: primeiraVarredura,
    });

    const fila = primeiraVarredura ? candidatas.slice(-1) : candidatas;
    let ouvidas = 0;
    let maxTs = ultimoTs.get(HOMOLOG_CHAT) || 0;
    for (const raw of fila) {
      const ts = tsMsg(raw);
      if (ts > maxTs) maxTs = ts;
      if (ingestir(raw)) ouvidas += 1;
    }
    for (const raw of ordenadas) {
      const ts = tsMsg(raw);
      if (ts > maxTs) maxTs = ts;
    }
    if (maxTs) ultimoTs.set(HOMOLOG_CHAT, maxTs);
    if (ouvidas) {
      logger.info('agente-alvim', 'Ouvido enfileirou respostas', { ouvidas });
      void marcarLidaWpp(cred.token, HOMOLOG_CHAT, false);
    }
    primeiraVarredura = false;
  } catch (e) {
    logger.warn('agente-alvim', 'Ouvido Zap falhou', { error: e.message });
  }
}
