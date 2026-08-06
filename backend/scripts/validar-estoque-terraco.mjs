/**
 * Patch rápido: valida schema e roda validação Terraço.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });
process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';
const { pool } = await import('../src/db.js');
const { processarVenda } = await import('../src/services/estoqueMotor.js');

const ID_LOJA = 21;
const aplicarVenda = process.argv.includes('--aplicar-venda-teste');

function cols(table) {
  return pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY 1`,
    [table],
  );
}

const { rows: resumo } = await pool.query(
  `
  SELECT
    (SELECT COUNT(*)::int FROM insumos WHERE id_loja=$1 AND ativo) AS insumos_ativos,
    (SELECT COUNT(*)::int FROM insumos WHERE id_loja=$1 AND ativo AND custo_fonte='nf') AS custo_nf,
    (SELECT COUNT(*)::int FROM insumos WHERE id_loja=$1 AND ativo AND custo_fonte='manual') AS custo_manual,
    (SELECT COUNT(*)::int FROM insumos WHERE id_loja=$1 AND ativo
      AND custo_fonte IS DISTINCT FROM 'nf' AND custo_fonte IS DISTINCT FROM 'manual') AS sem_custo,
    (SELECT COUNT(*)::int FROM produtos WHERE id_loja=$1 AND ativo) AS produtos,
    (SELECT COUNT(*)::int FROM produtos p
      JOIN ficha_tecnica f ON f.id_produto=p.id_produto AND f.ativo
      WHERE p.id_loja=$1 AND p.ativo) AS com_ficha,
    (SELECT COUNT(*)::int FROM produtos p
      LEFT JOIN ficha_tecnica f ON f.id_produto=p.id_produto AND f.ativo
      WHERE p.id_loja=$1 AND p.ativo AND f.id_ficha IS NULL AND COALESCE(p.requer_ficha,true)) AS sem_ficha,
    (SELECT COUNT(*)::int FROM estoque_contagens WHERE id_loja=$1) AS contagens
`,
  [ID_LOJA],
);
console.log('=== RESUMO TERRAÇO ===');
console.table(resumo);

const { rows: amostraCusto } = await pool.query(
  `
  SELECT codigo, LEFT(descricao,40) AS desc, custo_fonte,
         ROUND(preco_caixa::numeric,2) AS preco_caixa,
         ROUND(COALESCE(valor_unidade,0)::numeric,4) AS valor_un
  FROM insumos
  WHERE id_loja=$1 AND ativo AND custo_fonte IN ('nf','manual')
  ORDER BY custo_fonte, descricao
  LIMIT 8
`,
  [ID_LOJA],
);
console.log('=== AMOSTRA CUSTOS (visíveis no app) ===');
console.table(amostraCusto);

const { rows: fichas } = await pool.query(
  `
  SELECT p.codigo, LEFT(p.descricao,35) AS produto, COUNT(i.*)::int AS comps,
         ROUND(SUM(
           CASE WHEN ins.custo_fonte IN ('nf','manual')
             THEN COALESCE(i.qtde_estoque,0) * COALESCE(ins.valor_unidade,0)
             ELSE 0 END
         )::numeric, 2) AS custo_teorico
  FROM produtos p
  JOIN ficha_tecnica f ON f.id_produto=p.id_produto AND f.ativo
  JOIN ficha_tecnica_itens i ON i.id_ficha=f.id_ficha
  LEFT JOIN insumos ins ON ins.id_loja=p.id_loja AND UPPER(ins.codigo)=UPPER(i.codigo_insumo)
  WHERE p.id_loja=$1 AND p.codigo = ANY($2::text[])
  GROUP BY 1,2 ORDER BY 1
`,
  [ID_LOJA, ['1050', '2100', '6012']],
);
console.log('=== FICHAS AMOSTRA ===');
console.table(fichas);

const { rows: cont } = await pool.query(
  `
  SELECT id_contagem, data_contagem, titulo, status,
    (SELECT COUNT(*)::int FROM estoque_itens ei WHERE ei.id_contagem=c.id_contagem) AS itens
  FROM estoque_contagens c WHERE id_loja=$1
  ORDER BY id_contagem DESC LIMIT 3
`,
  [ID_LOJA],
);
console.log('=== CONTAGENS ===');
console.table(cont);

const { rows: gaps } = await pool.query(
  `
  SELECT COUNT(*)::int AS linhas_ficha_sem_insumo,
         COUNT(DISTINCT i.codigo_insumo)::int AS codigos_faltando
  FROM ficha_tecnica_itens i
  JOIN ficha_tecnica f ON f.id_ficha=i.id_ficha AND f.ativo
  JOIN produtos p ON p.id_produto=f.id_produto AND p.id_loja=$1 AND p.ativo
  LEFT JOIN insumos ins ON ins.id_loja=$1 AND UPPER(ins.codigo)=UPPER(i.codigo_insumo) AND ins.ativo
  WHERE ins.id_insumo IS NULL
`,
  [ID_LOJA],
);
console.log('=== GAPS FICHA×INSUMO ===');
console.table(gaps);

if (!aplicarVenda) {
  console.log('\nOK validação leitura. Para baixa teste: --aplicar-venda-teste');
  await pool.end();
  process.exit(0);
}

const vCols = new Set((await cols('estoque_vendas')).rows.map((r) => r.column_name));
const iCols = new Set((await cols('estoque_venda_itens')).rows.map((r) => r.column_name));
console.log('estoque_vendas cols:', [...vCols].join(', '));
console.log('estoque_venda_itens cols:', [...iCols].join(', '));

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const { rows: comps } = await client.query(
    `
    SELECT DISTINCT ins.id_insumo
    FROM produtos p
    JOIN ficha_tecnica f ON f.id_produto=p.id_produto AND f.ativo
    JOIN ficha_tecnica_itens i ON i.id_ficha=f.id_ficha
    JOIN insumos ins ON ins.id_loja=p.id_loja AND UPPER(ins.codigo)=UPPER(i.codigo_insumo)
    WHERE p.id_loja=$1 AND p.codigo='1050'
  `,
    [ID_LOJA],
  );
  for (const c of comps) {
    await client.query(
      `INSERT INTO estoque_saldos (id_loja, id_insumo, quantidade, atualizado_em)
       VALUES ($1,$2,100,NOW())
       ON CONFLICT (id_loja, id_insumo) DO UPDATE SET
         quantidade = GREATEST(estoque_saldos.quantidade, 10),
         atualizado_em = NOW()`,
      [ID_LOJA, c.id_insumo],
    );
  }

  // Monta INSERT adaptativo
  const vFields = ['id_loja', 'data_venda'];
  const vVals = [ID_LOJA, new Date().toISOString().slice(0, 10)];
  if (vCols.has('origem')) {
    vFields.push('origem');
    vVals.push('manual');
  }
  if (vCols.has('fonte')) {
    vFields.push('fonte');
    vVals.push('teste');
  }
  if (vCols.has('observacao')) {
    vFields.push('observacao');
    vVals.push('venda teste WHOPPER x1');
  }
  if (vCols.has('status')) {
    vFields.push('status');
    vVals.push('pendente');
  }
  if (vCols.has('criado_em')) {
    vFields.push('criado_em');
    vVals.push(new Date().toISOString());
  }

  const ph = vVals.map((_, i) => `$${i + 1}`).join(',');
  const { rows: venda } = await client.query(
    `INSERT INTO estoque_vendas (${vFields.join(',')}) VALUES (${ph}) RETURNING id_venda`,
    vVals,
  );
  const idVenda = venda[0].id_venda;

  const iFields = ['id_venda', 'codigo', 'descricao', 'qtde'];
  const iVals = [idVenda, '1050', 'WHOPPER/Q', 1];
  if (iCols.has('processado')) {
    iFields.push('processado');
    iVals.push(false);
  }
  const iph = iVals.map((_, i) => `$${i + 1}`).join(',');
  await client.query(
    `INSERT INTO estoque_venda_itens (${iFields.join(',')}) VALUES (${iph})`,
    iVals,
  );
  await client.query('COMMIT');

  const result = await processarVenda(idVenda);
  console.log('=== VENDA TESTE 1050 ===');
  console.log(result);

  const { rows: movs } = await pool.query(
    `
    SELECT m.tipo, LEFT(ins.descricao,40) AS insumo, m.quantidade, m.saldo_apos
    FROM estoque_movimentos m
    JOIN insumos ins ON ins.id_insumo=m.id_insumo
    WHERE m.id_loja=$1 AND m.referencia_id IN (
      SELECT id_item FROM estoque_venda_itens WHERE id_venda=$2
    )
    ORDER BY ins.descricao
  `,
    [ID_LOJA, idVenda],
  );
  console.log('Movimentos gerados:', movs.length);
  console.table(movs.slice(0, 20));
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERRO venda teste:', e.message);
  throw e;
} finally {
  client.release();
  await pool.end();
}
