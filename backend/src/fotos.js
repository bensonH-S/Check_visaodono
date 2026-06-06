/**
 * Mídia (imagens/vídeos) criptografada no banco — sem arquivos em disco.
 */
import { encryptBuffer, encryptToBase64, decryptFromBase64, decryptBuffer } from './cryptoMedia.js';

const APP_BASE_PATH = '/auditoria';

function isDataUrl(v) {
  return typeof v === 'string' && v.startsWith('data:');
}

function parseDataUrl(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function parseClientLista(fotoUrl) {
  const trimmed = String(fotoUrl).trim();
  if (!trimmed) return [];

  let lista = [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) lista = parsed;
    } catch {
      lista = [trimmed];
    }
  } else if (isDataUrl(trimmed)) {
    lista = [trimmed];
  } else {
    return [];
  }

  const items = [];
  for (const item of lista) {
    if (typeof item !== 'string' || !isDataUrl(item)) continue;
    const parsed = parseDataUrl(item);
    if (!parsed) continue;
    if (
      !parsed.mime.startsWith('image/') &&
      !parsed.mime.startsWith('video/')
    ) {
      continue;
    }
    items.push(parsed);
  }
  return items;
}

/** Persiste mídia do checklist em `respostas.foto_url` (JSON criptografado). */
export async function persistirFotos(_idVisita, _idPergunta, fotoUrl) {
  if (!fotoUrl) return null;

  const items = parseClientLista(fotoUrl);
  if (!items.length) return null;

  const stored = {
    v: 1,
    items: items.map(({ buffer, mime }) => ({
      m: mime,
      d: encryptToBase64(buffer),
    })),
  };
  return JSON.stringify(stored);
}

export function countMidiaResposta(fotoUrl) {
  if (!fotoUrl) return 0;
  try {
    const parsed = JSON.parse(fotoUrl);
    if (parsed?.v === 1 && Array.isArray(parsed.items)) return parsed.items.length;
  } catch {
    /* legado */
  }
  return 0;
}

export function midiaUrlsResposta(idVisita, idPergunta, fotoUrl) {
  const n = countMidiaResposta(fotoUrl);
  const base = `${APP_BASE_PATH}/api/visitas/${idVisita}/respostas/${idPergunta}/media`;
  return Array.from({ length: n }, (_, i) => `${base}/${i}`);
}

export function decryptMidiaResposta(fotoUrl, index) {
  const parsed = JSON.parse(fotoUrl);
  if (parsed?.v !== 1 || !Array.isArray(parsed.items)) {
    throw new Error('Formato de mídia inválido');
  }
  const item = parsed.items[index];
  if (!item?.d) throw new Error('Mídia não encontrada');
  return {
    buffer: decryptFromBase64(item.d),
    mime: item.m || 'application/octet-stream',
  };
}

export function encryptAnexo(buffer) {
  return encryptBuffer(buffer);
}

export function decryptAnexo(payload) {
  return decryptBuffer(payload);
}

export function midiaUrlAnexo(idAnexo) {
  return `${APP_BASE_PATH}/api/manutencao/anexos/${idAnexo}/media`;
}

export function midiaPermitida(mime) {
  return (
    typeof mime === 'string' &&
    (mime.startsWith('image/') ||
      mime.startsWith('video/') ||
      mime === 'application/pdf')
  );
}
