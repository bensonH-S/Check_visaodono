import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(root, '.env'), override: false });

export function assertEnv() {
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error('[env] Variáveis ausentes:', missing.join(', '));
    console.error('[env] Crie .env na raiz só com DB_HOST, DB_USER, DB_PASS, DB_NAME');
    process.exit(1);
  }
}
