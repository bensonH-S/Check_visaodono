/**
 * Reset operacional: zera saldos + cancela contagens abertas.
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
  const { rows: abertas } = await client.query(`
    SELECT COUNT(*)::int AS n FROM estoque_contagens WHERE status = 'aberta'
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
    SELECT COUNT(*)::int AS n FROM estoque_break
  `);

  console.log(
    JSON.stringify(
      {
        modo: apply ? 'APPLY' : 'DRY-RUN',
        mantem: 'estoque_break (+ itens) — break, desperdício, empréstimo',
        contagens_abertas: abertas[0].n,
        saldos_linhas: saldos[0].n,
        saldos_abs_qtd: saldos[0].abs_qtd,
        breaks_total: breaks[0].n,
        emprestimos_pendentes_receber: pendEmp[0].n,
        aviso:
          'Depois do apply: abrir contagem COMPLETA em cada loja e finalizar. Empréstimos pendentes: cancelar ou confirmar com cuidado.',
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

  // Cancela abertas (remove itens + cabeçalho) — não mexe em finalizadas históricas
  const delItens = await client.query(`
    DELETE FROM estoque_itens
    WHERE id_contagem IN (SELECT id_contagem FROM estoque_contagens WHERE status = 'aberta')
  `);
  const delCont = await client.query(`
    DELETE FROM estoque_contagens WHERE status = 'aberta'
  `);

  const zeroSaldo = await client.query(`
    UPDATE estoque_saldos SET quantidade = 0, atualizado_em = NOW()
    WHERE ABS(quantidade) > 0
  `);

  // Empréstimos ainda pendentes de recebimento da era bugada → cancelados
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        itens_contagem_apagados: delItens.rowCount,
        contagens_abertas_apagadas: delCont.rowCount,
        saldos_zerados: zeroSaldo.rowCount,
        emprestimos_pendentes_cancelados: cancelEmp.rowCount,
        breaks_preservados: true,
        proximo: 'Contagem completa por loja → finalizar → liberar operação',
      },
      null,
      2,
    ),
  );
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
