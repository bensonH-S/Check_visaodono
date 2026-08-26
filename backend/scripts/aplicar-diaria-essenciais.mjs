/**
 * Recalcula a diária pelas regras atuais (essenciais) em todas as lojas.
 *
 *   node backend/scripts/aplicar-diaria-essenciais.mjs --dry-run
 *   node backend/scripts/aplicar-diaria-essenciais.mjs --yes --db=prod
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import { flagsContagemDiaria } from '../src/services/estoqueContagem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const dryRun = args.includes('--dry-run');
const dbFlag = args.find((a) => a.startsWith('--db='))?.slice(5) || 'prod';
const DB_NAME =
  dbFlag === 'dev'
    ? 'vision_check_dev'
    : dbFlag === 'prod'
      ? 'vision_check'
      : dbFlag;

if (!yes && !dryRun) {
  console.error('Use --dry-run ou --yes');
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});

await client.connect();
try {
  const { rows } = await client.query(
    `SELECT id_insumo, id_loja, descricao, contagem_diaria, grupo_diario
     FROM insumos
     WHERE ativo = TRUE`,
  );

  const porGrupo = new Map();
  const updates = [];
  for (const r of rows) {
    const next = flagsContagemDiaria(r.descricao);
    const era = r.contagem_diaria === true;
    const grupoAntes = r.grupo_diario || null;
    if (era === next.contagem_diaria && grupoAntes === next.grupo_diario) continue;
    updates.push({
      id_insumo: r.id_insumo,
      diaria: next.contagem_diaria,
      grupo: next.grupo_diario,
    });
    if (next.contagem_diaria) {
      const k = next.grupo_diario || 'outros';
      porGrupo.set(k, (porGrupo.get(k) || 0) + 1);
    }
  }

  console.log(`banco=${DB_NAME} insumos=${rows.length} a_alterar=${updates.length}`);
  for (const [g, n] of [...porGrupo.entries()].sort()) {
    console.log(`  ${g}: ${n} (novos/reclassificados neste lote)`);
  }

  if (dryRun || !updates.length) {
    const amostra = updates.slice(0, 20);
    for (const u of amostra) {
      const row = rows.find((r) => r.id_insumo === u.id_insumo);
      console.log(
        `  ${u.diaria ? 'IN' : 'OUT'}  ${(row?.descricao || '').slice(0, 60)}  → ${u.grupo || '-'}`,
      );
    }
    if (dryRun) {
      console.log('dry-run: nada gravado');
      process.exit(0);
    }
  }

  await client.query('BEGIN');
  await client.query('ALTER TABLE insumos DROP CONSTRAINT IF EXISTS insumos_grupo_diario_check');
  await client.query(`
    ALTER TABLE insumos
      ADD CONSTRAINT insumos_grupo_diario_check
      CHECK (
        grupo_diario IS NULL
        OR grupo_diario IN (
          'carne', 'frango', 'queijo', 'bacon', 'pao', 'batata', 'oleo', 'refil',
          'vegetais', 'mix_sobremesa'
        )
      )
  `);

  for (const u of updates) {
    await client.query(
      `UPDATE insumos
       SET contagem_diaria = $2, grupo_diario = $3, atualizado_em = NOW()
       WHERE id_insumo = $1`,
      [u.id_insumo, u.diaria, u.grupo],
    );
  }

  const rem = await client.query(`
    DELETE FROM estoque_itens i
    USING estoque_contagens c, insumos p
    WHERE i.id_contagem = c.id_contagem
      AND i.id_insumo = p.id_insumo
      AND c.status = 'aberta'
      AND COALESCE(c.tipo, '') = 'diaria'
      AND COALESCE(p.contagem_diaria, FALSE) = FALSE
  `);
  const add = await client.query(`
    INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
    SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
    FROM estoque_contagens c
    JOIN insumos p
      ON p.id_loja = c.id_loja AND p.ativo = TRUE AND p.contagem_diaria = TRUE
    LEFT JOIN estoque_saldos s
      ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
    WHERE c.status = 'aberta'
      AND COALESCE(c.tipo, '') = 'diaria'
      AND NOT EXISTS (
        SELECT 1 FROM estoque_itens x
        WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
      )
  `);

  await client.query('COMMIT');
  console.log(`ok gravado updates=${updates.length} abertas_removidos=${rem.rowCount} abertas_incluidos=${add.rowCount}`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
