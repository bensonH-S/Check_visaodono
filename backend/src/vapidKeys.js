/** Sanitiza e valida chaves VAPID (Web Push / FCM). */

export function sanitizarChaveVapid(raw) {
  if (!raw) return null;
  return String(raw)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '');
}

function decodificarBase64Url(key) {
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

export function validarVapidPublicKey(publicKey) {
  const key = sanitizarChaveVapid(publicKey);
  if (!key) return { ok: false, reason: 'vazio', key: null };
  try {
    const buf = decodificarBase64Url(key);
    if (buf.length !== 65) {
      return { ok: false, reason: `tamanho_publico_${buf.length}`, key: null };
    }
    if (buf[0] !== 0x04) {
      return { ok: false, reason: 'formato_publico', key: null };
    }
    return { ok: true, reason: null, key };
  } catch {
    return { ok: false, reason: 'base64_invalido', key: null };
  }
}

export function validarVapidPrivateKey(privateKey) {
  const key = sanitizarChaveVapid(privateKey);
  if (!key) return { ok: false, reason: 'vazio', key: null };
  try {
    const buf = decodificarBase64Url(key);
    if (buf.length !== 32) {
      return { ok: false, reason: `tamanho_privado_${buf.length}`, key: null };
    }
    return { ok: true, reason: null, key };
  } catch {
    return { ok: false, reason: 'base64_invalido', key: null };
  }
}

export function normalizarVapidSubject(raw) {
  const subject = sanitizarChaveVapid(raw) || 'mailto:support@grupoalvim.com.br';
  if (subject.startsWith('mailto:') || subject.startsWith('https://')) return subject;
  return `mailto:${subject}`;
}
