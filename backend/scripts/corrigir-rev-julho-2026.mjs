/**
 * Corrige ranking R.E.V. de julho/2026 conforme a planilha (2 casas na nota).
 * Uso: node backend/scripts/corrigir-rev-julho-2026.mjs --db=both --yes
 */
import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { carregarLojas, resolverLoja } from './metasLojaResolver.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const DB_DEV = process.env.DB_NAME_DEV || 'vision_check_dev';
const DB_PROD = process.env.DB_NAME_PROD || 'vision_check';

const LINHAS = [
  { pos: 1, rotulo: 'BK CEILANDIA', nota: 93.41, critico: 0, faixa: 'C', classe: 'REV' },
  { pos: 2, rotulo: 'BK CALDAS', nota: 88.7, critico: 0, faixa: 'C', classe: 'REV' },
  { pos: 3, rotulo: 'BK PLAZA', nota: 92.62, critico: 1, faixa: 'C', classe: 'REV' },
  { pos: 4, rotulo: 'BK ESTRUTURAL', nota: 91.5, critico: 1, faixa: 'C', classe: 'REV' },
  { pos: 5, rotulo: 'BK SÃO SEBASTIÃO', nota: 90.5, critico: 1, faixa: 'C', classe: 'REV' },
  { pos: 6, rotulo: 'BK SUDOESTE', nota: 93.41, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 7, rotulo: 'BK SOBRADINHO', nota: 85.62, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 8, rotulo: 'BK 707 NORTE', nota: 79.57, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 9, rotulo: 'BK SAMAMBAIA', nota: 79.0, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 10, rotulo: 'BK UNAI', nota: 75.84, critico: 2, faixa: 'C', classe: 'REV' },
  { pos: 11, rotulo: 'BK GILBERTO', nota: 87.08, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 12, rotulo: 'BK VENANCIO', nota: 84.31, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 13, rotulo: 'BK PLANALTINA', nota: 83.33, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 14, rotulo: 'BK TERRAÇO', nota: 81.21, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 15, rotulo: 'BK 201 NORTE', nota: 80.22, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 16, rotulo: 'BK RECANTO', nota: 79.67, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 17, rotulo: 'POPEYES VAL', nota: 76.15, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 18, rotulo: 'BK NOROESTE', nota: 75.51, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 19, rotulo: 'BK 408 SUL', nota: 69.23, critico: 3, faixa: 'C', classe: 'REV' },
  { pos: 20, rotulo: 'BK PONTE ALTA', nota: 78.57, critico: 4, faixa: 'C', classe: 'REV' },
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
      `SELECT id_periodo FROM metas_periodos WHERE ano = 2026 AND mes = 7`,
    );
    if (!per.length) throw new Error(`${dbName}: período julho/2026 não encontrado`);
    const idPeriodo = per[0].id_periodo;
    const { rows: ind } = await client.query(
      `SELECT id_indicador FROM metas_indicadores WHERE codigo = 'rank_rev'`,
    );
    if (!ind.length) throw new Error(`${dbName}: indicador rank_rev não encontrado`);
    const idInd = ind[0].id_indicador;
    const lojasDb = await carregarLojas(client);

    await client.query('BEGIN');
    let ok = 0;
    for (const linha of LINHAS) {
      const loja = resolverLoja(lojasDb, linha.rotulo);
      if (!loja) {
        throw new Error(`${dbName}: não achei loja para "${linha.rotulo}"`);
      }
      const valorNumero = linha.demanda ? null : Math.round(linha.nota * 100) / 10000;
      const valorTexto = linha.demanda ? 'DEMANDA' : null;
      const { rowCount } = await client.query(
        `UPDATE metas_rankings
         SET posicao = $1,
             valor_numero = $2,
             valor_texto = $3,
             pontos = $4,
             classe = $5,
             destaque = $6,
             critico = $7,
             nome_loja_planilha = $8,
             id_loja = $9
         WHERE id_periodo = $10 AND id_indicador = $11 AND id_loja = $9`,
        [
          linha.pos,
          valorNumero,
          valorTexto,
          linha.critico,
          linha.classe,
          linha.faixa,
          linha.critico,
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
            valorNumero,
            valorTexto,
            linha.critico,
            linha.classe,
            linha.faixa,
            linha.critico,
          ],
        );
      }
      ok += 1;
      console.log(
        `  ${String(linha.pos).padStart(2)}  ${loja.name}  ${linha.demanda ? 'DEMANDA' : `${linha.nota.toFixed(2)}%`}  ${linha.critico}C  ${linha.classe || 'DEMANDA'}`,
      );
    }
    await client.query('COMMIT');
    console.log(`OK ${dbName}: ${ok} lojas R.E.V. julho/2026`);
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
