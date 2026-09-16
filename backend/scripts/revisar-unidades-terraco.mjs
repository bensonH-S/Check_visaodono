/**
 * Foto + saneamento de UN vs KG só no Terraço (loja 21 / BKN 30797).
 *
 *   node backend/scripts/revisar-unidades-terraco.mjs --db=prod --yes
 *   node backend/scripts/revisar-unidades-terraco.mjs --db=prod --yes --apply
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';
import { classificarCasoRevisaoUnidade } from '../src/services/estoqueContagem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
const apply = args.includes('--apply');
const forceProd = args.includes('--yes') || args.includes('--force-prod');
const dbFlag = getArg('--db', 'dev');
const DB_NAME =
  dbFlag === 'prod'
    ? process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check'
    : process.env.DB_NAME_DEV || 'vision_check_dev';

if (dbFlag === 'prod' || (!/dev/i.test(String(DB_NAME)) && dbFlag !== 'dev')) {
  if (!forceProd) {
    console.error('ABORT: produção exige --yes. DB:', DB_NAME);
    process.exit(1);
  }
}

const BK_TERRACO = '30797';

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl:
    process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
      ? { rejectUnauthorized: false }
      : undefined,
});

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

try {
  const { rows: lojaRows } = await pool.query(
    `SELECT id_loja, name, bk_number
     FROM lojas
     WHERE TRIM(COALESCE(bk_number, '')) = $1
        OR name ILIKE '%TERRA%O%'
     ORDER BY CASE WHEN TRIM(COALESCE(bk_number, '')) = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [BK_TERRACO],
  );
  const loja = lojaRows[0];
  if (!loja) {
    console.error('Loja Terraço não encontrada.');
    process.exit(1);
  }
  const idLoja = loja.id_loja;
  console.log(`Loja ${loja.name} id=${idLoja} bkn=${loja.bk_number} db=${DB_NAME}`);

  const { rows: insumos } = await pool.query(
    `SELECT i.id_insumo, i.codigo, i.descricao, i.secao_contagem,
            i.unidade_contagem,
            COALESCE(NULLIF(BTRIM(i.unidade_fracionada), ''), i.unidade_contagem) AS unidade_fracionada,
            i.und_convertida, i.und_parcial, i.participa_contagem, i.contagem_diaria
     FROM insumos i
     WHERE i.id_loja = $1
       AND i.ativo = TRUE
       AND COALESCE(i.participa_contagem, TRUE) = TRUE
     ORDER BY i.descricao`,
    [idLoja],
  );

  const { rows: diffs } = await pool.query(
    `WITH ultima AS (
       SELECT id_contagem
       FROM estoque_contagens
       WHERE id_loja = $1
         AND COALESCE(tipo, 'completa') = 'diaria'
         AND status = 'finalizada'
       ORDER BY COALESCE(contado_em, finalizado_em, data_contagem::timestamptz) DESC NULLS LAST,
                id_contagem DESC
       LIMIT 1
     )
     SELECT p.codigo, p.descricao,
            i.estoque_sistema, i.estoque_contado,
            (i.estoque_contado - COALESCE(i.estoque_sistema, 0)) AS diff
     FROM ultima u
     JOIN estoque_itens i ON i.id_contagem = u.id_contagem
     JOIN insumos p ON p.id_insumo = i.id_insumo
     WHERE i.estoque_contado IS NOT NULL
       AND i.estoque_contado IS DISTINCT FROM i.estoque_sistema`,
    [idLoja],
  );

  const diffPorCodigo = new Map();
  for (const d of diffs) {
    const k = String(d.codigo || '').trim().toUpperCase();
    const prev = diffPorCodigo.get(k) || { n: 0, abs: 0 };
    prev.n += 1;
    prev.abs += Math.abs(num(d.diff));
    diffPorCodigo.set(k, prev);
  }

  const linhas = insumos.map((r) => {
    const rev = classificarCasoRevisaoUnidade({
      descricao: r.descricao,
      unidade_contagem: r.unidade_contagem,
      unidade_fracionada: r.unidade_fracionada,
      und_convertida: r.und_convertida,
    });
    const k = String(r.codigo || '').trim().toUpperCase();
    const df = diffPorCodigo.get(k);
    return {
      codigo: r.codigo,
      descricao: r.descricao,
      secao: r.secao_contagem || '',
      saldo: rev.saldo,
      fracionada: rev.frac,
      sugerida: rev.sugerida,
      caso: rev.caso,
      und_cx: r.und_convertida,
      und_pc: r.und_parcial,
      diffs_ultima: df?.n || 0,
      abs_diff: df ? Math.round(df.abs * 1000) / 1000 : 0,
      id_insumo: r.id_insumo,
    };
  });

  const grupos = {
    peca_obvia: linhas.filter((l) => l.caso === 'peca_obvia'),
    litro_obvio: linhas.filter((l) => l.caso === 'litro_obvio'),
    peso_ok: linhas.filter((l) => l.caso === 'peso_ok'),
    manter_kg_und: linhas.filter((l) => l.caso === 'manter_kg_und'),
    duvida: linhas.filter((l) => l.caso === 'duvida'),
    ok: linhas.filter((l) => l.caso === 'ok'),
  };

  console.log(
    JSON.stringify(
      {
        total: linhas.length,
        peca_obvia: grupos.peca_obvia.length,
        litro_obvio: grupos.litro_obvio.length,
        peso_ok: grupos.peso_ok.length,
        manter_kg_und: grupos.manter_kg_und.length,
        duvida: grupos.duvida.length,
        ok: grupos.ok.length,
        diffs_ultima_diaria: diffs.length,
      },
      null,
      2,
    ),
  );

  const colunas = (lista) =>
    lista.map((l) => ({
      Codigo: l.codigo,
      Descricao: l.descricao,
      Secao: l.secao,
      Saldo: l.saldo,
      Contagem: l.fracionada,
      Sugerida: l.sugerida,
      Caso: l.caso,
      'Diffs ultima diaria': l.diffs_ultima,
      'Abs diff': l.abs_diff,
    }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colunas(grupos.peca_obvia)), 'Peca obvia');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colunas(grupos.litro_obvio)), 'Litro');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colunas(grupos.duvida)), 'Duvida');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colunas(grupos.peso_ok)), 'Peso ok');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(colunas(grupos.manter_kg_und)),
    'KG conta UND',
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colunas(linhas)), 'Todos');

  const outDir = path.join(root, 'Logs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'terraco-revisao-unidades.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log('planilha', outPath);

  const jsonPath = path.join(outDir, 'terraco-revisao-unidades.json');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        loja,
        resumo: {
          total: linhas.length,
          peca_obvia: grupos.peca_obvia.length,
          litro_obvio: grupos.litro_obvio.length,
          peso_ok: grupos.peso_ok.length,
          manter_kg_und: grupos.manter_kg_und.length,
          duvida: grupos.duvida.length,
          ok: grupos.ok.length,
          diffs_ultima_diaria: diffs.length,
        },
        peca_obvia: grupos.peca_obvia,
        litro_obvio: grupos.litro_obvio,
        duvida: grupos.duvida,
        peso_ok: grupos.peso_ok,
        manter_kg_und: grupos.manter_kg_und,
        diffs: diffs.map((d) => ({
          codigo: d.codigo,
          descricao: d.descricao,
          sistema: num(d.estoque_sistema),
          contado: num(d.estoque_contado),
          diff: Math.round(num(d.diff) * 1000) / 1000,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('dry-run. Passe --apply para gravar peça óbvia e litro só nesta loja.');
  } else {
    const idsPeca = grupos.peca_obvia.map((l) => l.id_insumo);
    const idsLitro = grupos.litro_obvio.map((l) => l.id_insumo);
    if (!idsPeca.length && !idsLitro.length) {
      console.log('nada para aplicar.');
    } else {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let nPeca = 0;
        let nLitro = 0;
        let nAbertas = 0;
        if (idsPeca.length) {
          const upd = await client.query(
            `UPDATE insumos
             SET unidade_contagem = 'UND',
                 unidade_fracionada = 'UND',
                 atualizado_em = NOW()
             WHERE id_loja = $1
               AND id_insumo = ANY($2::int[])
               AND UPPER(TRIM(unidade_contagem)) = 'KG'`,
            [idLoja, idsPeca],
          );
          nPeca = upd.rowCount;
          const abertas = await client.query(
            `UPDATE estoque_itens ei
             SET contagem_unidade_entrada = 'UND',
                 estoque_contado = ROUND((
                   COALESCE(ei.contagem_caixa, 0) * COALESCE(NULLIF(p.und_convertida, 0), 1)
                   + COALESCE(ei.contagem_pc_fd, 0) * COALESCE(NULLIF(p.und_parcial, 0), 1)
                   + COALESCE(ei.contagem_kg_und, 0)
                 )::numeric, 4)
             FROM insumos p, estoque_contagens c
             WHERE ei.id_insumo = p.id_insumo
               AND c.id_contagem = ei.id_contagem
               AND c.id_loja = $1
               AND c.status = 'aberta'
               AND p.id_insumo = ANY($2::int[])
               AND UPPER(TRIM(p.unidade_contagem)) = 'UND'
               AND UPPER(TRIM(COALESCE(ei.contagem_unidade_entrada, ''))) = 'KG'
               AND (
                 ei.contagem_caixa IS NOT NULL
                 OR ei.contagem_pc_fd IS NOT NULL
                 OR ei.contagem_kg_und IS NOT NULL
               )`,
            [idLoja, idsPeca],
          );
          nAbertas += abertas.rowCount;
        }
        if (idsLitro.length) {
          const upd = await client.query(
            `UPDATE insumos
             SET unidade_contagem = 'L',
                 unidade_fracionada = 'L',
                 atualizado_em = NOW()
             WHERE id_loja = $1
               AND id_insumo = ANY($2::int[])
               AND UPPER(TRIM(unidade_contagem)) = 'KG'`,
            [idLoja, idsLitro],
          );
          nLitro = upd.rowCount;
          const abertas = await client.query(
            `UPDATE estoque_itens ei
             SET contagem_unidade_entrada = 'L',
                 estoque_contado = ROUND((
                   COALESCE(ei.contagem_caixa, 0) * COALESCE(NULLIF(p.und_convertida, 0), 1)
                   + COALESCE(ei.contagem_pc_fd, 0) * COALESCE(NULLIF(p.und_parcial, 0), 1)
                   + COALESCE(ei.contagem_kg_und, 0)
                 )::numeric, 4)
             FROM insumos p, estoque_contagens c
             WHERE ei.id_insumo = p.id_insumo
               AND c.id_contagem = ei.id_contagem
               AND c.id_loja = $1
               AND c.status = 'aberta'
               AND p.id_insumo = ANY($2::int[])
               AND UPPER(TRIM(p.unidade_contagem)) = 'L'
               AND UPPER(TRIM(COALESCE(ei.contagem_unidade_entrada, ''))) IN ('KG', 'UND')
               AND (
                 ei.contagem_caixa IS NOT NULL
                 OR ei.contagem_pc_fd IS NOT NULL
                 OR ei.contagem_kg_und IS NOT NULL
               )`,
            [idLoja, idsLitro],
          );
          nAbertas += abertas.rowCount;
        }
        await client.query('COMMIT');
        console.log('aplicado peca', nPeca, 'litro', nLitro, 'itens abertos', nAbertas);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  }
} finally {
  await pool.end();
}
