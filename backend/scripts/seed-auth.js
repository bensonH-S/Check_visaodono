/**
 * Usuários de teste (senha: Alvim@2026)
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const { ensureAuthUsers } = await import('../src/seedAuth.js');

try {
  const result = await ensureAuthUsers();
  console.log('OK — senha Alvim@2026');
  console.log('  ti@grupoalvim.com.br → todas as permissões');
  console.log('  demais → sem permissões (configure em Usuários)');
  console.log('  e-mails:', result.emails.join(', '));
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
}
