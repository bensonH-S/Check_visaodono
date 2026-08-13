/**
 * Importa metas de julho/2026 a partir da planilha METAS JULHO 2026.
 * Uso: node backend/scripts/seed-metas-julho-2026.mjs [caminho.xlsx]
 * Padrão: produção (vision_check). --dev para vision_check_dev.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import { carregarLojas, resolverLoja, norm } from './metasLojaResolver.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });

const useDev = process.argv.includes('--dev');
process.env.DB_NAME = useDev ? 'vision_check_dev' : 'vision_check';

const XLSX_PATH =
  process.argv.find((a) => a.endsWith('.xlsx') || a.endsWith('.xlsm')) ||
  path.join(process.env.USERPROFILE || '', 'Downloads', 'METAS JULHO  2026 -.xlsx');

const ANO = 2026;
const MES = 7;

function cellStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

async function loadWorkbook() {
  const { default: mod } = await import('openpyxl');
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Planilha não encontrada: ${XLSX_PATH}`);
  }
  return mod.load_workbook
    ? mod.load_workbook(XLSX_PATH, { data_only: true })
    : (await import('xlsx')).readFile(XLSX_PATH);
}

async function openWorkbookOpenpyxl() {
  const { spawnSync } = await import('child_process');
  const helper = path.join(path.dirname(fileURLToPath(import.meta.url)), '_read_xlsx_helper.py');
  if (!fs.existsSync(helper)) {
    throw new Error('Helper Python ausente');
  }
  const r = spawnSync('python', [helper, XLSX_PATH], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'Falha ao ler xlsx');
  return JSON.parse(r.stdout);
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

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

function parseValorCelula(v) {
  if (v == null || v === '') return { valor_texto: null, valor_numero: null, atingiu: null };
  if (typeof v === 'number') return { valor_texto: String(v), valor_numero: v, atingiu: null };
  const s = String(v).trim();
  const upper = s.toUpperCase();
  if (upper === 'OK') return { valor_texto: upper, valor_numero: null, atingiu: true };
  if (upper === 'X') return { valor_texto: upper, valor_numero: null, atingiu: false };
  const num = Number(s.replace(',', '.'));
  if (!Number.isNaN(num) && s.match(/^[\d.,]+$/)) {
    return { valor_texto: s, valor_numero: num, atingiu: null };
  }
  return { valor_texto: s, valor_numero: null, atingiu: null };
}

async function importarResumoPainel(client, idPeriodo, painelCfg, sheet, lojasDb) {
  const idPainel = await criarPainel(client, idPeriodo, painelCfg);

  await client.query('DELETE FROM metas_painel_lojas WHERE id_painel = $1', [idPainel]);
  await client.query('DELETE FROM metas_painel_indicadores WHERE id_painel = $1', [idPainel]);
  await client.query('DELETE FROM metas_realizados WHERE id_painel = $1', [idPainel]);

  const lojasPainel = [];
  for (let i = 0; i < painelCfg.lojas_rotulos.length; i += 1) {
    const rotulo = painelCfg.lojas_rotulos[i];
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

  for (let i = 0; i < painelCfg.indicadores.length; i += 1) {
    const ind = painelCfg.indicadores[i];
    const idInd = await upsertIndicador(client, {
      codigo: ind.codigo,
      nome: ind.nome,
      categoria: 'resumo',
      tipo_valor: ind.tipo_valor || 'texto',
      ordem: ind.ordem ?? i,
    });
    await client.query(
      `INSERT INTO metas_painel_indicadores (id_painel, id_indicador, peso, ordem) VALUES ($1, $2, $3, $4)`,
      [idPainel, idInd, ind.peso, i],
    );

    const rowData = sheet.rows[ind.row - 1];
    if (!rowData) continue;
    for (let j = 0; j < lojasPainel.length; j += 1) {
      const col = painelCfg.lojas_col_start + j;
      const raw = rowData[col];
      if (raw == null || raw === '') continue;
      const parsed = parseValorCelula(raw);
      await client.query(
        `INSERT INTO metas_realizados (id_periodo, id_painel, id_indicador, id_loja, valor_texto, valor_numero, atingiu)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [idPeriodo, idPainel, idInd, lojasPainel[j].loja.id_loja, parsed.valor_texto, parsed.valor_numero, parsed.atingiu],
      );
    }
  }
}

async function importarRanking(client, idPeriodo, cfg, sheet, lojasDb) {
  const idInd = await upsertIndicador(client, {
    codigo: cfg.codigo,
    nome: cfg.nome,
    categoria: 'ranking',
    tipo_valor: cfg.tipo_valor || 'numero',
    meta_minima: cfg.meta_minima ?? null,
    ordem: cfg.ordem,
  });

  await client.query(
    `DELETE FROM metas_rankings WHERE id_periodo = $1 AND id_indicador = $2`,
    [idPeriodo, idInd],
  );

  let ordemLinha = 0;

  for (let r = cfg.row_start; r <= cfg.row_end; r += 1) {
    const row = sheet.rows[r - 1];
    if (!row) continue;
    const posicaoRaw = row[cfg.col_pos];
    const nomeLoja = cellStr(row[cfg.col_loja]);
    const valorRaw = row[cfg.col_valor];
    const pontos = row[cfg.col_pts];
    const classe = cfg.col_classe != null ? cellStr(row[cfg.col_classe]) : null;

    if (!nomeLoja && posicaoRaw == null && valorRaw == null && pontos == null) continue;
    if (String(nomeLoja || '').toUpperCase().includes('SUBTOTAL')) break;

    ordemLinha += 1;
    const loja = nomeLoja ? resolverLoja(lojasDb, nomeLoja) : null;

    let posicao = posicaoRaw != null && posicaoRaw !== '' ? Number(posicaoRaw) : null;
    if (posicao != null && Number.isNaN(posicao)) posicao = null;

    let valor_numero = null;
    let valor_texto = null;
    if (typeof valorRaw === 'number') valor_numero = valorRaw;
    else if (valorRaw != null) {
      const s = String(valorRaw).trim();
      if (s.toUpperCase() === 'DEMANDA') valor_texto = s;
      else {
        const n = Number(s.replace(',', '.'));
        valor_numero = Number.isNaN(n) ? null : n;
        valor_texto = Number.isNaN(n) ? s : null;
      }
    }

    let pontosVal = null;
    if (pontos != null && pontos !== '') {
      if (pontos === '.-3' || pontos === '-3') pontosVal = -3;
      else {
        const n = Number(pontos);
        pontosVal = Number.isNaN(n) ? null : n;
      }
    }

    await client.query(
      `INSERT INTO metas_rankings (
         id_periodo, id_indicador, id_loja, nome_loja_planilha, ordem_linha,
         posicao, valor_numero, valor_texto, pontos, classe
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        idPeriodo,
        idInd,
        loja?.id_loja ?? null,
        nomeLoja,
        ordemLinha,
        posicao,
        valor_numero,
        valor_texto,
        pontosVal,
        classe,
      ],
    );
  }
}

function numCell(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

async function importarPremios(client, idPeriodo, sheet) {
  await client.query('DELETE FROM metas_premios WHERE id_periodo = $1', [idPeriodo]);
  for (let r = 2; r <= 13; r += 1) {
    const row = sheet.rows[r - 1];
    if (!row) continue;
    const nome = cellStr(row[0]);
    if (!nome || nome.toUpperCase() === 'PREMIO') continue;
    const premio_saude = numCell(row[1]);
    const premio_rev = numCell(row[2]);
    // Julho: nome | saude | rev | (vazio) | valor | subtot | total
    const shifted = row[3] == null && row[4] != null;
    const valor_unitario = numCell(shifted ? row[4] : row[3]);
    const subtotal = numCell(shifted ? row[5] : row[4]);
    const total = numCell(shifted ? row[6] : row[5]);
    if (!premio_saude && !premio_rev && !valor_unitario && !subtotal && !total) continue;

    await client.query(
      `INSERT INTO metas_premios (id_periodo, nome, premio_saude, premio_rev, valor_unitario, subtotal, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [idPeriodo, nome, premio_saude, premio_rev, valor_unitario, subtotal, total],
    );
  }
}

const PAINEIS_RESUMO = [
  {
    codigo: 'empresa_grupo1',
    titulo: 'Empresa — Grupo 1',
    tipo: 'empresa',
    ordem: 1,
    lojas_rotulos: ['BK ASA S', 'BK 201N', 'BK SS', 'BK LAGO', 'BK ESTRUT', 'BK PLAZA', 'BK CALDAS', 'BK SUDO'],
    lojas_col_start: 2,
    indicadores: [
      { codigo: 'saude', nome: 'SAÚDE', peso: 80, row: 9 },
      { codigo: 'rev_ouro', nome: 'R.E.V. (OURO)', peso: 50, row: 10 },
      { codigo: 'rev_zc', nome: 'R.E.V. (ZC)', peso: 40, row: 11 },
      { codigo: 'cmp_paga', nome: 'CMP(PAGA)', peso: 40, row: 12 },
      { codigo: 'assiduidade', nome: 'Assiduidade', peso: 150, row: 13 },
    ],
  },
  {
    codigo: 'gestor_grupo1',
    titulo: 'Gestor — Grupo 1',
    tipo: 'gestor',
    ordem: 2,
    lojas_rotulos: ['BK ASA S', 'BK 201N', 'BK SS', 'BK LAGO', 'BK ESTRUT', 'BK PLAZA', 'BK CALDAS', 'BK SUDO'],
    lojas_col_start: 13,
    indicadores: [
      { codigo: 'gestor_rev_ouro', nome: 'R.E.V. (OURO)', peso: 100, row: 9 },
      { codigo: 'gestor_rev_zc', nome: 'R.E.V. (ZC)', peso: 60, row: 10 },
      { codigo: 'gestor_cmp_paga', nome: 'CMP(PAGA)', peso: 60, row: 11 },
      { codigo: 'google', nome: 'GOOGLE', peso: 60, row: 12 },
      { codigo: 'dlv_48', nome: 'DLV 4,8', peso: 60, row: 13 },
      { codigo: 'checklist_360', nome: 'Check list 360', peso: 30, row: 14 },
      { codigo: 'nps', nome: 'NPS', peso: 30, row: 15 },
    ],
  },
  {
    codigo: 'empresa_grupo2',
    titulo: 'Empresa — Grupo 2',
    tipo: 'empresa',
    ordem: 3,
    lojas_rotulos: ['BK UNAI', 'BK 707 N', 'BK CEILA', 'BK VENAN', 'BK PLANAL', 'BK RECANTO', 'BK SOBRADIN', 'BK TERRACO'],
    lojas_col_start: 2,
    indicadores: [
      { codigo: 'saude', nome: 'SAÚDE', peso: 80, row: 33 },
      { codigo: 'rev_ouro', nome: 'R.E.V. (OURO)', peso: 50, row: 34 },
      { codigo: 'rev_zc', nome: 'R.E.V. (ZC)', peso: 40, row: 35 },
      { codigo: 'cmp_paga', nome: 'CMP(PAGA)', peso: 40, row: 36 },
      { codigo: 'assiduidade', nome: 'Assiduidade', peso: 150, row: 37 },
    ],
  },
  {
    codigo: 'gestor_grupo2',
    titulo: 'Gestor — Grupo 2',
    tipo: 'gestor',
    ordem: 4,
    lojas_rotulos: ['BK UNAI', 'BK 707 N', 'BK CEILA', 'BK VENAN', 'BK PLANAL', 'BK RECANTO', 'BK SOBRADIN', 'BK TERRACO'],
    lojas_col_start: 13,
    indicadores: [
      { codigo: 'gestor_rev_ouro', nome: 'R.E.V. (OURO)', peso: 100, row: 33 },
      { codigo: 'gestor_rev_zc', nome: 'R.E.V. (ZC)', peso: 60, row: 34 },
      { codigo: 'gestor_cmp_paga', nome: 'CMP(PAGA)', peso: 60, row: 35 },
      { codigo: 'google', nome: 'GOOGLE', peso: 60, row: 36 },
      { codigo: 'dlv_48', nome: 'DLV 4,8', peso: 60, row: 37 },
      { codigo: 'checklist_360', nome: 'Check list 360', peso: 30, row: 38 },
      { codigo: 'nps', nome: 'NPS', peso: 30, row: 39 },
    ],
  },
  {
    codigo: 'empresa_grupo3',
    titulo: 'Empresa — Grupo 3',
    tipo: 'empresa',
    ordem: 5,
    lojas_rotulos: ['BK NORO', 'BK SAMA', 'BK PONTE', 'POPEYES'],
    lojas_col_start: 2,
    indicadores: [
      { codigo: 'saude', nome: 'SAÚDE', peso: 80, row: 60 },
      { codigo: 'rev_ouro', nome: 'R.E.V. (OURO)', peso: 50, row: 61 },
      { codigo: 'rev_zc', nome: 'R.E.V. (ZC)', peso: 40, row: 62 },
      { codigo: 'cmp_paga', nome: 'CMP(PAGA)', peso: 40, row: 63 },
      { codigo: 'assiduidade', nome: 'Assiduidade', peso: 150, row: 64 },
    ],
  },
  {
    codigo: 'gestor_grupo3',
    titulo: 'Gestor — Grupo 3',
    tipo: 'gestor',
    ordem: 6,
    lojas_rotulos: ['BK NORO', 'BK SAMA', 'BK PONTE', 'POPEYES'],
    lojas_col_start: 13,
    indicadores: [
      { codigo: 'gestor_rev_ouro', nome: 'R.E.V. (OURO)', peso: 100, row: 60 },
      { codigo: 'gestor_rev_zc', nome: 'R.E.V. (ZC)', peso: 60, row: 61 },
      { codigo: 'gestor_cmp_paga', nome: 'CMP(PAGA)', peso: 60, row: 62 },
      { codigo: 'google', nome: 'GOOGLE', peso: 60, row: 63 },
      { codigo: 'dlv_48', nome: 'DLV 4,8', peso: 60, row: 64 },
      { codigo: 'checklist_360', nome: 'Check list 360', peso: 30, row: 65 },
      { codigo: 'nps', nome: 'NPS', peso: 30, row: 66 },
    ],
  },
];

const RANKINGS = [
  { codigo: 'rank_cmp', nome: 'Custo de Mercadoria Paga (CMP)', ordem: 10, row_start: 5, row_end: 24, col_pos: 0, col_loja: 1, col_valor: 2, col_pts: 3, col_classe: null },
  { codigo: 'rank_saude', nome: 'SAÚDE', ordem: 20, row_start: 5, row_end: 24, col_pos: 5, col_loja: 6, col_valor: 7, col_pts: 8, col_classe: null },
  { codigo: 'rank_rev', nome: 'R.E.V.', ordem: 30, row_start: 5, row_end: 24, col_pos: 9, col_loja: 10, col_valor: 11, col_pts: 12, col_classe: 13 },
  { codigo: 'rank_misterioso', nome: 'Cliente Misterioso', ordem: 40, row_start: 38, row_end: 58, col_pos: 0, col_loja: 1, col_valor: 2, col_pts: 3, col_classe: null, meta_minima: 0.85 },
  { codigo: 'rank_delivery', nome: 'Delivery', ordem: 50, row_start: 38, row_end: 58, col_pos: 5, col_loja: 6, col_valor: 7, col_pts: 8, col_classe: null, meta_minima: 4.8 },
  { codigo: 'rank_ano_anterior', nome: 'Ano - 1', ordem: 60, row_start: 38, row_end: 58, col_pos: 9, col_loja: 10, col_valor: 11, col_pts: 12, col_classe: null, meta_minima: 0.1 },
  { codigo: 'rank_nps', nome: 'NPS', ordem: 70, row_start: 71, row_end: 91, col_pos: 0, col_loja: 1, col_valor: 2, col_pts: 3, col_classe: null, meta_minima: 0.5 },
  { codigo: 'rank_google', nome: 'Google', ordem: 80, row_start: 71, row_end: 91, col_pos: 5, col_loja: 6, col_valor: 7, col_pts: 8, col_classe: null, meta_minima: 0.045 },
];

try {
  console.log(`Planilha: ${XLSX_PATH}`);
  console.log(`Banco: ${process.env.DB_NAME}`);
  const data = await openWorkbookOpenpyxl();
  const resumo = data.sheets.RESUMO;
  const metas = data.sheets['METAS '];
  const premios = data.sheets.PREMIOS;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      SELECT setval(pg_get_serial_sequence('metas_premios', 'id_premio'),
        GREATEST(COALESCE((SELECT MAX(id_premio) FROM metas_premios), 1), 1), true);
      SELECT setval(pg_get_serial_sequence('metas_paineis', 'id_painel'),
        GREATEST(COALESCE((SELECT MAX(id_painel) FROM metas_paineis), 1), 1), true);
      SELECT setval(pg_get_serial_sequence('metas_rankings', 'id_ranking'),
        GREATEST(COALESCE((SELECT MAX(id_ranking) FROM metas_rankings), 1), 1), true);
      SELECT setval(pg_get_serial_sequence('metas_realizados', 'id_realizado'),
        GREATEST(COALESCE((SELECT MAX(id_realizado) FROM metas_realizados), 1), 1), true);
    `);

    const { rows: periodoRows } = await client.query(
      `INSERT INTO metas_periodos (ano, mes, titulo, observacao)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ano, mes) DO UPDATE SET titulo = EXCLUDED.titulo, observacao = EXCLUDED.observacao
       RETURNING id_periodo`,
      [ANO, MES, 'Metas Julho 2026', 'Importado da planilha METAS JULHO 2026.xlsx'],
    );
    const idPeriodo = periodoRows[0].id_periodo;
    const lojasDb = await carregarLojas(client);

    console.log('Importando painéis RESUMO...');
    for (const cfg of PAINEIS_RESUMO) {
      console.log(`  → ${cfg.titulo}`);
      await importarResumoPainel(client, idPeriodo, cfg, resumo, lojasDb);
    }

    console.log('Importando rankings METAS...');
    for (const cfg of RANKINGS) {
      console.log(`  → ${cfg.nome}`);
      await importarRanking(client, idPeriodo, cfg, metas, lojasDb);
    }

    console.log('Importando prêmios...');
    await importarPremios(client, idPeriodo, premios);

    await client.query('COMMIT');
    console.log(`\nOK — período #${idPeriodo} (Julho/2026) importado em ${process.env.DB_NAME}.`);
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
