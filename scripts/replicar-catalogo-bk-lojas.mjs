/**
 * Lista de contagem = planilha Terraço 01/08, com dois ajustes:
 *   - mix Pepsi/BEG → bags Coca/Fanta/Sprite
 *   - carnes do Plínio (gourmet / fraldinha) fora
 * Popeyes fica sem produto. GA/Delivery não mexe.
 *
 *   node scripts/replicar-catalogo-bk-lojas.mjs --db=both --dry-run
 *   node scripts/replicar-catalogo-bk-lojas.mjs --db=both --yes
 */
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: 'backend/.env', override: true });

const LOJA_MODELO = 21;
const yes = process.argv.includes('--yes');
const dryRun = process.argv.includes('--dry-run');
const dbArg = (process.argv.find((a) => a.startsWith('--db=')) || '--db=both').slice(5);
const databases =
  dbArg === 'dev'
    ? ['vision_check_dev']
    : dbArg === 'prod'
      ? ['vision_check']
      : ['vision_check_dev', 'vision_check'];

if (!yes && !dryRun) {
  console.error('Use --yes ou --dry-run.');
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

const SQL_TIPO = `
  CASE
    WHEN name ILIKE '%popy%' OR name ILIKE '%popeye%' THEN 'popeyes'
    WHEN name ILIKE '%delivery%' OR name ILIKE '%assessoria%'
      OR name ILIKE 'GA %' OR name ILIKE 'GA -%' THEN 'outros'
    WHEN name ILIKE '%burger king%' THEN 'bk'
    ELSE 'outros'
  END
`;

const SQL_FORA = `
  descricao ~* 'PEPSI|LIPTON|SUKITA|SODA LIMONADA|ANTAR'
  OR descricao ~* 'GOURMET'
  OR descricao ~* 'FRALDINHA|FRANDINHA'
  OR descricao ~* 'PAO BRIOCHE BK CX 270'
  OR codigo IN ('021403', 'TRC-PAOBRIOCHEBKCX270U', '14321', '038585', '034754')
`;

async function codigosPermitidos(c) {
  const { rows } = await c.query(
    `
    SELECT DISTINCT codigo FROM (
      SELECT i.codigo
      FROM estoque_itens ei
      JOIN estoque_contagens c ON c.id_contagem = ei.id_contagem
      JOIN insumos i ON i.id_insumo = ei.id_insumo
      WHERE c.id_loja = $1
        AND c.data_contagem = DATE '2026-08-01'
        AND NOT (${SQL_FORA})
      UNION
      SELECT i.codigo
      FROM insumos i
      WHERE i.id_loja = $1
        AND i.descricao ~* 'BAG'
        AND i.descricao ~* 'COCA|SPRITE|FANTA'
        AND i.descricao !~* 'MAIONESE|BARBECUE|MOLHO|BRINDE'
    ) x
    WHERE codigo IS NOT NULL AND btrim(codigo) <> ''
    `,
    [LOJA_MODELO],
  );
  return rows.map((r) => r.codigo);
}

async function limparAbertas(c, idLoja) {
  const { rowCount } = await c.query(
    `
    DELETE FROM estoque_itens ei
    USING estoque_contagens c, insumos i
    WHERE ei.id_contagem = c.id_contagem
      AND ei.id_insumo = i.id_insumo
      AND c.id_loja = $1
      AND c.status = 'aberta'
      AND i.ativo = FALSE
    `,
    [idLoja],
  );
  return rowCount || 0;
}

async function aplicarLojaBk(c, idLoja, codigos) {
  await c.query(
    `
    INSERT INTO insumos (
      codigo, descricao, id_loja, unidade_contagem, preco_caixa,
      und_convertida, und_parcial, ativo, criado_em, atualizado_em,
      contagem_critica, grupo_critico, contagem_diaria, grupo_diario,
      secao_contagem, ordem_contagem,
      permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und, entra_cmv
    )
    SELECT
      i.codigo, i.descricao, $1, i.unidade_contagem, i.preco_caixa,
      i.und_convertida, i.und_parcial, TRUE, NOW(), NOW(),
      i.contagem_critica, i.grupo_critico, i.contagem_diaria, i.grupo_diario,
      i.secao_contagem, i.ordem_contagem,
      i.permite_contagem_caixa, i.permite_contagem_pc_fd, i.permite_contagem_kg_und, i.entra_cmv
    FROM insumos i
    WHERE i.id_loja = $2
      AND i.codigo = ANY($3::text[])
    ON CONFLICT (id_loja, codigo) DO UPDATE SET
      descricao = EXCLUDED.descricao,
      unidade_contagem = EXCLUDED.unidade_contagem,
      und_convertida = EXCLUDED.und_convertida,
      und_parcial = EXCLUDED.und_parcial,
      ativo = TRUE,
      contagem_critica = EXCLUDED.contagem_critica,
      grupo_critico = EXCLUDED.grupo_critico,
      contagem_diaria = EXCLUDED.contagem_diaria,
      grupo_diario = EXCLUDED.grupo_diario,
      secao_contagem = EXCLUDED.secao_contagem,
      ordem_contagem = EXCLUDED.ordem_contagem,
      permite_contagem_caixa = EXCLUDED.permite_contagem_caixa,
      permite_contagem_pc_fd = EXCLUDED.permite_contagem_pc_fd,
      permite_contagem_kg_und = EXCLUDED.permite_contagem_kg_und,
      entra_cmv = EXCLUDED.entra_cmv,
      preco_caixa = CASE
        WHEN insumos.custo_fonte IN ('nf', 'manual') THEN insumos.preco_caixa
        ELSE EXCLUDED.preco_caixa
      END,
      atualizado_em = NOW()
    `,
    [idLoja, LOJA_MODELO, codigos],
  );

  const extras = await c.query(
    `
    UPDATE insumos
    SET ativo = FALSE,
        contagem_diaria = FALSE,
        contagem_critica = FALSE,
        atualizado_em = NOW()
    WHERE id_loja = $1
      AND ativo = TRUE
      AND codigo <> ALL($2::text[])
    `,
    [idLoja, codigos],
  );

  const abertas = await limparAbertas(c, idLoja);
  const { rows } = await c.query(
    `SELECT COUNT(*)::int AS n FROM insumos WHERE id_loja=$1 AND ativo`,
    [idLoja],
  );
  return { ativos: rows[0].n, extras: extras.rowCount || 0, abertas };
}

async function zerarPopeyes(c, idLoja) {
  const ins = await c.query(
    `UPDATE insumos SET ativo=FALSE, contagem_diaria=FALSE, contagem_critica=FALSE, atualizado_em=NOW()
     WHERE id_loja=$1 AND ativo=TRUE`,
    [idLoja],
  );
  const prod = await c.query(
    `UPDATE produtos SET ativo=FALSE, atualizado_em=NOW() WHERE id_loja=$1 AND ativo=TRUE`,
    [idLoja],
  );
  const abertas = await limparAbertas(c, idLoja);
  return { insumos: ins.rowCount || 0, produtos: prod.rowCount || 0, abertas };
}

async function replicar(dbName) {
  const c = client(dbName);
  await c.connect();
  console.log(`\n=== ${dbName}${dryRun ? ' (dry-run)' : ''} ===`);
  try {
    const { rows: lojas } = await c.query(
      `SELECT id_loja, name, (${SQL_TIPO}) AS tipo
       FROM lojas WHERE COALESCE(is_active, TRUE) ORDER BY id_loja`,
    );
    const codigos = await codigosPermitidos(c);
    console.log('Lista planilha 01/08 + Coca − carnes Plínio:', codigos.length);

    if (dryRun) {
      for (const l of lojas.filter((x) => x.tipo === 'bk')) {
        const { rows } = await c.query(
          `SELECT
             COUNT(*) FILTER (WHERE ativo)::int AS ativos,
             COUNT(*) FILTER (WHERE ativo AND codigo <> ALL($2::text[]))::int AS sobram
           FROM insumos WHERE id_loja=$1`,
          [l.id_loja, codigos],
        );
        console.log(`  ${l.name}: hoje ${rows[0].ativos} → ${codigos.length} (tira ${rows[0].sobram})`);
      }
      const pops = lojas.filter((x) => x.tipo === 'popeyes');
      for (const l of pops) {
        const { rows } = await c.query(
          `SELECT COUNT(*) FILTER (WHERE ativo)::int AS n FROM insumos WHERE id_loja=$1`,
          [l.id_loja],
        );
        console.log(`  ${l.name}: Popeyes sem produto (hoje ${rows[0].n})`);
      }
      return;
    }

    await c.query('BEGIN');
    try {
      for (const l of lojas.filter((x) => x.tipo === 'bk')) {
        const r = await aplicarLojaBk(c, l.id_loja, codigos);
        console.log(`  ${l.name}: ${r.ativos} itens (tirou ${r.extras}, abertas -${r.abertas})`);
      }
      for (const l of lojas.filter((x) => x.tipo === 'popeyes')) {
        const r = await zerarPopeyes(c, l.id_loja);
        console.log(`  ${l.name}: zerado (insumos -${r.insumos}, produtos -${r.produtos})`);
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }
  } finally {
    await c.end();
  }
}

for (const db of databases) await replicar(db);
console.log(dryRun ? '\nDry-run ok.' : '\nConcluído.');
