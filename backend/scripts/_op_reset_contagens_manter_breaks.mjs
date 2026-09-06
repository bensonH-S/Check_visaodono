/**
 * Reset operacional: apaga TODAS as contagens + zera saldos.
 * MANTÉM break / desperdício / empréstimo.
 *
 * Uso:
 *   node scripts/_op_reset_contagens_manter_breaks.mjs           # dry-run
 *   node scripts/_op_reset_contagens_manter_breaks.mjs --apply
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const apply = process.argv.includes('--apply');
const { pool } = await import('../src/db.js');
const client = await pool.connect();

try {
  const { rows: cont } = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'aberta')::int AS abertas,
      COUNT(*) FILTER (WHERE status = 'finalizada')::int AS finalizadas
    FROM estoque_contagens
  `);
  const { rows: saldos } = await client.query(`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(ABS(quantidade)),0)::float AS abs_qtd
    FROM estoque_saldos
  `);
  const { rows: pendEmp } = await client.query(`
    SELECT COUNT(*)::int AS n FROM estoque_break
    WHERE tipo = 'emprestimo' AND recebimento_status = 'pendente'
  `);
  const { rows: breaks } = await client.query(`
    SELECT tipo, COUNT(*)::int AS n FROM estoque_break GROUP BY tipo ORDER BY 1
  `);

  console.log(
    JSON.stringify(
      {
        modo: apply ? 'APPLY' : 'DRY-RUN',
        mantem: 'estoque_break (+ itens)',
        contagens: cont[0],
        saldos_linhas: saldos[0].n,
        saldos_abs_qtd: saldos[0].abs_qtd,
        breaks_por_tipo: breaks,
        emprestimos_pendentes_receber: pendEmp[0].n,
        acao: 'Apaga TODAS contagens (aberta+finalizada), zera saldos, cancela emp. pendente, limpa pendências baixa',
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('\n(rode com --apply para executar)');
    process.exit(0);
  }

  await client.query('BEGIN');

  // Movimentos de contagem ficam órfãos de referência — ok para auditoria.
  // Apaga itens e todas as contagens.
  const delItens = await client.query(`DELETE FROM estoque_itens`);
  const delCont = await client.query(`DELETE FROM estoque_contagens`);

  const zeroSaldo = await client.query(`
    UPDATE estoque_saldos SET quantidade = 0, atualizado_em = NOW()
    WHERE quantidade IS DISTINCT FROM 0
  `);

  await client.query(`
    ALTER TABLE estoque_break DROP CONSTRAINT IF EXISTS estoque_break_recebimento_status_check
  `).catch(() => {});
  await client.query(`
    ALTER TABLE estoque_break
      ADD CONSTRAINT estoque_break_recebimento_status_check
      CHECK (recebimento_status IS NULL OR recebimento_status IN ('pendente','recebido','devolvido','cancelado'))
  `).catch(() => {});

  const cancelEmp = await client.query(`
    UPDATE estoque_break
    SET recebimento_status = 'cancelado'
    WHERE tipo = 'emprestimo' AND recebimento_status = 'pendente'
  `);

  await client.query(`TRUNCATE estoque_baixa_pendencias`);

  await client.query('COMMIT');

  const { rows: check } = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM estoque_contagens) AS contagens,
      (SELECT COUNT(*)::int FROM estoque_itens) AS itens,
      (SELECT COUNT(*)::int FROM estoque_saldos WHERE quantidade IS DISTINCT FROM 0) AS saldos_nao_zero,
      (SELECT COUNT(*)::int FROM estoque_break) AS breaks
  `);

  console.log(
    JSON.stringify(
      {
        ok: true,
        itens_apagados: delItens.rowCount,
        contagens_apagadas: delCont.rowCount,
        saldos_zerados: zeroSaldo.rowCount,
        emprestimos_pendentes_cancelados: cancelEmp.rowCount,
        pos: check[0],
        proximo: 'Contagem COMPLETA por loja → finalizar → liberar operação',
      },
      null,
      2,
    ),
  );
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ ok: false, error: e.message, detail: e.detail || null }));
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
