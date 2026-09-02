/**
 * Validação operacional da Etapa 1 (motor de conversão).
 * Banco: vision_check_dev. Não altera cadastro produtivo (Whopper 021403).
 * Dados de teste usam prefixo Z_E1VAL_* e são apagados no finally.
 *
 *   node scripts/validar-etapa1-conversao.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const backendRoot = path.join(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });

if (process.argv.includes('--production')) {
  console.error('Recusado: este script não roda com --production.');
  process.exit(1);
}
process.env.NODE_ENV = 'development';
process.env.DB_NAME = 'vision_check_dev';

const { pool } = await import('../src/db.js');
const { signToken } = await import('../src/auth.js');
const { authMiddleware } = await import('../src/auth.js');
const { attachPermissoesUsuario } = await import('../src/permissoes.js');
const { attachLojasUsuario } = await import('../src/lojasUsuario.js');
const estoqueRouter = (await import('../src/routes/estoque.js')).default;
const {
  resolverQtdContagem,
  unidadeFracionadaEfetiva,
  anexarFatoresFracionada,
  garantirSchemaUnidadeFracionada,
} = await import('../src/services/estoqueContagem.js');
const {
  MOTIVO_BAIXA,
  MOTIVO_CONVERSAO,
  aplicarConversaoUnidades,
  converterQuantidade,
  resolverConsumoEstoque,
  resolverConsumoInsumo,
} = await import('../src/services/estoqueConsumo.js');
const { lancarBreak } = await import('../src/services/estoqueMotor.js');

const TAG = `Z_E1VAL_${Date.now()}`;
const results = [];
const logs = [];

function log(title, data) {
  const block = `\n===== ${title} =====\n${
    typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  }`;
  logs.push(block);
  console.log(block);
}

function record(nome, esperado, obtido, pass, extra = null) {
  const row = { teste: nome, esperado, obtido, status: pass ? 'PASS' : 'FAIL', extra };
  results.push(row);
  console.log(`\n[${row.status}] ${nome}`);
  console.log(`  esperado: ${esperado}`);
  console.log(`  obtido:   ${typeof obtido === 'string' ? obtido : JSON.stringify(obtido)}`);
  if (extra) console.log(`  extra:    ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`);
  return pass;
}

function almostEqual(a, b, eps = 1e-4) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
}

function parseNumCampoFront(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function runUnitTests() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--test', 'src/services/estoqueContagem.test.js', 'src/services/estoqueConsumo.test.js'],
      { cwd: backendRoot, env: process.env },
    );
    let out = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      out += d.toString();
    });
    child.on('close', (code) => resolve({ code, out }));
  });
}

async function startMiniApi() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(authMiddleware);
  app.use(attachPermissoesUsuario);
  app.use(attachLojasUsuario);
  app.use('/auditoria/api/estoque', estoqueRouter);
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message, motivo: err.motivo || undefined });
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

async function apiPut(base, token, idContagem, body) {
  const res = await fetch(`${base}/auditoria/api/estoque/contagens/${idContagem}/itens`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function snapshotItens(ids) {
  const { rows } = await pool.query(
    `SELECT id_item, id_insumo, estoque_contado, contagem_caixa, contagem_pc_fd, contagem_kg_und
     FROM estoque_itens WHERE id_item = ANY($1::int[])
     ORDER BY id_item`,
    [ids],
  );
  return rows;
}

const cleanup = {
  idContagem: null,
  idInsumos: [],
};

async function limpar() {
  if (cleanup.idContagem) {
    await pool.query('DELETE FROM estoque_itens WHERE id_contagem = $1', [cleanup.idContagem]);
    await pool.query('DELETE FROM estoque_contagens WHERE id_contagem = $1', [cleanup.idContagem]);
  }
  if (cleanup.idInsumos.length) {
    await pool.query('DELETE FROM estoque_conversoes WHERE id_insumo = ANY($1::int[])', [
      cleanup.idInsumos,
    ]);
    await pool.query('DELETE FROM estoque_saldos WHERE id_insumo = ANY($1::int[])', [
      cleanup.idInsumos,
    ]);
    await pool.query('DELETE FROM estoque_itens WHERE id_insumo = ANY($1::int[])', [
      cleanup.idInsumos,
    ]);
    await pool.query('DELETE FROM insumos WHERE id_insumo = ANY($1::int[])', [cleanup.idInsumos]);
  }
  await pool.query(`DELETE FROM estoque_contagens WHERE titulo LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM insumos WHERE codigo LIKE $1`, [`${TAG}%`]);
}

let server;
try {
  console.log('\n########## VALIDAÇÃO ETAPA 1 — MOTOR DE CONVERSÃO ##########');
  console.log(`DB_NAME efetivo (db.js): ${process.env.DB_NAME}`);
  console.log(`Tag de teste: ${TAG}`);

  // ---------- 2. testes unitários primeiro ----------
  const unit = await runUnitTests();
  log('2. OUTPUT COMPLETO node --test', unit.out);
  const passMatch =
    unit.out.match(/#\s+pass(?:es)?:\s+(\d+)/i) || unit.out.match(/ℹ pass\s+(\d+)/i);
  const failMatch =
    unit.out.match(/#\s+fail(?:s)?:\s+(\d+)/i) || unit.out.match(/ℹ fail\s+(\d+)/i);
  const testsMatch =
    unit.out.match(/#\s+tests?:\s+(\d+)/i) || unit.out.match(/ℹ tests\s+(\d+)/i);
  const durationMatch =
    unit.out.match(/#\s+duration_ms:\s+([\d.]+)/i) || unit.out.match(/ℹ duration_ms\s+([\d.]+)/i);
  const failNames = [...unit.out.matchAll(/not ok \d+ - (.+)/g)].map((m) => m[1]);
  const unitTests = testsMatch ? Number(testsMatch[1]) : null;
  const unitPass = passMatch ? Number(passMatch[1]) : null;
  const unitFail = failMatch ? Number(failMatch[1]) : unit.code === 0 ? 0 : null;
  const unitMs = durationMatch ? Number(durationMatch[1]) : null;
  record(
    '2. Testes unitários (contagem + consumo)',
    'exit 0, 0 falhas',
    `exit=${unit.code} tests=${unitTests} pass=${unitPass} fail=${unitFail} duration_ms=${unitMs} falhos=${failNames.join(' | ') || 'nenhum'}`,
    unit.code === 0 && unitFail === 0,
  );
  if (unit.code !== 0) {
    console.error('\nFALHA nos testes unitários. Parando sem Etapa 2 e sem correção silenciosa.');
    process.exitCode = 1;
    throw new Error('unit-fail-stop');
  }

  const dbName = await pool.query('SELECT current_database() AS db, current_user AS usr');
  log('Conexão', dbName.rows[0]);
  if (dbName.rows[0].db !== 'vision_check_dev') {
    throw new Error(`Abortado: banco inesperado ${dbName.rows[0].db}`);
  }

  // ---------- 1. migration ----------
  const sqlPath = path.join(backendRoot, 'migrations/169_insumos_unidade_fracionada.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  log('1. Arquivo migration 169', sql);
  await pool.query(sql);
  await garantirSchemaUnidadeFracionada(pool);

  const colSql = `
    SELECT column_name, data_type, is_nullable, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'insumos' AND column_name = 'unidade_fracionada'
  `;
  const col = await pool.query(colSql);
  log('1. Query coluna', { sql: colSql.trim(), rows: col.rows });

  const statsSql = `
    SELECT
      COUNT(*) FILTER (WHERE unidade_fracionada IS NULL OR BTRIM(unidade_fracionada) = '') AS nulos_ou_vazios,
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(unidade_fracionada)) = UPPER(TRIM(unidade_contagem))
      ) AS iguais_a_contagem,
      COUNT(*) AS total
    FROM insumos
  `;
  const stats = await pool.query(statsSql);
  log('1. Query totais', { sql: statsSql.trim(), rows: stats.rows });

  const carnesSql = `
    SELECT id_insumo, codigo, descricao, unidade_contagem, unidade_fracionada
    FROM insumos
    WHERE ativo = TRUE
      AND descricao ILIKE '%carne%'
      AND UPPER(TRIM(COALESCE(unidade_fracionada, ''))) = 'UND'
      AND UPPER(TRIM(unidade_contagem)) <> 'UND'
    ORDER BY codigo
    LIMIT 50
  `;
  const carnes = await pool.query(carnesSql);
  log('1. Carnes com fracionada=UND e contagem≠UND (não deveria existir após backfill)', {
    sql: carnesSql.trim(),
    rows: carnes.rows,
  });

  const sampleCarnesSql = `
    SELECT id_insumo, codigo, descricao, unidade_contagem, unidade_fracionada
    FROM insumos
    WHERE ativo = TRUE AND descricao ILIKE '%carne%'
    ORDER BY codigo
    LIMIT 15
  `;
  const sampleCarnes = await pool.query(sampleCarnesSql);
  log('1. Amostra de carnes (cadastro atual)', { sql: sampleCarnesSql.trim(), rows: sampleCarnes.rows });

  record(
    '1. Coluna unidade_fracionada existe',
    'coluna TEXT presente',
    col.rows[0] || 'AUSENTE',
    col.rows.length === 1 && col.rows[0].data_type === 'text',
  );
  record(
    '1. Insumos com unidade_fracionada NULL/vazia',
    '0 (backfill herda unidade_contagem)',
    Number(stats.rows[0].nulos_ou_vazios),
    Number(stats.rows[0].nulos_ou_vazios) === 0,
  );
  record(
    '1. Insumos com fracionada = contagem',
    `igual ao total (${stats.rows[0].total}) após herança, sem inferência UND`,
    `${stats.rows[0].iguais_a_contagem} / ${stats.rows[0].total}`,
    Number(stats.rows[0].iguais_a_contagem) === Number(stats.rows[0].total),
  );
  record(
    '1. Nenhuma carne auto-alterada para UND',
    '0 linhas carne com fracionada=UND e contagem≠UND',
    carnes.rows.length,
    carnes.rows.length === 0,
  );

  // ---------- contexto: Whopper real + loja/user ----------
  const whopperSql = `
    SELECT i.id_insumo, i.id_loja, i.codigo, i.descricao, i.unidade_contagem, i.unidade_fracionada,
           i.und_convertida, i.und_parcial, i.ativo
    FROM insumos i
    WHERE UPPER(TRIM(i.codigo)) = '021403' AND i.ativo = TRUE
    ORDER BY i.id_insumo
    LIMIT 5
  `;
  const whopperRows = await pool.query(whopperSql);
  log('4. Insumo real 021403 (não será UPDATE)', { sql: whopperSql.trim(), rows: whopperRows.rows });

  const tabelaConv = await pool.query(`
    SELECT to_regclass('public.estoque_conversoes') AS rel
  `);
  const tinhaConversoes = Boolean(tabelaConv.rows[0]?.rel);
  log('Ambiente estoque_conversoes', {
    exists: tinhaConversoes,
    nota: tinhaConversoes
      ? 'tabela já existia'
      : 'AUSENTE no vision_check_dev (migrations 160+ não aplicadas). Fixture CREATE TABLE IF NOT EXISTS só para testes descartáveis — não é correção do motor.',
  });
  if (!tinhaConversoes) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS estoque_conversoes (
        id_conversao SERIAL PRIMARY KEY,
        id_insumo INTEGER NOT NULL REFERENCES insumos(id_insumo) ON DELETE CASCADE,
        unidade_origem TEXT NOT NULL,
        unidade_destino TEXT NOT NULL,
        fator NUMERIC(14, 8) NOT NULL CHECK (fator > 0),
        origem_dado TEXT,
        status TEXT NOT NULL DEFAULT 'pendente'
          CHECK (status IN ('pendente', 'validado', 'bloqueado')),
        validado_em TIMESTAMPTZ,
        validado_por INTEGER,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_estoque_conversoes_insumo_unidades
          UNIQUE (id_insumo, unidade_origem, unidade_destino)
      )
    `);
  }
  record(
    'Ambiente: estoque_conversoes no vision_check_dev',
    'tabela presente (migrations 160+)',
    tinhaConversoes ? 'já existia' : 'AUSENTE — fixture criada para os testes 4b–10',
    true,
  );

  const convWhopperSql = `
    SELECT c.id_conversao, c.id_insumo, c.unidade_origem, c.unidade_destino, c.fator, c.status
    FROM estoque_conversoes c
    JOIN insumos i ON i.id_insumo = c.id_insumo
    WHERE UPPER(TRIM(i.codigo)) = '021403'
    ORDER BY c.id_insumo, c.unidade_origem
  `;
  const convWhopper = await pool.query(convWhopperSql);
  log('4. Conversões cadastradas do 021403', { sql: convWhopperSql.trim(), rows: convWhopper.rows });

  const whopperUc = String(whopperRows.rows[0]?.unidade_contagem || '').toUpperCase();
  const whopperUf = String(
    whopperRows.rows[0]?.unidade_fracionada || whopperRows.rows[0]?.unidade_contagem || '',
  ).toUpperCase();
  record(
    '4. Cadastro real 021403 (observação, sem UPDATE)',
    'cenário pedido: contagem=KG e fracionada=UND — se o cadastro for outro, documentar',
    `${whopperUc}/${whopperUf} und_convertida=${whopperRows.rows[0]?.und_convertida}`,
    true,
  );

  const whopperAntes = JSON.parse(JSON.stringify(whopperRows.rows));

  const userRow = await pool.query(`
    SELECT u.id_usuario, u.email, u.perfil
    FROM usuarios u
    WHERE u.ativo = TRUE
      AND EXISTS (
        SELECT 1 FROM usuario_permissoes p
        WHERE p.id_usuario = u.id_usuario AND p.codigo = 'estoque.conferencia'
      )
      AND EXISTS (
        SELECT 1 FROM usuario_permissoes p
        WHERE p.id_usuario = u.id_usuario AND p.codigo = 'lojas.todas'
      )
    ORDER BY u.id_usuario
    LIMIT 1
  `);
  if (!userRow.rows[0]) throw new Error('Nenhum usuário com estoque.conferencia + lojas.todas no dev');
  const user = userRow.rows[0];
  const token = signToken({ id_usuario: user.id_usuario, email: user.email, perfil: user.perfil });
  log('Usuário de teste (JWT)', { id_usuario: user.id_usuario, email: user.email, perfil: user.perfil });

  const lojas = await pool.query(`
    SELECT id_loja, name, bk_number
    FROM lojas
    WHERE COALESCE(is_active, TRUE)
      AND bk_number IS NOT NULL AND TRIM(bk_number::text) <> ''
      AND name ~* 'burger king|popyes|popeyes'
    ORDER BY id_loja
    LIMIT 5
  `);
  if (lojas.rows.length < 2) throw new Error('Preciso de 2 lojas ativas com bk_number para empréstimo');
  const idLoja = Number(whopperRows.rows[0]?.id_loja || lojas.rows[0].id_loja);
  const idLojaDest = Number(lojas.rows.find((l) => Number(l.id_loja) !== idLoja)?.id_loja);
  log('Lojas', { idLoja, idLojaDest, lojas: lojas.rows });

  // ---------- 3. KG → KG motor ----------
  const kgProduto = await pool.query(
    `SELECT id_insumo, codigo, descricao, unidade_contagem, unidade_fracionada, und_convertida
     FROM insumos
     WHERE ativo = TRUE
       AND UPPER(TRIM(unidade_contagem)) = 'KG'
       AND UPPER(TRIM(COALESCE(unidade_fracionada, unidade_contagem))) = 'KG'
       AND COALESCE(und_convertida, 0) > 0
     ORDER BY CASE WHEN UPPER(TRIM(codigo)) = '021403' THEN 0 ELSE 1 END, id_insumo
     LIMIT 1`,
  );
  const kgInsumo = kgProduto.rows[0] || {
    id_insumo: null,
    codigo: 'SYNTH-KG',
    descricao: 'identidade sintética (nenhum KG/KG no cadastro)',
    unidade_contagem: 'KG',
    unidade_fracionada: 'KG',
    und_convertida: 17.2,
  };
  const undCx = Number(kgInsumo.und_convertida);
  const esperadoKg = Math.round((2 * undCx + 1.5) * 10000) / 10000;
  let queriesConversaoKg = 0;
  const clientSpy = {
    query: async (text, params) => {
      if (String(text).includes('estoque_conversoes')) queriesConversaoKg += 1;
      return pool.query(text, params);
    },
  };
  const kgRows = [{ ...kgInsumo }];
  await anexarFatoresFracionada(clientSpy, kgRows);
  const rKg = resolverQtdContagem({
    contagem_caixa: 2,
    contagem_pc_fd: 0,
    contagem_kg_und: 1.5,
    und_convertida: undCx,
    und_parcial: 1,
    unidade_contagem: 'KG',
    unidade_fracionada: 'KG',
    fator_fracionada: kgRows[0].fator_fracionada,
    fator_fracionada_status: kgRows[0].fator_fracionada_status,
    id_insumo: kgInsumo.id_insumo,
    codigo: kgInsumo.codigo,
  });
  const convIdent = aplicarConversaoUnidades({
    quantidade: 1.5,
    unidadeOrigem: 'KG',
    unidadeDestino: 'KG',
    permitirZero: true,
  });
  log('3. Retrocompat KG→KG', {
    insumo: kgInsumo,
    entrada: { CAIXA: 2, 'PC/FD': 0, 'KG/UND': 1.5 },
    unidade_origem: 'KG',
    unidade_destino: 'KG',
    precisa_fator: false,
    fator_anexado: kgRows[0].fator_fracionada,
    origem_fracionada: convIdent,
    consultas_estoque_conversoes: queriesConversaoKg,
    qtd: rKg,
    esperado: `2 × ${undCx} + 1,5 = ${esperadoKg}`,
  });
  record(
    '3. KG→KG QTD = 2×und_convertida + 1,5',
    esperadoKg,
    rKg.ok ? rKg.qtd : rKg,
    rKg.ok && rKg.qtd === esperadoKg,
  );
  record(
    '3. KG→KG sem lookup em estoque_conversoes',
    '0 queries em estoque_conversoes (identidade)',
    queriesConversaoKg,
    queriesConversaoKg === 0,
  );

  // ---------- 4. Whopper UND→KG (motor, sem UPDATE do cadastro) ----------
  const fatorWh = 17.2 / 152;
  const esperadoWh = Math.round((2 * 17.2 + 37 * fatorWh) * 10000) / 10000;
  const rWh = resolverQtdContagem({
    contagem_caixa: 2,
    contagem_pc_fd: 0,
    contagem_kg_und: 37,
    und_convertida: 17.2,
    und_parcial: 1,
    unidade_contagem: 'KG',
    unidade_fracionada: 'UND',
    fator_fracionada: fatorWh,
    fator_fracionada_status: 'validado',
    id_insumo: whopperRows.rows[0]?.id_insumo ?? null,
    codigo: '021403',
  });
  const qtdFrac = aplicarConversaoUnidades({
    quantidade: 37,
    unidadeOrigem: 'UND',
    unidadeDestino: 'KG',
    fatorConversao: fatorWh,
    fatorStatus: 'validado',
    permitirZero: true,
  });
  log('4. Motor Whopper UND→KG (cadastro real NÃO alterado)', {
    id_insumo: whopperRows.rows[0]?.id_insumo ?? null,
    codigo: '021403',
    cadastro_atual: whopperRows.rows[0] || null,
    unidade_origem: 'UND',
    unidade_destino: 'KG',
    fator: fatorWh,
    parcela_caixas: 2 * 17.2,
    quantidade_fracionada_convertida: qtdFrac,
    qtd_final: rWh,
    esperado: esperadoWh,
    legado_errado_seria: 2 * 17.2 + 37,
  });
  record(
    '4. Whopper 2 cx + 37 UND ≈ 38,5868 KG',
    esperadoWh,
    rWh.ok ? rWh.qtd : rWh,
    rWh.ok && rWh.qtd === esperadoWh && rWh.qtd !== 2 * 17.2 + 37,
  );
  record(
    '4. 37 UND não viraram 37 KG',
    `qtd ≠ ${2 * 17.2 + 37} e parcela fracionada ≈ ${37 * fatorWh}`,
    { qtd: rWh.qtd, fracionada: qtdFrac.quantidade },
    rWh.ok && qtdFrac.ok && almostEqual(qtdFrac.quantidade, 37 * fatorWh, 1e-6) && rWh.qtd < 40,
  );

  const idsWhopperAntes = whopperAntes.map((r) => Number(r.id_insumo));
  const whopperDepois = await pool.query(
    `SELECT id_insumo, codigo, unidade_contagem, unidade_fracionada, und_convertida
     FROM insumos WHERE id_insumo = ANY($1::int[]) ORDER BY id_insumo`,
    [idsWhopperAntes],
  );
  record(
    '4. Cadastro 021403 intacto',
    JSON.stringify(whopperAntes.map((r) => ({ id: r.id_insumo, uf: r.unidade_fracionada, uc: r.unidade_contagem }))),
    JSON.stringify(
      whopperDepois.rows.map((r) => ({ id: r.id_insumo, uf: r.unidade_fracionada, uc: r.unidade_contagem })),
    ),
    JSON.stringify(whopperAntes.map((r) => [r.id_insumo, r.unidade_fracionada, r.unidade_contagem, r.und_convertida])) ===
      JSON.stringify(
        whopperDepois.rows.map((r) => [r.id_insumo, r.unidade_fracionada, r.unidade_contagem, r.und_convertida]),
      ),
  );

  // ---------- fixtures descartáveis + API real ----------
  const insOk = await pool.query(
    `INSERT INTO insumos (
       id_loja, codigo, descricao, unidade_contagem, unidade_fracionada,
       preco_caixa, und_convertida, und_parcial, ativo,
       permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
     ) VALUES ($1,$2,'ETAPA1 OK identidade KG',$3,$4,0,17.2,1,TRUE,TRUE,TRUE,TRUE)
     RETURNING id_insumo, codigo`,
    [idLoja, `${TAG}-OK`, 'KG', 'KG'],
  );
  const insFail = await pool.query(
    `INSERT INTO insumos (
       id_loja, codigo, descricao, unidade_contagem, unidade_fracionada,
       preco_caixa, und_convertida, und_parcial, ativo,
       permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
     ) VALUES ($1,$2,'ETAPA1 FAIL sem conversao',$3,$4,0,17.2,1,TRUE,TRUE,TRUE,TRUE)
     RETURNING id_insumo, codigo`,
    [idLoja, `${TAG}-FAIL`, 'KG', 'UND'],
  );
  const insWh = await pool.query(
    `INSERT INTO insumos (
       id_loja, codigo, descricao, unidade_contagem, unidade_fracionada,
       preco_caixa, und_convertida, und_parcial, ativo,
       permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
     ) VALUES ($1,$2,'ETAPA1 clone Whopper UND→KG',$3,$4,0,17.2,1,TRUE,TRUE,TRUE,TRUE)
     RETURNING id_insumo, codigo`,
    [idLoja, `${TAG}-WH`, 'KG', 'UND'],
  );
  const insEmp = await pool.query(
    `INSERT INTO insumos (
       id_loja, codigo, descricao, unidade_contagem, unidade_fracionada,
       preco_caixa, und_convertida, und_parcial, ativo,
       permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
     ) VALUES ($1,$2,'ETAPA1 emprestimo UND validado',$3,$4,0,17.2,1,TRUE,TRUE,TRUE,TRUE)
     RETURNING id_insumo, codigo`,
    [idLoja, `${TAG}-EMP`, 'KG', 'UND'],
  );
  cleanup.idInsumos = [
    insOk.rows[0].id_insumo,
    insFail.rows[0].id_insumo,
    insWh.rows[0].id_insumo,
    insEmp.rows[0].id_insumo,
  ];

  await pool.query(
    `INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
     VALUES ($1,'und','kg',$2,'validacao_etapa1','validado',NOW())`,
    [insWh.rows[0].id_insumo, fatorWh],
  );
  await pool.query(
    `INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
     VALUES ($1,'und','kg',$2,'validacao_etapa1','validado',NOW())`,
    [insEmp.rows[0].id_insumo, fatorWh],
  );

  const cont = await pool.query(
    `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, tipo)
     VALUES ($1, CURRENT_DATE, $2, 'aberta', 'validacao etapa 1 — apagar', 'completa')
     RETURNING id_contagem`,
    [idLoja, `${TAG} contagem`],
  );
  cleanup.idContagem = cont.rows[0].id_contagem;

  const itensIns = await pool.query(
    `INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado, contagem_caixa, contagem_pc_fd, contagem_kg_und)
     VALUES
       ($1, $2, 0, 9.999, 1, 0, 0.1),
       ($1, $3, 0, 8.888, 1, 0, 0.2),
       ($1, $4, 0, NULL, NULL, NULL, NULL)
     RETURNING id_item, id_insumo, estoque_contado, contagem_caixa, contagem_pc_fd, contagem_kg_und`,
    [cleanup.idContagem, insOk.rows[0].id_insumo, insFail.rows[0].id_insumo, insWh.rows[0].id_insumo],
  );
  const itemOk = itensIns.rows.find((r) => Number(r.id_insumo) === Number(insOk.rows[0].id_insumo));
  const itemFail = itensIns.rows.find((r) => Number(r.id_insumo) === Number(insFail.rows[0].id_insumo));
  const itemWh = itensIns.rows.find((r) => Number(r.id_insumo) === Number(insWh.rows[0].id_insumo));

  const { server: srv, base } = await startMiniApi();
  server = srv;
  log('API mini (router real de estoque.js)', { base, id_contagem: cleanup.idContagem });

  // clone Whopper via PUT isolado
  const snapWhAntes = await snapshotItens([itemWh.id_item]);
  const putWh = await apiPut(base, token, cleanup.idContagem, {
    itens: [
      {
        id_item: itemWh.id_item,
        contagem_caixa: 2,
        contagem_pc_fd: 0,
        contagem_kg_und: 37,
      },
    ],
  });
  const snapWhDepois = await snapshotItens([itemWh.id_item]);
  log('4b. PUT clone Whopper (descartável, não é 021403)', {
    payload: { id_item: itemWh.id_item, caixa: 2, pc: 0, kg_und: 37 },
    http: putWh,
    antes: snapWhAntes,
    depois: snapWhDepois,
  });
  const qtdWhGravada = snapWhDepois[0] ? Number(snapWhDepois[0].estoque_contado) : null;
  record(
    '4b. PUT clone Whopper grava ≈38,5868 e não 71,4',
    esperadoWh,
    { http: putWh.status, estoque_contado: qtdWhGravada },
    putWh.status === 200 && almostEqual(qtdWhGravada, esperadoWh) && qtdWhGravada !== 2 * 17.2 + 37,
  );

  // restaurar item WH para não atrapalhar atomicidade
  await pool.query(
    `UPDATE estoque_itens SET estoque_contado = NULL, contagem_caixa = NULL, contagem_pc_fd = NULL, contagem_kg_und = NULL
     WHERE id_item = $1`,
    [itemWh.id_item],
  );

  // ---------- 5. conversão inexistente ----------
  const antesFail = await snapshotItens([itemFail.id_item]);
  const payloadFail = {
    itens: [
      {
        id_item: itemFail.id_item,
        contagem_caixa: 2,
        contagem_pc_fd: 0,
        contagem_kg_und: 37,
      },
    ],
  };
  const putFail = await apiPut(base, token, cleanup.idContagem, payloadFail);
  const depoisFail = await snapshotItens([itemFail.id_item]);
  log('5. PUT conversão inexistente', {
    payload: payloadFail,
    http: putFail,
    antes: antesFail,
    depois: depoisFail,
  });
  const failItem = putFail.data?.itens?.[0] || {};
  record(
    '5. PUT sem conversão → HTTP 400 + motivo',
    '400 conversao_nao_encontrada + id/codigo/und→kg',
    {
      status: putFail.status,
      motivo: putFail.data?.motivo,
      item: failItem,
    },
    putFail.status === 400 &&
      putFail.data?.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA &&
      Number(failItem.id_insumo) === Number(insFail.rows[0].id_insumo) &&
      String(failItem.codigo) === insFail.rows[0].codigo &&
      failItem.unidade_origem === 'und' &&
      failItem.unidade_destino === 'kg',
  );
  record(
    '5. Registro não alterado após 400',
    JSON.stringify(antesFail),
    JSON.stringify(depoisFail),
    JSON.stringify(antesFail) === JSON.stringify(depoisFail) &&
      Number(depoisFail[0].estoque_contado) === 8.888,
  );

  // ---------- 6. atomicidade ----------
  const antesAtom = await snapshotItens([itemOk.id_item, itemFail.id_item]);
  const payloadAtom = {
    itens: [
      {
        id_item: itemOk.id_item,
        contagem_caixa: 2,
        contagem_pc_fd: 0,
        contagem_kg_und: 1.5,
      },
      {
        id_item: itemFail.id_item,
        contagem_caixa: 2,
        contagem_pc_fd: 0,
        contagem_kg_und: 37,
      },
    ],
  };
  const putAtom = await apiPut(base, token, cleanup.idContagem, payloadAtom);
  const depoisAtom = await snapshotItens([itemOk.id_item, itemFail.id_item]);
  log('6. Atomicidade PUT (1 válido + 1 sem conversão)', {
    payload: payloadAtom,
    http: putAtom,
    antes: antesAtom,
    depois: depoisAtom,
  });
  record(
    '6. PUT misto → 400 e nenhum item persistido',
    '400 + snapshots idênticos (ok continua 9.999 / fail 8.888)',
    {
      status: putAtom.status,
      motivo: putAtom.data?.motivo,
      antes: antesAtom,
      depois: depoisAtom,
    },
    putAtom.status === 400 &&
      JSON.stringify(antesAtom) === JSON.stringify(depoisAtom) &&
      Number(depoisAtom.find((r) => Number(r.id_item) === Number(itemOk.id_item)).estoque_contado) === 9.999 &&
      Number(depoisAtom.find((r) => Number(r.id_item) === Number(itemFail.id_item)).estoque_contado) === 8.888,
  );

  // ---------- 7. quantidade zero ----------
  const rZeroMotor = aplicarConversaoUnidades({
    quantidade: 0,
    unidadeOrigem: 'KG',
    unidadeDestino: 'KG',
    permitirZero: true,
  });
  const rZeroQtd = resolverQtdContagem({
    contagem_caixa: 0,
    contagem_pc_fd: 0,
    contagem_kg_und: 0,
    und_convertida: 17.2,
    unidade_contagem: 'KG',
    unidade_fracionada: 'KG',
  });
  const antesZero = await snapshotItens([itemOk.id_item]);
  const putZero = await apiPut(base, token, cleanup.idContagem, {
    itens: [
      {
        id_item: itemOk.id_item,
        contagem_caixa: 0,
        contagem_pc_fd: 0,
        contagem_kg_und: 0,
      },
    ],
  });
  const depoisZero = await snapshotItens([itemOk.id_item]);
  log('7. Quantidade zero', {
    motor_identidade: rZeroMotor,
    resolverQtd: rZeroQtd,
    http: putZero,
    antes: antesZero,
    depois: depoisZero,
  });
  record(
    '7. Motor aceita 0 (não quantidade_invalida)',
    '{ok:true, qtd:0}',
    { conv: rZeroMotor, qtd: rZeroQtd },
    rZeroMotor.ok && rZeroMotor.quantidade === 0 && rZeroQtd.ok && rZeroQtd.qtd === 0,
  );
  record(
    '7. PUT aceita 0 e grava QTD 0',
    'HTTP 200 e estoque_contado = 0',
    { status: putZero.status, row: depoisZero[0] },
    putZero.status === 200 && Number(depoisZero[0].estoque_contado) === 0,
  );

  // ---------- 8. decimais + vírgula ----------
  const frontVals = ['0,500', '1,700', '2,250'].map((s) => ({
    raw_ui: s,
    enviado_pelo_frontend: parseNumCampoFront(s),
  }));
  const decimais = [];
  for (const v of [0.5, 1.7, 2.25]) {
    const putDec = await apiPut(base, token, cleanup.idContagem, {
      itens: [
        {
          id_item: itemOk.id_item,
          contagem_caixa: 0,
          contagem_pc_fd: 0,
          contagem_kg_und: v,
        },
      ],
    });
    const after = await snapshotItens([itemOk.id_item]);
    decimais.push({
      enviado_json: v,
      http: putDec.status,
      estoque_contado: after[0]?.estoque_contado,
    });
  }
  const putVirgula = await apiPut(base, token, cleanup.idContagem, {
    itens: [
      {
        id_item: itemOk.id_item,
        contagem_caixa: 0,
        contagem_pc_fd: 0,
        contagem_kg_und: '0,500',
      },
    ],
  });
  const afterVirgula = await snapshotItens([itemOk.id_item]);
  const motorVirgula = aplicarConversaoUnidades({
    quantidade: '0,500',
    unidadeOrigem: 'KG',
    unidadeDestino: 'KG',
    permitirZero: true,
  });
  log('8. Decimais identidade + vírgula', {
    frontend_parseNumCampo: frontVals,
    puts_numericos: decimais,
    put_string_virgula_crua: { http: putVirgula, depois: afterVirgula },
    motor_string_virgula: motorVirgula,
    nota: 'Frontend troca vírgula por ponto antes do JSON. Backend Number("0,500") é NaN.',
  });
  record(
    '8. Frontend normaliza 0,500 / 1,700 / 2,250',
    [0.5, 1.7, 2.25],
    frontVals.map((x) => x.enviado_pelo_frontend),
    frontVals.map((x) => x.enviado_pelo_frontend).join() === '0.5,1.7,2.25',
  );
  record(
    '8. PUT identidade grava 0.5 / 1.7 / 2.25',
    [0.5, 1.7, 2.25],
    decimais.map((d) => Number(d.estoque_contado)),
    decimais.every((d) => d.http === 200) &&
      almostEqual(Number(decimais[0].estoque_contado), 0.5) &&
      almostEqual(Number(decimais[1].estoque_contado), 1.7) &&
      almostEqual(Number(decimais[2].estoque_contado), 2.25),
  );

  // ---------- 9. baixa (núcleo refatorado) ----------
  const baixaOk = resolverConsumoEstoque({
    quantidadeReceita: 2,
    unidadeReceita: 'und',
    unidadeEstoque: 'KG',
    fatorConversao: 0.0115,
    fatorStatus: 'validado',
  });
  const baixaAusente = resolverConsumoEstoque({
    quantidadeReceita: 2,
    unidadeReceita: 'und',
    unidadeEstoque: 'KG',
  });
  const baixaBloq = resolverConsumoEstoque({
    quantidadeReceita: 2,
    unidadeReceita: 'und',
    unidadeEstoque: 'KG',
    fatorConversao: 0.0115,
    fatorStatus: 'bloqueado',
  });
  const baixaQtd = resolverConsumoEstoque({
    quantidadeReceita: 0,
    unidadeReceita: 'und',
    unidadeEstoque: 'KG',
    fatorConversao: 0.0115,
    fatorStatus: 'validado',
  });
  const baixaInsumoOk = await resolverConsumoInsumo(pool, {
    idInsumo: insWh.rows[0].id_insumo,
    quantidadeReceita: 37,
    unidadeReceita: 'UND',
    unidadeEstoque: 'KG',
  });
  const baixaInsumoAusente = await resolverConsumoInsumo(pool, {
    idInsumo: insFail.rows[0].id_insumo,
    quantidadeReceita: 37,
    unidadeReceita: 'UND',
    unidadeEstoque: 'KG',
  });
  log('9. Baixa — núcleo compartilhado', {
    validada: baixaOk,
    ausente: baixaAusente,
    bloqueada: baixaBloq,
    qtd_invalida: baixaQtd,
    resolverConsumoInsumo_validada: baixaInsumoOk,
    resolverConsumoInsumo_ausente: baixaInsumoAusente,
  });
  record(
    '9. Baixa conversão validada',
    'ok + quantidadeEstoque 0.023 + fator_validado',
    baixaOk,
    baixaOk.ok && baixaOk.quantidadeEstoque === 0.023 && baixaOk.origemConversao === 'fator_validado',
  );
  record(
    '9. Baixa conversão ausente → CONVERSAO_NAO_VALIDADA',
    MOTIVO_BAIXA.CONVERSAO_NAO_VALIDADA,
    baixaAusente.motivo,
    !baixaAusente.ok && baixaAusente.motivo === MOTIVO_BAIXA.CONVERSAO_NAO_VALIDADA,
  );
  record(
    '9. Baixa fator bloqueado → CONVERSAO_BLOQUEADA',
    MOTIVO_BAIXA.CONVERSAO_BLOQUEADA,
    baixaBloq.motivo,
    !baixaBloq.ok && baixaBloq.motivo === MOTIVO_BAIXA.CONVERSAO_BLOQUEADA,
  );
  record(
    '9. Baixa quantidade 0 → QUANTIDADE_INVALIDA',
    MOTIVO_BAIXA.QUANTIDADE_INVALIDA,
    baixaQtd.motivo,
    !baixaQtd.ok && baixaQtd.motivo === MOTIVO_BAIXA.QUANTIDADE_INVALIDA,
  );
  record(
    '9. resolverConsumoInsumo UND→KG validada (clone Whopper)',
    `ok ≈ ${37 * fatorWh}`,
    baixaInsumoOk,
    baixaInsumoOk.ok && almostEqual(baixaInsumoOk.quantidadeEstoque, 37 * fatorWh, 1e-6),
  );
  record(
    '9. resolverConsumoInsumo sem fator → CONVERSAO_NAO_VALIDADA',
    MOTIVO_BAIXA.CONVERSAO_NAO_VALIDADA,
    baixaInsumoAusente.motivo,
    !baixaInsumoAusente.ok && baixaInsumoAusente.motivo === MOTIVO_BAIXA.CONVERSAO_NAO_VALIDADA,
  );

  // ---------- 10. empréstimo (transação + ROLLBACK) ----------
  // Schema 167 no pool (autocommit): se o ALTER rodar DENTRO do BEGIN do trial,
  // o ROLLBACK desfaz a coluna e o flag em memória impede recriar.
  const sql167 = fs.readFileSync(
    path.join(backendRoot, 'migrations/167_estoque_emprestimo_recebimento.sql'),
    'utf8',
  );
  await pool.query(sql167);
  const colRec = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='estoque_break' AND column_name='recebimento_status'
  `);
  log('10. Schema empréstimo (migration 167 no pool, fora do trial)', colRec.rows);

  const esperadoEmpIdent = Math.round((2 * 17.2 + 1.5) * 10000) / 10000;

  async function emprestimoTrial(itens) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await lancarBreak(
        {
          id_loja: idLoja,
          id_loja_destino: idLojaDest,
          tipo: 'emprestimo',
          itens,
          motivo: 'validacao etapa 1',
        },
        client,
      );
      await client.query('ROLLBACK');
      return { ok: true, result: r };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      return { ok: false, status: e.status || null, message: e.message, result: null };
    } finally {
      client.release();
    }
  }

  const empIdent = await emprestimoTrial([
    {
      id_insumo: insOk.rows[0].id_insumo,
      contagem_caixa: 2,
      contagem_pc_fd: 0,
      contagem_kg_und: 1.5,
    },
  ]);
  const empValid = await emprestimoTrial([
    {
      id_insumo: insEmp.rows[0].id_insumo,
      contagem_caixa: 2,
      contagem_pc_fd: 0,
      contagem_kg_und: 37,
    },
  ]);
  const empSem = await emprestimoTrial([
    {
      id_insumo: insFail.rows[0].id_insumo,
      contagem_caixa: 2,
      contagem_pc_fd: 0,
      contagem_kg_und: 37,
    },
  ]);
  const empMisto = await emprestimoTrial([
    {
      id_insumo: insOk.rows[0].id_insumo,
      contagem_caixa: 1,
      contagem_pc_fd: 0,
      contagem_kg_und: 0,
    },
    {
      id_insumo: insFail.rows[0].id_insumo,
      contagem_caixa: 2,
      contagem_pc_fd: 0,
      contagem_kg_und: 37,
    },
  ]);
  log('10. Empréstimo (lançar + ROLLBACK — nada persistido)', {
    identidade: empIdent,
    fator_valido: empValid,
    sem_fator: empSem,
    misto_valido_mais_sem_fator: empMisto,
    nota: 'Sem fator o item é pulado (erros[]). Se só houver esse item, lancarBreak lança 400.',
  });

  const qtdIdentEmp = empIdent.result?.baixas?.[0]?.quantidade;
  record(
    '10. Empréstimo identidade KG→KG',
    `baixa −${esperadoEmpIdent} (2×17,2+1,5 do insumo descartável)`,
    empIdent,
    empIdent.ok && almostEqual(Math.abs(Number(qtdIdentEmp)), esperadoEmpIdent),
  );
  record(
    '10. Empréstimo UND→KG com fator',
    `baixa −${esperadoWh}`,
    empValid,
    empValid.ok && almostEqual(Math.abs(Number(empValid.result?.baixas?.[0]?.quantidade)), esperadoWh),
  );
  record(
    '10. Empréstimo sem fator — item pulado / 400 se lote vazio',
    'ok:false status 400 e mensagem com conversao_nao_encontrada',
    empSem,
    empSem.ok === false &&
      empSem.status === 400 &&
      String(empSem.message).includes('conversao_nao_encontrada'),
  );
  record(
    '10. Empréstimo misto: válido persiste no cálculo; inválido vai para erros (não-atômico)',
    '1 baixa + 1 erro; documentar, não alterar',
    {
      baixas: empMisto.result?.baixas,
      erros: empMisto.result?.erros,
    },
    empMisto.ok &&
      empMisto.result?.baixas?.length === 1 &&
      empMisto.result?.erros?.length === 1 &&
      String(empMisto.result.erros[0]).includes('conversao_nao_encontrada'),
  );

  const leftover = await pool.query(
    `SELECT COUNT(*)::int AS n FROM estoque_break WHERE motivo = 'validacao etapa 1' AND criado_em > NOW() - INTERVAL '10 minutes'`,
  );
  record(
    '10. ROLLBACK do empréstimo — nenhum break persistido',
    0,
    leftover.rows[0].n,
    leftover.rows[0].n === 0,
  );
} catch (e) {
  if (e.message !== 'unit-fail-stop') {
    console.error('\nERRO na validação:', e);
    record('VALIDAÇÃO abortou com exceção', 'concluir todos os testes', e.message, false);
    process.exitCode = 1;
  }
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  try {
    await limpar();
    log('Cleanup', { tag: TAG, removido: true });
  } catch (e) {
    console.error('Falha no cleanup:', e.message);
  }
  await pool.end();

  console.log('\n########## TABELA FINAL ##########\n');
  console.log('| Teste | Esperado | Obtido | PASS/FAIL |');
  console.log('|---|---|---|---|');
  for (const r of results) {
    const esp = String(r.esperado).replace(/\|/g, '/').replace(/\n/g, ' ');
    const obt = String(typeof r.obtido === 'string' ? r.obtido : JSON.stringify(r.obtido))
      .replace(/\|/g, '/')
      .replace(/\n/g, ' ');
    console.log(`| ${r.teste} | ${esp} | ${obt} | ${r.status} |`);
  }
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\nTotal: ${results.length}  PASS: ${pass}  FAIL: ${fail}`);
  if (fail > 0) process.exitCode = 1;
}
