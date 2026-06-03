import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const APP_BASE_PATH = '/auditoria';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

function prefixoUploadsPublico() {
  return `${APP_BASE_PATH}/api/uploads`.replace(/\/+/g, '/');
}

function parseDataUrl(dataUrl) {
  const m = String(dataUrl).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1] === 'png' ? 'png' : 'jpg';
  return { ext, buffer: Buffer.from(m[2], 'base64') };
}

function isDataUrl(v) {
  return typeof v === 'string' && v.startsWith('data:image');
}

/** Converte base64 (string ou JSON array) em caminhos curtos no disco. */
export async function persistirFotos(idVisita, idPergunta, fotoUrl) {
  if (!fotoUrl) return null;

  let lista = [];
  const trimmed = fotoUrl.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) lista = parsed;
    } catch {
      lista = [trimmed];
    }
  } else if (isDataUrl(trimmed) || trimmed.includes('/uploads/')) {
    lista = [trimmed];
  } else {
    return fotoUrl;
  }

  const dir = path.join(ROOT, `visita-${idVisita}`);
  fs.mkdirSync(dir, { recursive: true });

  const paths = [];
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    if (typeof item !== 'string') continue;
    if (item.includes('/uploads/') && !isDataUrl(item)) {
      paths.push(item);
      continue;
    }
    if (!isDataUrl(item)) continue;
    const parsed = parseDataUrl(item);
    if (!parsed) continue;
    const name =
      lista.length > 1 ? `${idPergunta}_${i}.${parsed.ext}` : `${idPergunta}.${parsed.ext}`;
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, parsed.buffer);
    paths.push(`${prefixoUploadsPublico()}/visita-${idVisita}/${name}`);
  }

  if (!paths.length) return null;
  if (paths.length === 1) return paths[0];
  return JSON.stringify(paths);
}

export function uploadsRoot() {
  return ROOT;
}
