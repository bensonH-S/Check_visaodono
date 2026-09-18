/**
 * Sobe a sessão wpp_visao_check. Não imprime token nem QR.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.DB_USE_PROD = '1';
const backendEnv = path.join(root, 'backend', '.env');
if (fs.existsSync(backendEnv)) {
  const local = dotenv.parse(fs.readFileSync(backendEnv));
  for (const [key, value] of Object.entries(local)) {
    if (value !== undefined && String(value).trim() !== '') process.env[key] = value;
  }
}
process.env.DB_USE_PROD = '1';
process.env.WPP_HOST = 'http://localhost';
process.env.WPP_ENABLED = 'true';

const { pool } = await import('../src/db.js');
const { conectarSessaoWpp } = await import('../src/services/wppSession.js');

try {
  const r = await conectarSessaoWpp({ reiniciar: false });
  console.log(JSON.stringify({
    conectado: Boolean(r.conectado),
    has_qr: Boolean(r.qrcode),
    message: r.message || null,
  }));
  process.exit(r.conectado ? 0 : 2);
} finally {
  await pool.end().catch(() => {});
}
