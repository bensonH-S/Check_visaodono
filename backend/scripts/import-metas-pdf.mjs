/**
 * Importa períodos de metas a partir de PDFs (resumo empresa + gestores).
 * Uso: node backend/scripts/import-metas-pdf.mjs [arquivo.pdf ...]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';
import { carregarLojas, resolverLoja, norm } from './metasLojaResolver.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const PDFS_DEFAULT = [
  path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'metas fevereiro.pdf'),
  path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'metas março.pdf'),
  path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'metas abril.pdf'),
  path.join(process.env.USERPROFILE || '', 'OneDrive', 'Desktop', 'metas maio.pdf'),
].map((p) => {
  if (!fs.existsSync(p)) {
    const alt = p.replace(/\\Users\\[^\\]+\\/, '\\Users\\benson\\');
    return fs.existsSync(alt) ? alt : p;
  }
  return p;
});

const MESES_ARQUIVO = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const MESES_TITULO = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function mesDoArquivo(filePath) {
  const base = norm(path.basename(filePath, '.pdf'));
  for (const [nome, num] of Object.entries(MESES_ARQUIVO)) {
    if (base.includes(nome)) return num;
  }
  return null;
}

function aplicarMesDoArquivo(periodo) {
  const mes = mesDoArquivo(periodo.arquivo);
  const ano = periodo.ano || 2026;
  if (mes) {
    periodo.mes = mes;
    periodo.ano = ano;
    periodo.titulo = `Metas ${MESES_TITULO[mes]}/${ano}`;
  }
  return periodo;
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

function parseValorCelula(v) {
  if (v == null || v === '') return { valor_texto: null, valor_numero: null, atingiu: null };
  const s = String(v).trim().toUpperCase();
  if (s === 'OK') return { valor_texto: 'OK', valor_numero: null, atingiu: true };
  if (s === 'X') return { valor_texto: 'X', valor_numero: null, atingiu: false };
  return { valor_texto: null, valor_numero: null, atingiu: null };
}

async function upsertIndicador(client, { codigo, nome, categoria, ordem }) {
  const { rows } = await client.query(
    `INSERT INTO metas_indicadores (codigo, nome, categoria, tipo_valor, ordem)
     VALUES ($1, $2, $3, 'texto', $4)
     ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem
     RETURNING id_indicador`,
    [codigo, nome, categoria, ordem],
  );
  return rows[0].id_indicador;
}

async function criarPainel(client, idPeriodo, { codigo, titulo, tipo, ordem }) {
  const { rows } = await client.query(
    `INSERT INTO metas_paineis (id_periodo, codigo, titulo, tipo, ordem)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_periodo, codigo) DO UPDATE SET titulo = EXCLUDED.titulo, tipo = EXCLUDED.tipo, ordem = EXCLUDED.ordem
     RETURNING id_painel`,
    [idPeriodo, codigo, titulo, tipo, ordem],
  );
  return rows[0].id_painel;
}

async function importarPainel(client, idPeriodo, painel, lojasDb) {
  const idPainel = await criarPainel(client, idPeriodo, painel);

  await client.query('DELETE FROM metas_painel_lojas WHERE id_painel = $1', [idPainel]);
  await client.query('DELETE FROM metas_painel_indicadores WHERE id_painel = $1', [idPainel]);
  await client.query('DELETE FROM metas_realizados WHERE id_painel = $1', [idPainel]);

  const lojasPainel = [];
  for (let i = 0; i < painel.lojas_rotulos.length; i += 1) {
    const rotulo = painel.lojas_rotulos[i];
    const loja = resolverLoja(lojasDb, rotulo);
    if (!loja) {
      console.warn(`  ⚠ Loja não encontrada: ${rotulo}`);
      continue;
    }
    lojasPainel.push({ loja, rotulo, ordem: i });
    await client.query(
      `INSERT INTO metas_painel_lojas (id_painel, id_loja, rotulo_curto, ordem) VALUES ($1, $2, $3, $4)`,
      [idPainel, loja.id_loja, rotulo, i],
    );
  }

  for (let i = 0; i < painel.indicadores.length; i += 1) {
    const ind = painel.indicadores[i];
    const idInd = await upsertIndicador(client, {
      codigo: ind.codigo,
      nome: ind.nome,
      categoria: 'resumo',
      ordem: i,
    });
    await client.query(
      `INSERT INTO metas_painel_indicadores (id_painel, id_indicador, peso, ordem) VALUES ($1, $2, $3, $4)`,
      [idPainel, idInd, ind.peso, i],
    );

    for (let j = 0; j < lojasPainel.length; j += 1) {
      const raw = ind.celulas[j];
      if (!raw) continue;
      const parsed = parseValorCelula(raw);
      if (!parsed.valor_texto && parsed.atingiu == null) continue;
      await client.query(
        `INSERT INTO metas_realizados (id_periodo, id_painel, id_indicador, id_loja, valor_texto, valor_numero, atingiu)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id_painel, id_indicador, id_loja) DO UPDATE SET
           valor_texto = EXCLUDED.valor_texto,
           valor_numero = EXCLUDED.valor_numero,
           atingiu = EXCLUDED.atingiu`,
        [
          idPeriodo,
          idPainel,
          idInd,
          lojasPainel[j].loja.id_loja,
          parsed.valor_texto,
          parsed.valor_numero,
          parsed.atingiu,
        ],
      );
    }
  }

  console.log(`  ✓ ${painel.titulo} — ${lojasPainel.length} lojas, ${painel.indicadores.length} indicadores`);
}

function parsePdfs(paths) {
  const helper = path.join(path.dirname(fileURLToPath(import.meta.url)), '_parse_metas_pdf.py');
  const existentes = paths.filter((p) => {
    if (!fs.existsSync(p)) {
      console.warn(`Arquivo não encontrado: ${p}`);
      return false;
    }
    return true;
  });
  if (!existentes.length) throw new Error('Nenhum PDF encontrado');

  const r = spawnSync('python', [helper, ...existentes], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'Falha ao ler PDFs');
  return JSON.parse(r.stdout).map(aplicarMesDoArquivo);
}

try {
  const paths = process.argv.length > 2 ? process.argv.slice(2) : PDFS_DEFAULT;
  const periodos = parsePdfs(paths);

  const client = await pool.connect();
  try {
    for (const periodo of periodos) {
      if (!periodo.mes || !periodo.ano) {
        console.warn(`Ignorando ${periodo.arquivo}: mês/ano não detectado`);
        continue;
      }

      console.log(`\n→ ${periodo.titulo} (${periodo.arquivo})`);
      await client.query('BEGIN');

      const { rows: periodoRows } = await client.query(
        `INSERT INTO metas_periodos (ano, mes, titulo)
         VALUES ($1, $2, $3)
         ON CONFLICT (ano, mes) DO UPDATE SET titulo = EXCLUDED.titulo
         RETURNING id_periodo`,
        [periodo.ano, periodo.mes, periodo.titulo],
      );
      const idPeriodo = periodoRows[0].id_periodo;
      const lojasDb = await carregarLojas(client);

      for (const painel of periodo.paineis) {
        await importarPainel(client, idPeriodo, painel, lojasDb);
      }

      await client.query('COMMIT');
      console.log(`OK — período #${idPeriodo} (${periodo.titulo})`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
