/**
 * Carrega .env só da raiz do projeto (antes de db.js e server.js).
 * No Docker, variáveis vêm de --env-file (process.env já preenchido).
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, '.env');

dotenv.config({ path: envPath, override: false });

export function assertEnv() {
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'PORT'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error('[env] Variáveis ausentes:', missing.join(', '));
    console.error('[env] Copie .env.example → .env na raiz do projeto');
    process.exit(1);
  }
}
