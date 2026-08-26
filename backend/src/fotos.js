/**
 * Mídia (imagens/vídeos) criptografada no banco — sem arquivos em disco.
 */
import crypto from 'crypto';
import { encryptBuffer, encryptToBase64, decryptFromBase64, decryptBuffer } from './cryptoMedia.js';

const APP_BASE_PATH = '/auditoria';
const MAX_ITENS_MIDIA = 10;
const MEDIA_REF_RE = /\/visitas\/(\d+)\/respostas\/(\d+)\/media\/(\d+)/;

function parseDataUrl(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function itensArmazenados(existente) {
  if (!existente) return [];
  try {
    const prev = JSON.parse(existente);
    if (prev?.v === 1 && Array.isArray(prev.items)) return prev.items;
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Lista mista do cliente: data URLs novas e/ou URLs da API já persistidas.
 * A ordem da lista é a ordem final (substitui, não concatena).
 */
function parseListaMista(fotoUrl) {
  const trimmed = String(fotoUrl ?? '').trim();
  if (!trimmed) return [];

  let lista = [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) lista = parsed;
    } catch {
      lista = [trimmed];
    }
  } else {
    lista = [trimmed];
  }

  const items = [];
  for (const item of lista) {
    if (typeof item !== 'string' || !item) continue;
    const data = parseDataUrl(item);
    if (data) {
      if (!data.mime.startsWith('image/') && !data.mime.startsWith('video/')) continue;
      items.push({ kind: 'data', mime: data.mime, buffer: data.buffer });
      continue;
    }
    const ref = item.match(MEDIA_REF_RE);
    if (ref) {
      items.push({
        kind: 'ref',
        idVisita: Number(ref[1]),
        idPergunta: Number(ref[2]),
        index: Number(ref[3]),
      });
    }
  }
  return items;
}

/**
 * Classifica o payload de foto do cliente:
 * - gravar: lista final (data URLs e/ou URLs da API) → substitui a coluna
 * - limpar: vazio / null → apaga no banco
 * - manter: campo omitido ou payload irreconhecível
 */
export function classificarFotoCliente(fotoUrl) {
  /* undefined = campo omitido → não mexer na foto já salva */
  if (fotoUrl === undefined) return { acao: 'manter' };
  if (fotoUrl == null || fotoUrl === '' || fotoUrl === '[]') {
    return { acao: 'limpar' };
  }
  const items = parseListaMista(fotoUrl);
  if (items.length) return { acao: 'gravar', items };
  return { acao: 'manter' };
}

/** Persiste a lista final em `respostas.foto_url` (substitui; ignora duplicatas). */
export async function persistirFotos(idVisita, idPergunta, fotoUrl, existente) {
  const lista = parseListaMista(fotoUrl);
  if (!lista.length) return existente ?? null;

  const antigos = itensArmazenados(existente);
  const seen = new Set();
  const items = [];
  const idVisitaN = Number(idVisita);
  const idPerguntaN = Number(idPergunta);

  for (const part of lista) {
    if (items.length >= MAX_ITENS_MIDIA) break;

    if (part.kind === 'data') {
      const hash = hashBuffer(part.buffer);
      if (seen.has(hash)) continue;
      seen.add(hash);
      items.push({ m: part.mime, d: encryptToBase64(part.buffer) });
      continue;
    }

    if (part.kind !== 'ref') continue;
    if (part.idVisita !== idVisitaN || part.idPergunta !== idPerguntaN) continue;
    const prev = antigos[part.index];
    if (!prev?.d) continue;
    try {
      const hash = hashBuffer(decryptFromBase64(prev.d));
      if (seen.has(hash)) continue;
      seen.add(hash);
    } catch {
      continue;
    }
    items.push(prev);
  }

  if (!items.length) return existente ?? null;
  return JSON.stringify({ v: 1, items });
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
