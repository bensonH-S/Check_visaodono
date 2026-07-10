import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,
});

const { rows } = await pool.query(`
  SELECT v.id_visita, l.name AS loja, l.bk_number, tc.codigo, tc.nome AS tipo_nome,
         v.nota_final, v.status, v.data_visita::date AS data_visita,
         ua.nome AS auditor,
         u_reg.nome AS supervisor_frota,
         (SELECT COUNT(*)::int FROM nao_conformidades nc WHERE nc.id_visita = v.id_visita) AS total_ncs,
         (SELECT COUNT(*)::int FROM nao_conformidades nc WHERE nc.id_visita = v.id_visita AND nc.status = 'Em aberto') AS ncs_abertas,
         (SELECT COUNT(*)::int FROM time_campo_notificacoes tcn WHERE tcn.id_visita = v.id_visita AND tcn.tipo = 'reprovacao_regional') AS wpp_enviados
  FROM visitas v
  JOIN lojas l ON l.id_loja = v.id_loja
  JOIN tipos_checklist tc ON tc.id_tipo_checklist = v.id_tipo_checklist
  JOIN usuarios ua ON ua.id_usuario = v.id_usuario
  LEFT JOIN frota_regiao_lojas rl ON rl.id_loja = v.id_loja
  LEFT JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
  LEFT JOIN usuarios u_reg ON u_reg.id_usuario = r.id_regional
  WHERE v.status = 'Finalizada'
    AND v.nota_final IS NOT NULL
    AND v.nota_final::numeric < 80
  ORDER BY v.data_visita DESC, v.id_visita DESC
`);

console.table(rows.map((r) => ({
  id: r.id_visita,
  loja: r.loja,
  tipo: `${r.tipo_nome} (${r.codigo})`,
  nota: r.nota_final,
  data: String(r.data_visita).slice(0, 10),
  auditor: r.auditor,
  supervisor: r.supervisor_frota,
  ncs: `${r.ncs_abertas}/${r.total_ncs}`,
  wpp: r.wpp_enviados,
})));

const tipos = await pool.query(`SELECT id_tipo_checklist, codigo, nome FROM tipos_checklist ORDER BY id_tipo_checklist`);
console.log('\nTipos checklist:');
console.table(tipos.rows);

await pool.end();
