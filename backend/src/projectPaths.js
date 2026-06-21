import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do repositório Check_visaodono (onde está server.js e package.json). */
export function getProjectRoot() {
  const candidates = [
    path.join(__dirname, '../..'),
    process.cwd(),
  ];
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    if (
      fs.existsSync(path.join(resolved, 'server.js')) &&
      fs.existsSync(path.join(resolved, 'package.json'))
    ) {
      return resolved;
    }
  }
  return path.resolve(candidates[0]);
}

/**
 * Pasta de logs — sempre dentro do projeto: Check_visaodono/Logs/
 * LOG_DIR no .env é relativo ao projeto (ex.: Logs). Caminhos absolutos do SO são ignorados.
 */
export function getLogsDir() {
  const root = getProjectRoot();
  const custom = process.env.LOG_DIR?.trim();
  if (!custom) return path.join(root, 'Logs');

  const relativo = custom.replace(/\\/g, '/').replace(/^\/+/, '');
  return path.join(root, relativo || 'Logs');
}
