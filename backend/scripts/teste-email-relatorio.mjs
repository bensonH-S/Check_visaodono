/**
 * Envia relatório de uma visita só para e-mail de teste (TI).
 *
 * Uso:
 *   node backend/scripts/teste-email-relatorio.mjs [id_visita] [email]
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: false });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

const { pool } = await import('../src/db.js');
const { enviarRelatorioVisitaTeste } = await import('../src/services/visitaRelatorioEmail.js');
const { smtpConfigurado } = await import('../src/services/mailer.js');

const EMAIL_TESTE = String(
  process.argv[3] || process.env.VISITA_RELATORIO_TEST_EMAIL || 'benson.henriquesilva@gmail.com',
)
  .trim()
  .toLowerCase();

async function resolverVisitaId() {
  const arg = Number(process.argv[2]);
  if (Number.isFinite(arg) && arg > 0) return arg;

  const { rows } = await pool.query(
    `SELECT id_visita
     FROM visitas
     WHERE status = 'Finalizada'
     ORDER BY data_visita DESC, id_visita DESC
     LIMIT 1`,
  );
  return rows[0]?.id_visita ?? null;
}

async function main() {
  if (!smtpConfigurado()) {
    console.error('SMTP não configurado. Preencha SMTP_USER e SMTP_PASS no backend/.env');
    process.exit(1);
  }

  const idVisita = await resolverVisitaId();
  if (!idVisita) {
    console.error('Nenhuma visita Finalizada encontrada para teste.');
    process.exit(1);
  }

  console.log(`[teste-email] Gerando PDF e enviando visita #${idVisita} → ${EMAIL_TESTE}`);
  const result = await enviarRelatorioVisitaTeste(idVisita, EMAIL_TESTE);
  console.log('[teste-email] OK:', result);
  await pool.end();
}

main().catch(async (e) => {
  console.error('[teste-email] Falha:', e.message || e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
