/**
 * Processa visitas auditoria_operacional reprovadas que ainda não receberam WhatsApp.
 * Uso: node scripts/processar-reprovadas-backlog.mjs
 *      node scripts/processar-reprovadas-backlog.mjs 21 19 17
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const idsArg = process.argv.slice(2).map(Number).filter(Boolean);

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
});

const { processarVisitaTimeCampoReprovada } = await import('../src/services/timeCampoNotificacoes.js');

let ids = idsArg;
if (!ids.length) {
  const { rows } = await pool.query(`
    SELECT v.id_visita
    FROM visitas v
    JOIN tipos_checklist tc ON tc.id_tipo_checklist = v.id_tipo_checklist
    WHERE tc.codigo = 'auditoria_operacional'
      AND v.status = 'Finalizada'
      AND v.nota_final::numeric < 80
      AND EXISTS (SELECT 1 FROM nao_conformidades nc WHERE nc.id_visita = v.id_visita)
      AND NOT EXISTS (
        SELECT 1 FROM time_campo_notificacoes tcn
        WHERE tcn.id_visita = v.id_visita AND tcn.tipo = 'reprovacao_regional'
      )
    ORDER BY v.data_visita DESC
  `);
  ids = rows.map((r) => r.id_visita);
}

console.log('Processando visitas:', ids.join(', ') || '(nenhuma)');

for (const id of ids) {
  const res = await processarVisitaTimeCampoReprovada(id);
  console.log(`Visita ${id}:`, res);
}

await pool.end();
