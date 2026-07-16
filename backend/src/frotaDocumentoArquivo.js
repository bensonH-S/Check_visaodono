import fs from 'fs';
import path from 'path';
import { getProjectRoot } from './projectPaths.js';

/** Pasta base: backend/uploads (legado visitas/manut) ou raiz/uploads. */
export function getUploadsDir() {
  const root = getProjectRoot();
  const backendUploads = path.join(root, 'backend', 'uploads');
  if (fs.existsSync(backendUploads)) return backendUploads;
  return path.join(root, 'uploads');
}

function sanitizarNomeArquivo(nome) {
  const base = path.basename(String(nome || 'documento')).replace(/[^\w.\-()\sÀ-ú]+/gi, '_');
  const trimmed = base.trim().slice(0, 120);
  return trimmed || 'documento.pdf';
}

/** Diretório do veículo: uploads/frota-veiculo-{id}/ */
export function dirDocumentoVeiculo(idVeiculo) {
  return path.join(getUploadsDir(), `frota-veiculo-${Number(idVeiculo)}`);
}

/**
 * Caminho canônico do arquivo em disco.
 * Ex.: uploads/frota-veiculo-1/doc-5-anexo-26-CRLV_gol.pdf
 */
export function caminhoDocumentoDisco({ idVeiculo, idDocumento, idAnexo, nomeArquivo }) {
  const safe = sanitizarNomeArquivo(nomeArquivo);
  return path.join(
    dirDocumentoVeiculo(idVeiculo),
    `doc-${Number(idDocumento)}-anexo-${Number(idAnexo)}-${safe}`,
  );
}

export function salvarDocumentoDisco({ idVeiculo, idDocumento, idAnexo, nomeArquivo, buffer }) {
  const dir = dirDocumentoVeiculo(idVeiculo);
  fs.mkdirSync(dir, { recursive: true });
  const dest = caminhoDocumentoDisco({ idVeiculo, idDocumento, idAnexo, nomeArquivo });
  fs.writeFileSync(dest, buffer);
  return dest;
}

/** Localiza arquivo em disco pelo padrão doc-{id}-anexo-{idAnexo}-* */
export function encontrarDocumentoDisco({ idVeiculo, idDocumento, idAnexo }) {
  const dir = dirDocumentoVeiculo(idVeiculo);
  if (!fs.existsSync(dir)) return null;

  const prefix = `doc-${Number(idDocumento)}-anexo-${Number(idAnexo)}-`;
  const match = fs.readdirSync(dir).find((f) => f.startsWith(prefix));
  if (match) return path.join(dir, match);

  // Fallback se o nome original mudou: qualquer arquivo do documento
  const prefixDoc = `doc-${Number(idDocumento)}-anexo-`;
  const matchDoc = fs.readdirSync(dir).find((f) => f.startsWith(prefixDoc));
  return matchDoc ? path.join(dir, matchDoc) : null;
}

export function removerDocumentoDisco({ idVeiculo, idDocumento, idAnexo }) {
  const file = encontrarDocumentoDisco({ idVeiculo, idDocumento, idAnexo });
  if (file && fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }

  const dir = dirDocumentoVeiculo(idVeiculo);
  if (fs.existsSync(dir)) {
    try {
      const rest = fs.readdirSync(dir);
      if (rest.length === 0) fs.rmdirSync(dir);
    } catch {
      /* ignore */
    }
  }
}

export function lerDocumentoDisco(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}
