import { logger } from '../logger.js';
import { pool } from '../db.js';
import { listarMensagensChatWpp, marcarLidaWpp, wppEnabled } from '../services/wppClient.js';
import { carregarCredenciaisWpp } from '../services/wppSession.js';
import { enqueueInboundAlvim } from './conversa.js';

const vistos = new Set();
let timer = null;
let varrendo = false;
let ultimoTs = 0;

const HOMOLOG_PHONE = '5561991094654';
const HOMOLOG_CHAT = `${HOMOLOG_PHONE}@c.us`;

export function iniciarOuvidoAlvim() {
  if (timer) return;
  if (!wppEnabled()) {
    logger.info('agente-alvim', 'Ouvido desligado (WPP_ENABLED=false)');
    return;
  }
  logger.info('agente-alvim', 'Ouvido Zap ligado (só mensagem nova, sem replay)');
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

async function garantirCursor() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agente_alvim_ouvido (
      chat TEXT PRIMARY KEY,
      ultimo_ts BIGINT NOT NULL DEFAULT 0,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function carregarCursor() {
  await garantirCursor();
  const { rows } = await pool.query(
    'SELECT ultimo_ts FROM agente_alvim_ouvido WHERE chat = $1',
    [HOMOLOG_CHAT],
  );
  const salvo = Number(rows[0]?.ultimo_ts || 0);
  if (salvo > ultimoTs) ultimoTs = salvo;
}

async function salvarCursor(ts) {
  if (!ts || ts <= 0) return;
  await garantirCursor();
  await pool.query(
    `
    INSERT INTO agente_alvim_ouvido (chat, ultimo_ts, atualizado_em)
    VALUES ($1, $2, NOW())
    ON CONFLICT (chat) DO UPDATE
    SET ultimo_ts = GREATEST(agente_alvim_ouvido.ultimo_ts, EXCLUDED.ultimo_ts),
        atualizado_em = NOW()
    `,
    [HOMOLOG_CHAT, ts],
  );
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
  if (varrendo) return;
  varrendo = true;
  try {
    const cred = await carregarCredenciaisWpp();
    if (!cred?.token) return;
    await carregarCursor();

    const msgs = await listarMensagensChatWpp(cred.token, HOMOLOG_CHAT, { count: 20, isGroup: false });
    const ordenadas = [...(msgs || [])].sort((a, b) => tsMsg(a) - tsMsg(b));
    const piso = ultimoTs > 0 ? ultimoTs : Date.now() - 15000;

    const candidatas = ordenadas.filter((m) => {
      if (m?.fromMe === true) return false;
      if (!textoMsg(m)) return false;
      const ts = tsMsg(m);
      return ts > piso;
    });

    logger.info('agente-alvim', 'Ouvido varreu chat', {
      msgs: ordenadas.length,
      candidatas: candidatas.length,
    });

    let ouvidas = 0;
    let maxTs = ultimoTs;
    for (const raw of ordenadas) {
      const ts = tsMsg(raw);
      if (ts > maxTs) maxTs = ts;
    }
    for (const raw of candidatas) {
      if (ingestir(raw)) ouvidas += 1;
    }
    if (maxTs > ultimoTs) {
      ultimoTs = maxTs;
      await salvarCursor(maxTs);
    }
    if (ouvidas) {
      logger.info('agente-alvim', 'Ouvido enfileirou respostas', { ouvidas });
      void marcarLidaWpp(cred.token, HOMOLOG_CHAT, false);
    }
  } catch (e) {
    logger.warn('agente-alvim', 'Ouvido Zap falhou', { error: e.message });
  } finally {
    varrendo = false;
  }
}
