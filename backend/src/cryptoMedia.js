import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveKey() {
  const raw = String(process.env.MEDIA_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    throw new Error(
      'MEDIA_ENCRYPTION_KEY ausente no .env (use: openssl rand -hex 32)',
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const b64 = Buffer.from(raw, 'base64');
  if (b64.length === 32) return b64;
  throw new Error('MEDIA_ENCRYPTION_KEY deve ter 32 bytes (64 hex ou base64 válido)');
}

let cachedKey = null;

function key() {
  if (!cachedKey) cachedKey = resolveKey();
  return cachedKey;
}

/** iv(12) + tag(16) + ciphertext */
export function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptBuffer(payload) {
  if (!payload || payload.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Payload de mídia inválido');
  }
  const iv = payload.subarray(0, IV_LEN);
  const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = payload.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function encryptToBase64(buffer) {
  return encryptBuffer(buffer).toString('base64');
}

export function decryptFromBase64(b64) {
  return decryptBuffer(Buffer.from(b64, 'base64'));
}
