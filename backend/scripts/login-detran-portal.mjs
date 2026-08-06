/**
 * Login MANUAL no portal DETRAN-DF.
 * A IA / Playwright NÃO resolvem reCAPTCHA — você marca "Não sou um robô".
 *
 * Uso:
 *   node backend/scripts/login-detran-portal.mjs
 *
 * 1) Abre o Chrome em https://portal.detran.df.gov.br/#/login
 * 2) Preenche CPF/senha do .env
 * 3) Você resolve o captcha e clica Entrar (se ainda não entrar sozinho)
 * 4) Sessão salva em backend/data/detran-df-storage.json
 * 5) Depois use "Atualizar consulta" na aba Multas (pode voltar HEADLESS=true)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env'), override: true });
process.env.DETRAN_PORTAL_HEADLESS = '0';
process.env.DETRAN_PORTAL_ENABLED = process.env.DETRAN_PORTAL_ENABLED || 'true';

console.log('');
console.log('=== Login DETRAN-DF (manual / reCAPTCHA) ===');
console.log('1. Vai abrir o Chrome em #/login');
console.log('2. CPF/senha vêm do .env');
console.log('3. VOCÊ resolve o reCAPTCHA na janela (a automação não faz isso)');
console.log('4. Aguarde até sair da tela de login');
console.log('');

const { loginInterativoPortalDetran, encerrarSessaoPortalDetran } = await import(
  '../src/services/detranDfPortalPlaywright.js'
);

try {
  const r = await loginInterativoPortalDetran();
  console.log('OK — sessão salva em:', r.storage);
  console.log('URL atual:', r.url);
  console.log('Agora pode usar Atualizar consulta na aba Multas.');
} catch (e) {
  console.error('Falha:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await encerrarSessaoPortalDetran().catch(() => {});
}
