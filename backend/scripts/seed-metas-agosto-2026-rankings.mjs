/**
 * Preenche rankings de agosto/2026: Delivery iFood, Delivery 99 Food, R.E.V., Google e Checklist 360.
 * Uso:
 *   node backend/scripts/seed-metas-agosto-2026-rankings.mjs --db=dev
 *   node backend/scripts/seed-metas-agosto-2026-rankings.mjs --db=prod --yes
 *   node backend/scripts/seed-metas-agosto-2026-rankings.mjs --db=both --yes
 */
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { carregarLojas, resolverLoja } from './metasLojaResolver.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });

const DB_DEV = process.env.DB_NAME_DEV || 'vision_check_dev';
const DB_PROD = process.env.DB_NAME_PROD || 'vision_check';
const ANO = 2026;
const MES = 8;

const DELIVERY_99 = [
  { pos: 1, rotulo: 'BK LAGO SUL', nota: 4.8, pontos: 10 },
  { pos: 2, rotulo: 'BK PLAZA', nota: 4.8, pontos: 8 },
  { pos: 3, rotulo: 'BK CEILANDIA', nota: 4.8, pontos: 7 },
  { pos: 4, rotulo: 'BK PLANALTINA', nota: 4.8, pontos: 6 },
  { pos: 5, rotulo: 'BK SOBRADINHO', nota: 4.8, pontos: 5 },
  { pos: 6, rotulo: 'BK NOROESTE', nota: 4.8, pontos: 4 },
  { pos: 7, rotulo: 'BK SAMAMBAIA', nota: 4.8, pontos: 3 },
  { pos: 8, rotulo: 'BK CALDAS NOVAS', na: true },
  { pos: 9, rotulo: 'BK UNAI', na: true },
  { pos: 10, rotulo: 'BK SÃO SEBASTIAO', na: true },
  { pos: 11, rotulo: 'POPEYES VAL', na: true },
  { pos: 12, rotulo: 'BK SUDOESTE', nota: 4.7 },
  { pos: 13, rotulo: 'BK 707 NORTE', nota: 4.7 },
  { pos: 14, rotulo: 'BK ASA SUL', nota: 4.7 },
  { pos: 15, rotulo: 'BK TERRAÇO', nota: 4.7 },
  { pos: 16, rotulo: 'BK PONTE ALTA', nota: 4.7 },
  { pos: 17, rotulo: 'BK ESTRUTURAL', nota: 4.7 },
  { pos: 18, rotulo: 'BK RECANTO', nota: 4.5 },
  { pos: 19, rotulo: 'BK VENANCIO', nota: 4.5, pontos: -3 },
  { pos: 20, rotulo: 'BK 201 NORTE', nota: 4.5 },
];

const DELIVERY_IFOOD = [
  { pos: 1, rotulo: 'BK CALDAS NOVAS', nota: 5.0, pontos: 10 },
  { pos: 2, rotulo: 'BK VENANCIO', nota: 5.0, pontos: 8 },
  { pos: 3, rotulo: 'BK SAMAMBAIA', nota: 4.91, pontos: 7 },
  { pos: 4, rotulo: 'BK SOBRADINHO', nota: 4.9, pontos: 6 },
  { pos: 5, rotulo: 'BK LAGO SUL', nota: 4.9, pontos: 5 },
  { pos: 6, rotulo: 'BK 201 NORTE', nota: 4.89, pontos: 4 },
  { pos: 7, rotulo: 'BK ESTRUTURAL', nota: 4.89, pontos: 3 },
  { pos: 8, rotulo: 'BK PLANALTINA', nota: 4.88 },
  { pos: 9, rotulo: 'BK CEILANDIA', nota: 4.87 },
  { pos: 10, rotulo: 'POPEYES VAL', nota: 4.82 },
  { pos: 11, rotulo: 'BK RECANTO', nota: 4.82 },
  { pos: 12, rotulo: 'BK 707 NORTE', nota: 4.82 },
  { pos: 13, rotulo: 'BK TERRAÇO', nota: 4.82 },
  { pos: 14, rotulo: 'BK PONTE ALTA', nota: 4.81 },
  { pos: 15, rotulo: 'BK UNAI', nota: 4.81 },
  { pos: 16, rotulo: 'BK SÃO SEBASTIAO', nota: 4.8 },
  { pos: 17, rotulo: 'BK NOROESTE', nota: 4.77 },
  { pos: 18, rotulo: 'BK SUDOESTE', nota: 4.77 },
  { pos: 19, rotulo: 'BK PLAZA', nota: 4.75 },
  { pos: 20, rotulo: 'BK ASA SUL', nota: 4.69, pontos: -3 },
];

const REV = [
  { pos: 1, rotulo: 'BK CEILANDIA', nota: 93.41, pontos: 10, critico: 0, faixa: 'C', classe: 'REV' },
  { pos: 2, rotulo: 'BK CALDAS', nota: 88.7, pontos: 8, critico: 0, faixa: 'C', classe: 'REV' },
  { pos: 3, rotulo: 'BK ESTRUTURAL', nota: 91.5, pontos: 7, critico: 1, faixa: 'C', classe: 'REV' },
  { pos: 4, rotulo: 'BK SÃO SEBASTIÃO', nota: 90.5, pontos: 6, critico: 1, faixa: 'C', classe: 'REV' },
  { pos: 5, rotulo: 'BK SUDOESTE', nota: 93.41, pontos: 5, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 6, rotulo: 'BK SOBRADINHO', nota: 85.62, pontos: 4, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 7, rotulo: 'BK 707 NORTE', nota: 79.57, pontos: 3, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 8, rotulo: 'BK SAMAMBAIA', nota: 79.0, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 9, rotulo: 'BK UNAI', nota: 75.84, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 10, rotulo: 'BK GILBERTO', nota: 87.08, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 11, rotulo: 'BK VENANCIO', nota: 84.31, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 12, rotulo: 'BK 201 NORTE', nota: 83.7, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 13, rotulo: 'BK PLANALTINA', nota: 83.33, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 14, rotulo: 'BK TERRAÇO', nota: 81.21, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 15, rotulo: 'BK RECANTO', nota: 76.67, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 16, rotulo: 'POPEYES VAL', nota: 76.15, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 17, rotulo: 'BK NOROESTE', nota: 75.51, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 18, rotulo: 'BK 408 SUL', nota: 69.23, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 19, rotulo: 'BK PONTE ALTA', nota: 78.57, critico: 4, faixa: 'C', classe: 'REV' },
  { pos: 20, rotulo: 'BK PLAZA', demanda: true, critico: 7, faixa: 'DEMANDA', classe: 'REV' },
];

const GOOGLE = [
  { pos: 1, rotulo: 'POPEYES VAL', nota: 4.8, pontos: 10 },
  { pos: 2, rotulo: 'BK SÃO SEBASTIAO', nota: 4.7, pontos: 8 },
  { pos: 3, rotulo: 'BK TERRAÇO', nota: 4.7, pontos: 7 },
  { pos: 4, rotulo: 'BK SAMAMBAIA', nota: 4.7, pontos: 6 },
  { pos: 5, rotulo: 'BK CALDAS NOVAS', nota: 4.6, pontos: 5 },
  { pos: 6, rotulo: 'BK PONTE ALTA', nota: 4.6, pontos: 4 },
  { pos: 7, rotulo: 'BK SOBRADINHO', nota: 4.6, pontos: 3 },
  { pos: 8, rotulo: 'BK NOROESTE', nota: 4.5 },
  { pos: 9, rotulo: 'BK VENANCIO', nota: 4.5 },
  { pos: 10, rotulo: 'BK ESTRUTURAL', nota: 4.5 },
  { pos: 11, rotulo: 'BK UNAI', nota: 4.5 },
  { pos: 12, rotulo: 'BK PLANALTINA', nota: 4.4 },
  { pos: 13, rotulo: 'BK RECANTO', nota: 4.4 },
  { pos: 14, rotulo: 'BK PLAZA', nota: 4.3 },
  { pos: 15, rotulo: 'BK CEILANDIA', nota: 4.3 },
  { pos: 16, rotulo: 'BK SUDOESTE', nota: 4.1 },
  { pos: 17, rotulo: 'BK 707 NORTE', nota: 4.1 },
  { pos: 18, rotulo: 'BK LAGO SUL', nota: 4.1 },
  { pos: 19, rotulo: 'BK ASA SUL', nota: 4.1 },
  { pos: 20, rotulo: 'BK 201 NORTE', nota: 4.0 },
];

const CHECKLIST_360 = [
  { pos: 1, rotulo: 'BK CALDAS NOVAS', nota: 80 },
  { pos: 2, rotulo: 'BK PLANALTINA', nota: 77 },
  { pos: 3, rotulo: 'BK SÃO SEBASTIAO', nota: 76 },
  { pos: 4, rotulo: 'BK 201 NORTE', nota: 73 },
  { pos: 5, rotulo: 'BK UNAI', nota: 71 },
  { pos: 6, rotulo: 'BK PONTE ALTA', nota: 71 },
  { pos: 7, rotulo: 'BK ESTRUTURAL', nota: 63 },
  { pos: 8, rotulo: 'BK 707 NORTE', nota: 57 },
  { pos: 9, rotulo: 'BK SOBRADINHO', nota: 57 },
  { pos: 10, rotulo: 'BK PLAZA', nota: 56 },
  { pos: 11, rotulo: 'BK LAGO SUL', nota: 56 },
  { pos: 12, rotulo: 'BK RECANTO', nota: 52 },
  { pos: 13, rotulo: 'BK SUDOESTE', nota: 69 },
  { pos: 14, rotulo: 'BK TERRAÇO', nota: 30 },
  { pos: 15, rotulo: 'BK CEILANDIA', nota: 0 },
  { pos: 16, rotulo: 'BK SAMAMBAIA', nota: 0 },
  { pos: 17, rotulo: 'BK VENANCIO', nota: 0 },
  { pos: 18, rotulo: 'BK NOROESTE', nota: 0 },
  { pos: 19, rotulo: 'BK ASA SUL', nota: 0 },
  { pos: 20, rotulo: 'POPEYES VAL', nota: 0 },
];

function parseDbFlag() {
  const arg = process.argv.find((a) => a.startsWith('--db='));
  if (!arg) return 'dev';
  const value = arg.slice('--db='.length).trim().toLowerCase();
  if (value === 'dev' || value === 'development') return 'dev';
  if (value === 'prod' || value === 'production') return 'prod';
  if (value === 'both' || value === 'ambos') return 'both';
  throw new Error(`--db inválido: ${value}`);
}

function pct(nota) {
  return Math.round(Number(nota) * 100) / 10000;
}

async function upsertIndicador(client, { codigo, nome, categoria, tipo_valor, meta_minima, ordem }) {
  const { rows } = await client.query(
    `INSERT INTO metas_indicadores (codigo, nome, categoria, tipo_valor, meta_minima, ordem)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (codigo) DO UPDATE SET
       nome = EXCLUDED.nome,
       categoria = EXCLUDED.categoria,
       tipo_valor = EXCLUDED.tipo_valor,
       meta_minima = EXCLUDED.meta_minima,
       ordem = EXCLUDED.ordem
     RETURNING id_indicador`,
    [codigo, nome, categoria, tipo_valor, meta_minima ?? null, ordem],
  );
  return rows[0].id_indicador;
}

function valoresLinha(linha, { percentual = true, demandaTexto = false } = {}) {
  if (linha.na) {
    return { valor_numero: null, valor_texto: 'N/A', pontos: null, classe: null, destaque: null, critico: null };
  }
  if (linha.demanda) {
    return {
      valor_numero: null,
      valor_texto: demandaTexto ? 'DEMANDA' : 'DEMANDA',
      pontos: null,
      classe: linha.classe ?? null,
      destaque: linha.faixa ?? 'DEMANDA',
      critico: linha.critico ?? null,
    };
  }
  return {
    valor_numero: percentual ? pct(linha.nota) : Number(linha.nota),
    valor_texto: null,
    pontos: linha.pontos ?? null,
    classe: linha.classe ?? null,
    destaque: linha.faixa ?? null,
    critico: linha.critico ?? null,
  };
}

async function gravarRanking(client, { idPeriodo, idInd, lojasDb, linhas, percentual = true, titulo }) {
  await client.query(
    `UPDATE metas_rankings
     SET ordem_linha = ordem_linha + 1000
     WHERE id_periodo = $1 AND id_indicador = $2 AND ordem_linha IS NOT NULL`,
    [idPeriodo, idInd],
  );

  const usados = new Set();
  let ok = 0;
  for (const linha of linhas) {
    const loja = resolverLoja(lojasDb, linha.rotulo);
    if (!loja) throw new Error(`Loja não encontrada: ${linha.rotulo}`);
    if (usados.has(loja.id_loja)) {
      throw new Error(`Loja duplicada no ranking ${titulo}: ${linha.rotulo} → ${loja.name}`);
    }
    usados.add(loja.id_loja);

    const vals = valoresLinha(linha, { percentual });
    const { rowCount } = await client.query(
      `UPDATE metas_rankings
       SET posicao = $1,
           ordem_linha = $2,
           valor_numero = $3,
           valor_texto = $4,
           pontos = $5,
           classe = $6,
           destaque = $7,
           critico = $8,
           nome_loja_planilha = $9,
           id_loja = $10
       WHERE id_periodo = $11 AND id_indicador = $12 AND id_loja = $10`,
      [
        linha.pos,
        linha.pos,
        vals.valor_numero,
        vals.valor_texto,
        vals.pontos,
        vals.classe,
        vals.destaque,
        vals.critico,
        linha.rotulo,
        loja.id_loja,
        idPeriodo,
        idInd,
      ],
    );
    if (!rowCount) {
      await client.query(
        `INSERT INTO metas_rankings (
           id_periodo, id_indicador, id_loja, nome_loja_planilha, ordem_linha,
           posicao, valor_numero, valor_texto, pontos, classe, destaque, critico
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          idPeriodo,
          idInd,
          loja.id_loja,
          linha.rotulo,
          linha.pos,
          linha.pos,
          vals.valor_numero,
          vals.valor_texto,
          vals.pontos,
          vals.classe,
          vals.destaque,
          vals.critico,
        ],
      );
    }
    ok += 1;
    const label = linha.na
      ? 'N/A'
      : linha.demanda
        ? 'DEMANDA'
        : `${Number(linha.nota).toFixed(percentual ? 2 : 1)}${percentual ? '%' : ''}`;
    console.log(`  ${String(linha.pos).padStart(2)}  ${loja.name.padEnd(36)} ${label.padEnd(10)} ${linha.pontos ?? ''}`);
  }

  await client.query(
    `DELETE FROM metas_rankings
     WHERE id_periodo = $1 AND id_indicador = $2 AND NOT (id_loja = ANY($3::int[]))`,
    [idPeriodo, idInd, [...usados]],
  );
  console.log(`  → ${ok} lojas`);
}

async function aplicar(dbName) {
  const client = new pg.Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: dbName,
    port: Number(process.env.DB_PORT || 5432),
  });
  await client.connect();
  try {
    const { rows: per } = await client.query(
      `SELECT id_periodo FROM metas_periodos WHERE ano = $1 AND mes = $2`,
      [ANO, MES],
    );
    if (!per.length) throw new Error(`${dbName}: período agosto/2026 não encontrado`);
    const idPeriodo = per[0].id_periodo;
    const lojasDb = await carregarLojas(client);

    await client.query('BEGIN');
    await client.query(`
      SELECT setval(pg_get_serial_sequence('metas_rankings', 'id_ranking'),
        GREATEST(COALESCE((SELECT MAX(id_ranking) FROM metas_rankings), 1), 1), true);
      SELECT setval(pg_get_serial_sequence('metas_indicadores', 'id_indicador'),
        GREATEST(COALESCE((SELECT MAX(id_indicador) FROM metas_indicadores), 1), 1), true);
    `);

    const idDeliveryIfood = await upsertIndicador(client, {
      codigo: 'rank_delivery',
      nome: 'Delivery iFood',
      categoria: 'ranking',
      tipo_valor: 'numero',
      meta_minima: 4.8,
      ordem: 50,
    });
    const idDelivery99 = await upsertIndicador(client, {
      codigo: 'rank_delivery_99',
      nome: 'Delivery 99 Food',
      categoria: 'ranking',
      tipo_valor: 'numero',
      meta_minima: 4.8,
      ordem: 55,
    });
    const idRev = await upsertIndicador(client, {
      codigo: 'rank_rev',
      nome: 'R.E.V.',
      categoria: 'ranking',
      tipo_valor: 'numero',
      meta_minima: null,
      ordem: 30,
    });
    const idGoogle = await upsertIndicador(client, {
      codigo: 'rank_google',
      nome: 'Google',
      categoria: 'ranking',
      tipo_valor: 'numero',
      meta_minima: 0.045,
      ordem: 80,
    });
    const idChecklist = await upsertIndicador(client, {
      codigo: 'rank_checklist_360',
      nome: 'Check list 360',
      categoria: 'ranking',
      tipo_valor: 'numero',
      meta_minima: null,
      ordem: 90,
    });

    console.log('\nDelivery 99 Food');
    await gravarRanking(client, {
      idPeriodo,
      idInd: idDelivery99,
      lojasDb,
      linhas: DELIVERY_99,
      titulo: 'Delivery 99 Food',
    });

    console.log('\nDelivery iFood');
    await gravarRanking(client, {
      idPeriodo,
      idInd: idDeliveryIfood,
      lojasDb,
      linhas: DELIVERY_IFOOD,
      titulo: 'Delivery iFood',
    });

    console.log('\nR.E.V.');
    await gravarRanking(client, {
      idPeriodo,
      idInd: idRev,
      lojasDb,
      linhas: REV,
      titulo: 'R.E.V.',
    });

    console.log('\nGoogle');
    await gravarRanking(client, {
      idPeriodo,
      idInd: idGoogle,
      lojasDb,
      linhas: GOOGLE,
      percentual: false,
      titulo: 'Google',
    });

    console.log('\nCheck list 360');
    await gravarRanking(client, {
      idPeriodo,
      idInd: idChecklist,
      lojasDb,
      linhas: CHECKLIST_360,
      titulo: 'Check list 360',
    });

    await client.query('COMMIT');
    console.log(`\nOK ${dbName}: agosto/2026 período #${idPeriodo}`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

const alvo = parseDbFlag();
const bancos = alvo === 'both' ? [DB_DEV, DB_PROD] : alvo === 'prod' ? [DB_PROD] : [DB_DEV];
if (bancos.includes(DB_PROD) && !process.argv.includes('--yes')) {
  console.error('Produção exige --yes');
  process.exit(1);
}

for (const db of bancos) {
  console.log(`\n=== ${db} ===`);
  await aplicar(db);
}
