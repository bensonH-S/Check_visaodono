import { logger } from '../logger.js';
import { normalizarTelefoneBr } from '../utils/telefone.js';
import { enviarMensagemWpp, wppEnabled } from '../services/wppClient.js';
import { enviarWhatsAppParaUsuario } from '../services/whatsappNotificacoes.js';
import { carregarCredenciaisWpp } from '../services/wppSession.js';

function pausaBolha() {
  return new Promise((r) => setTimeout(r, 700 + Math.floor(Math.random() * 500)));
}

export function destinoEhGrupo(destino) {
  const s = String(destino || '').trim();
  if (!s) return false;
  return s.includes('@g.us') || /^\d{10,}-\d+/.test(s);
}

export async function enviarWhatsAppAlvim(destino, mensagem) {
  if (!wppEnabled()) return { ok: false, motivo: 'wpp_desligado' };
  const texto = String(mensagem || '').trim();
  if (!texto) return { ok: false, motivo: 'mensagem_vazia' };

  if (destino && typeof destino === 'object' && destino.id_usuario) {
    const ok = await enviarWhatsAppParaUsuario(destino.id_usuario, texto);
    return { ok, motivo: ok ? 'usuario' : 'usuario_sem_wpp', destino };
  }

  const raw = String(destino || '').trim();
  if (!raw) return { ok: false, motivo: 'sem_destino' };

  if (/^\d+$/.test(raw) && raw.length <= 8) {
    const ok = await enviarWhatsAppParaUsuario(Number(raw), texto);
    return { ok, motivo: ok ? 'usuario' : 'usuario_sem_wpp', destino: { id_usuario: Number(raw) } };
  }

  const cred = await carregarCredenciaisWpp();
  if (!cred?.token) return { ok: false, motivo: 'sessao_wpp' };

  const grupo = destinoEhGrupo(raw);
  const phone = grupo ? raw : normalizarTelefoneBr(raw);
  if (!phone) return { ok: false, motivo: 'destino_invalido' };

  try {
    await enviarMensagemWpp(cred.token, phone, texto, { isGroup: grupo });
    return { ok: true, motivo: grupo ? 'grupo' : 'telefone', telefone: phone, destino: raw };
  } catch (e) {
    logger.warn('agente-alvim', 'Falha no WhatsApp', { error: e.message, grupo });
    return { ok: false, motivo: e.message };
  }
}

export async function enviarWhatsAppAlvimPartes(destino, partes) {
  const list = (Array.isArray(partes) ? partes : [partes])
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  if (!list.length) return { ok: false, motivo: 'mensagem_vazia' };

  let okAlgum = false;
  let ultimo = { ok: false, motivo: 'mensagem_vazia' };
  for (let i = 0; i < list.length; i += 1) {
    ultimo = await enviarWhatsAppAlvim(destino, list[i]);
    if (ultimo.ok) okAlgum = true;
    if (i < list.length - 1) await pausaBolha();
  }
  return { ...ultimo, ok: okAlgum, bolhas: list.length };
}
