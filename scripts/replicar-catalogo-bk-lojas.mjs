/**
 * Replica produtos + fichas + insumos da loja modelo TERRAÇO (id=21)
 * para lojas Burger King (exclui Popeyes, Delivery e GA).
 *
 *   node scripts/replicar-catalogo-bk-lojas.mjs --db=both --yes
 */
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: 'backend/.env', override: true });

const LOJA_MODELO = 21; // BURGER KING - TERRAÇO SHOPPING
const yes = process.argv.includes('--yes');
const dbArg = (process.argv.find((a) => a.startsWith('--db=')) || '--db=both').slice(5);
const databases =
  dbArg === 'dev'
    ? ['vision_check_dev']
    : dbArg === 'prod'
      ? ['vision_check']
      : ['vision_check_dev', 'vision_check'];

if (!yes) {
  console.error('Use --yes para confirmar. Ex.: node scripts/replicar-catalogo-bk-lojas.mjs --db=both --yes');
  process.exit(1);
}

function client(db) {
  return new pg.Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: db,
    port: Number(process.env.DB_PORT || 5432),
  });
}

async function replicar(dbName) {
  const c = client(dbName);
  await c.connect();
  console.log(`\n=== ${dbName} ===`);

  const modelo = await c.query(
    `SELECT
       (SELECT COUNT(*)::int FROM produtos WHERE id_loja=$1) AS produtos,
       (SELECT COUNT(*)::int FROM insumos WHERE id_loja=$1) AS insumos,
       (SELECT COUNT(*)::int FROM ficha_tecnica ft
          JOIN produtos p ON p.id_produto=ft.id_produto WHERE p.id_loja=$1) AS fichas
     `,
    [LOJA_MODELO],
  );
  console.log('Modelo loja Terraço (21):', modelo.rows[0]);

  const { rows: alvos } = await c.query(
    `
    SELECT id_loja, name
    FROM lojas
    WHERE id_loja <> $1
      AND COALESCE(is_active, TRUE) = TRUE
      AND name ILIKE '%burger king%'
      AND name NOT ILIKE '%popy%'
      AND name NOT ILIKE '%popeye%'
      AND name NOT ILIKE '%delivery%'
      AND name NOT ILIKE '%assessoria%'
    ORDER BY id_loja
    `,
    [LOJA_MODELO],
  );
  console.log(
    'Lojas destino:',
    alvos.length,
    alvos.map((l) => `${l.id_loja}:${l.name}`).join(' | '),
  );

  await c.query('BEGIN');
  try {
    for (const loja of alvos) {
      const id = loja.id_loja;

      // Insumos
      const ins = await c.query(
        `
        INSERT INTO insumos (
          codigo, descricao, id_loja, unidade_contagem, preco_caixa,
          und_convertida, ativo, criado_em, atualizado_em
        )
        SELECT
          i.codigo, i.descricao, $1, i.unidade_contagem, i.preco_caixa,
          i.und_convertida, i.ativo, NOW(), NOW()
        FROM insumos i
        WHERE i.id_loja = $2
        ON CONFLICT (id_loja, codigo) DO UPDATE SET
          descricao = EXCLUDED.descricao,
          unidade_contagem = EXCLUDED.unidade_contagem,
          preco_caixa = EXCLUDED.preco_caixa,
          und_convertida = EXCLUDED.und_convertida,
          ativo = EXCLUDED.ativo,
          atualizado_em = NOW()
        `,
        [id, LOJA_MODELO],
      );

      // Produtos
      const prod = await c.query(
        `
        INSERT INTO produtos (
          codigo, descricao, id_loja, ativo, requer_ficha, preco_venda, criado_em, atualizado_em
        )
        SELECT
          p.codigo, p.descricao, $1, p.ativo, COALESCE(p.requer_ficha, TRUE), p.preco_venda, NOW(), NOW()
        FROM produtos p
        WHERE p.id_loja = $2
        ON CONFLICT (id_loja, codigo) DO UPDATE SET
          descricao = EXCLUDED.descricao,
          ativo = EXCLUDED.ativo,
          requer_ficha = EXCLUDED.requer_ficha,
          preco_venda = EXCLUDED.preco_venda,
          atualizado_em = NOW()
        `,
        [id, LOJA_MODELO],
      );

      // Fichas: remove e recria a partir do modelo (evita drift)
      await c.query(
        `
        DELETE FROM ficha_tecnica_itens
        WHERE id_ficha IN (
          SELECT ft.id_ficha FROM ficha_tecnica ft
          JOIN produtos p ON p.id_produto = ft.id_produto
          WHERE p.id_loja = $1
        )
        `,
        [id],
      );
      await c.query(
        `
        DELETE FROM ficha_tecnica
        WHERE id_produto IN (SELECT id_produto FROM produtos WHERE id_loja = $1)
        `,
        [id],
      );

      const fichas = await c.query(
        `
        INSERT INTO ficha_tecnica (id_produto, ativo, observacao, criado_em, atualizado_em)
        SELECT dest.id_produto, fm.ativo, fm.observacao, NOW(), NOW()
        FROM produtos origem
        JOIN ficha_tecnica fm ON fm.id_produto = origem.id_produto AND fm.ativo = TRUE
        JOIN produtos dest ON dest.id_loja = $1 AND dest.codigo = origem.codigo
        WHERE origem.id_loja = $2
        RETURNING id_ficha, id_produto
        `,
        [id, LOJA_MODELO],
      );

      // Itens da ficha via join por codigo do produto
      const itens = await c.query(
        `
        INSERT INTO ficha_tecnica_itens (
          id_ficha, codigo_insumo, quantidade, observacao, unidade_receita, qtde_estoque
        )
        SELECT
          ftd.id_ficha,
          fi.codigo_insumo,
          fi.quantidade,
          fi.observacao,
          fi.unidade_receita,
          fi.qtde_estoque
        FROM produtos origem
        JOIN ficha_tecnica fm ON fm.id_produto = origem.id_produto AND fm.ativo = TRUE
        JOIN ficha_tecnica_itens fi ON fi.id_ficha = fm.id_ficha
        JOIN produtos dest ON dest.id_loja = $1 AND dest.codigo = origem.codigo
        JOIN ficha_tecnica ftd ON ftd.id_produto = dest.id_produto AND ftd.ativo = TRUE
        WHERE origem.id_loja = $2
        `,
        [id, LOJA_MODELO],
      );

      console.log(
        `  → ${loja.name}: insumos+${ins.rowCount}, produtos+${prod.rowCount}, fichas=${fichas.rowCount}, itens=${itens.rowCount}`,
      );
    }

    await c.query('COMMIT');

    const resumo = await c.query(`
      SELECT l.id_loja, l.name,
        (SELECT COUNT(*)::int FROM produtos p WHERE p.id_loja=l.id_loja AND p.ativo) AS produtos_ativos,
        (SELECT COUNT(*)::int FROM insumos i WHERE i.id_loja=l.id_loja AND i.ativo) AS insumos_ativos,
        (SELECT COUNT(*)::int FROM ficha_tecnica ft
           JOIN produtos p ON p.id_produto=ft.id_produto
          WHERE p.id_loja=l.id_loja AND ft.ativo) AS fichas
      FROM lojas l
      WHERE COALESCE(l.is_active, TRUE)
      ORDER BY l.id_loja
    `);
    console.log('Resumo:');
    console.table(resumo.rows);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
}

for (const db of databases) {
  await replicar(db);
}
console.log('\nConcluído.');
