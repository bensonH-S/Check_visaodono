/**
 * Dispara e-mail de relatório para todas as visitas Finalizadas
 * de Auditoria Operacional (não envia Time de Campo).
 *
 * Destinatários (por loja):
 * - Felipe / Renato / Igor / Benson → todas as lojas
 * - Regional → só lojas da região
 * - Gestor/gerente → só lojas dele
 *
 * Uso:
 *   node --production backend/scripts/disparar-relatorios-operacional-backlog.mjs
 *   node --production backend/scripts/disparar-relatorios-operacional-backlog.mjs --dry-run
 *   node --production backend/scripts/disparar-relatorios-operacional-backlog.mjs --force
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: false });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

process.argv.push('--production');

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force') || !process.argv.includes('--somente-pendentes');
const delayMs = Number(process.env.VISITA_RELATORIO_BACKLOG_DELAY_MS || 2500);

const { pool } = await import('../src/db.js');
const { processarEnvioRelatorioVisita, emailRelatorioHabilitado } = await import(
  '../src/services/visitaRelatorioEmail.js'
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function listarVisitasOperacional() {
  const { rows } = await pool.query(
    `SELECT v.id_visita, v.data_visita, v.nota_final, l.name AS loja, l.bk_number,
            COALESCE(tc.codigo, 'auditoria_operacional') AS tipo_codigo,
            EXISTS (
              SELECT 1 FROM time_campo_notificacoes t
              WHERE t.id_visita = v.id_visita AND t.tipo = 'relatorio_email'
            ) AS ja_enviado
     FROM visitas v
     JOIN lojas l ON l.id_loja = v.id_loja
     LEFT JOIN tipos_checklist tc ON tc.id_tipo_checklist = v.id_tipo_checklist
     WHERE v.status = 'Finalizada'
       AND (tc.codigo = 'auditoria_operacional' OR v.id_tipo_checklist IS NULL)
     ORDER BY v.data_visita ASC, v.id_visita ASC`,
  );
  return rows;
}

async function main() {
  if (!emailRelatorioHabilitado()) {
    console.error('SMTP não configurado / e-mail de relatório desabilitado.');
    process.exit(1);
  }

  const todas = await listarVisitasOperacional();
  const fila = force ? todas : todas.filter((v) => !v.ja_enviado);

  console.log(
    `[backlog-email] Operacional finalizadas=${todas.length} | a enviar=${fila.length}` +
      ` | force=${force} | dryRun=${dryRun} | delay=${delayMs}ms`,
  );

  if (!fila.length) {
    console.log('[backlog-email] Nada a enviar.');
    await pool.end();
    return;
  }

  let ok = 0;
  let ignorados = 0;
  let falhas = 0;

  for (let i = 0; i < fila.length; i++) {
    const v = fila[i];
    const label = `#${v.id_visita} ${v.loja} (${v.data_visita}) nota=${v.nota_final ?? '—'} já=${v.ja_enviado}`;
    if (dryRun) {
      console.log(`[dry-run] ${i + 1}/${fila.length} ${label}`);
      continue;
    }
    try {
      const result = await processarEnvioRelatorioVisita(v.id_visita, { force });
      if (result?.enviado) {
        ok += 1;
        console.log(`[ok] ${i + 1}/${fila.length} ${label} → ${result.subject}`);
      } else {
        ignorados += 1;
        console.log(`[skip] ${i + 1}/${fila.length} ${label} → ${result?.motivo || 'ignorado'}`);
      }
    } catch (e) {
      falhas += 1;
      console.error(`[fail] ${i + 1}/${fila.length} ${label} → ${e.message || e}`);
    }
    if (i < fila.length - 1) await sleep(delayMs);
  }

  console.log(`[backlog-email] Fim. ok=${ok} skip=${ignorados} fail=${falhas}`);
  await pool.end();
  if (falhas) process.exit(2);
}

main().catch(async (e) => {
  console.error('[backlog-email] Fatal:', e.message || e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
