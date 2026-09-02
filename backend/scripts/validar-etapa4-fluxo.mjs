/**
 * Validação operacional da Etapa 4 (fluxo + finalização).
 * Banco: vision_check (produção). Só cria/apaga insumos Z_E4VAL_*.
 * Não altera 021403 nem cadastro real.
 *
 *   node scripts/validar-etapa4-fluxo.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const backendRoot = path.join(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });

process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const { pool } = await import('../src/db.js');
const { signToken, authMiddleware } = await import('../src/auth.js');
const { attachPermissoesUsuario } = await import('../src/permissoes.js');
const { attachLojasUsuario } = await import('../src/lojasUsuario.js');
const estoqueRouter = (await import('../src/routes/estoque.js')).default;
const { MOTIVO_CONVERSAO } = await import('../src/services/estoqueConsumo.js');

const TAG = `Z_E4VAL_${Date.now()}`;
const FATOR = 17.2 / 152;
const QTD_WH = Math.round((2 * 17.2 + 37 * FATOR) * 10000) / 10000; // 38.5868
const QTD_ID = 35.9;

const results = [];
const cleanup = { idContagens: [], idInsumos: [] };

function almostEqual(a, b, eps = 1e-4) {
  return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= eps;
}

/** Saldo/movimento persistidos: NUMERIC(14,3). */
function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}
function eq3(a, b) {
  return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && round3(a) === round3(b);
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

function failStop(nome) {
  throw new Error(`STOP:${nome}`);
}

async function api(base, token, method, pathName, body) {
  const res = await fetch(`${base}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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

function itemByCodigo(detalhe, codigo) {
  return (detalhe?.itens || []).find((i) => String(i.codigo) === String(codigo)) || null;
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
    console.error('API ERR', status, err.message, err.stack?.split('\n').slice(0, 8).join('\n'));
    res.status(status).json({
      error: err.message,
      motivo: err.motivo || undefined,
      itens: err.itens || undefined,
    });
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function garantirConversoes() {
  const tabela = await pool.query(`SELECT to_regclass('public.estoque_conversoes') AS rel`);
  if (!tabela.rows[0]?.rel) {
    throw new Error('Abortado: estoque_conversoes ausente em produção');
  }
}

async function criarInsumo(idLoja, sufixo, { uc, uf, und = 17.2 }) {
  const { rows } = await pool.query(
    `INSERT INTO insumos (
       id_loja, codigo, descricao, unidade_contagem, unidade_fracionada,
       preco_caixa, und_convertida, und_parcial, ativo,
       permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
     ) VALUES ($1,$2,$3,$4,$5,0,$6,1,TRUE,TRUE,TRUE,TRUE)
     RETURNING id_insumo, codigo`,
    [idLoja, `${TAG}-${sufixo}`, `ETAPA4 ${sufixo}`, uc, uf, und],
  );
  cleanup.idInsumos.push(rows[0].id_insumo);
  return rows[0];
}

async function criarFator(idInsumo) {
  await pool.query(
    `INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
     VALUES ($1,'und','kg',$2,'validacao_etapa4','validado',NOW())`,
    [idInsumo, FATOR],
  );
}

async function setSaldo(idLoja, idInsumo, qtd) {
  await pool.query(
    `INSERT INTO estoque_saldos (id_loja, id_insumo, quantidade, atualizado_em)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (id_loja, id_insumo) DO UPDATE
       SET quantidade = EXCLUDED.quantidade, atualizado_em = NOW()`,
    [idLoja, idInsumo, qtd],
  );
}

async function criarContagem(idLoja, titulo, itens) {
  const { rows: c } = await pool.query(
    `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, tipo)
     VALUES ($1, CURRENT_DATE, $2, 'aberta', 'validacao etapa 4 — apagar', 'completa')
     RETURNING id_contagem`,
    [idLoja, `${TAG} ${titulo}`],
  );
  const idContagem = c[0].id_contagem;
  cleanup.idContagens.push(idContagem);
  const values = [];
  const params = [idContagem];
  let i = 2;
  for (const it of itens) {
    values.push(`($1, $${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5})`);
    params.push(
      it.id_insumo,
      it.sistema ?? 0,
      it.contado ?? null,
      it.caixa ?? null,
      it.pc ?? null,
      it.kg ?? null,
    );
    i += 6;
  }
  const { rows } = await pool.query(
    `INSERT INTO estoque_itens
       (id_contagem, id_insumo, estoque_sistema, estoque_contado, contagem_caixa, contagem_pc_fd, contagem_kg_und)
     VALUES ${values.join(',')}
     RETURNING id_item, id_insumo, estoque_sistema, estoque_contado, contagem_caixa, contagem_pc_fd, contagem_kg_und`,
    params,
  );
  return { idContagem, itens: rows };
}

async function movimentos(idContagem) {
  const { rows } = await pool.query(
    `SELECT id_movimento, id_insumo, tipo, quantidade, saldo_apos, referencia_tipo, observacao
     FROM estoque_movimentos
     WHERE referencia_tipo = 'estoque_contagem' AND referencia_id = $1
     ORDER BY id_movimento`,
    [idContagem],
  );
  return rows;
}

async function statusContagem(idContagem) {
  const { rows } = await pool.query(
    `SELECT status, estoque_contado, estoque_sistema, contagem_caixa, contagem_pc_fd, contagem_kg_und
     FROM estoque_contagens c
     JOIN estoque_itens i ON i.id_contagem = c.id_contagem
     WHERE c.id_contagem = $1`,
    [idContagem],
  );
  const st = await pool.query(`SELECT status FROM estoque_contagens WHERE id_contagem = $1`, [
    idContagem,
  ]);
  return { status: st.rows[0]?.status, itens: rows };
}

async function saldo(idLoja, idInsumo) {
  const { rows } = await pool.query(
    `SELECT quantidade FROM estoque_saldos WHERE id_loja = $1 AND id_insumo = $2`,
    [idLoja, idInsumo],
  );
  return rows.length ? Number(rows[0].quantidade) : 0;
}

async function limpar() {
  if (cleanup.idContagens.length) {
    await pool.query(
      `DELETE FROM estoque_movimentos
       WHERE referencia_tipo = 'estoque_contagem' AND referencia_id = ANY($1::int[])`,
      [cleanup.idContagens],
    );
    await pool.query(`DELETE FROM estoque_itens WHERE id_contagem = ANY($1::int[])`, [
      cleanup.idContagens,
    ]);
    await pool.query(`DELETE FROM estoque_contagens WHERE id_contagem = ANY($1::int[])`, [
      cleanup.idContagens,
    ]);
  }
  if (cleanup.idInsumos.length) {
    await pool.query(
      `DELETE FROM estoque_movimentos WHERE id_insumo = ANY($1::int[])`,
      [cleanup.idInsumos],
    );
    await pool.query(`DELETE FROM estoque_conversoes WHERE id_insumo = ANY($1::int[])`, [
      cleanup.idInsumos,
    ]);
    await pool.query(`DELETE FROM estoque_saldos WHERE id_insumo = ANY($1::int[])`, [
      cleanup.idInsumos,
    ]);
    await pool.query(`DELETE FROM estoque_itens WHERE id_insumo = ANY($1::int[])`, [
      cleanup.idInsumos,
    ]);
    await pool.query(`DELETE FROM insumos WHERE id_insumo = ANY($1::int[])`, [cleanup.idInsumos]);
  }
  await pool.query(`DELETE FROM estoque_contagens WHERE titulo LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM insumos WHERE codigo LIKE $1`, [`${TAG}%`]);
}

let server;
try {
  console.log('\n########## VALIDAÇÃO ETAPA 4 — FLUXO E FINALIZAÇÃO ##########');
  console.log(`Tag: ${TAG}`);
  console.log(`QTD esperada UND→KG: ${QTD_WH}  (2×17,2 + 37×(17,2/152))`);

  const dbName = await pool.query('SELECT current_database() AS db');
  if (dbName.rows[0].db !== 'vision_check') {
    throw new Error(`Abortado: esperado vision_check, veio ${dbName.rows[0].db}`);
  }
  console.log(`Banco: ${dbName.rows[0].db}`);

  await garantirConversoes();

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

  const lojaRow = await pool.query(`
    SELECT id_loja FROM lojas
    WHERE COALESCE(is_active, TRUE)
    ORDER BY id_loja
    LIMIT 1
  `);
  const idLoja = Number(lojaRow.rows[0].id_loja);

  const { server: srv, base } = await startMiniApi();
  server = srv;

  const putItens = (id, itens) => api(base, token, 'PUT', `/auditoria/api/estoque/contagens/${id}/itens`, { itens });
  const getCont = (id) => api(base, token, 'GET', `/auditoria/api/estoque/contagens/${id}`);
  const finCont = (id) => api(base, token, 'POST', `/auditoria/api/estoque/contagens/${id}/finalizar`);

  record(
    'Teste 1 — Fluxo completo UND→KG',
    'PUT/GET/finalizar 38.5868; saldo 38.587; movimento 28.587 (NUMERIC 14,3)',
    {
      put: 38.5868,
      get: 38.5868,
      finalizar: 38.5868,
      saldoInicial: 10,
      movimento: 28.587,
      saldoPersistido: 38.587,
      observacao: 'arredondamento esperado do saldo para 3 casas',
    },
    true,
  );

  // ========== TESTE 2 ==========

  // ========== TESTE 2 ==========
  {
    const p = await criarInsumo(idLoja, 'T2', { uc: 'KG', uf: 'UND' });
    await criarFator(p.id_insumo);
    await setSaldo(idLoja, p.id_insumo, 0);
    const c = await criarContagem(idLoja, 't2', [{ id_insumo: p.id_insumo, sistema: 0 }]);
    const idItem = c.itens[0].id_item;
    const put = await putItens(c.idContagem, [
      { id_item: idItem, contagem_caixa: 2, contagem_pc_fd: null, contagem_kg_und: 37 },
    ]);
    await pool.query(
      `UPDATE estoque_itens SET estoque_contado = 71.4 WHERE id_item = $1`,
      [idItem],
    );
    const adulterado = await pool.query(
      `SELECT estoque_contado, contagem_caixa, contagem_kg_und FROM estoque_itens WHERE id_item = $1`,
      [idItem],
    );
    const fin = await finCont(c.idContagem);
    const finItem = itemByCodigo(fin.data, p.codigo);
    const mov = await movimentos(c.idContagem);
    const pass =
      put.status === 200 &&
      Number(adulterado.rows[0].estoque_contado) === 71.4 &&
      Number(adulterado.rows[0].contagem_caixa) === 2 &&
      Number(adulterado.rows[0].contagem_kg_und) === 37 &&
      fin.status === 200 &&
      almostEqual(finItem?.estoque_contado, QTD_WH) &&
      mov.length === 1 &&
      eq3(Number(mov[0].quantidade), QTD_WH) &&
      !eq3(Number(mov[0].quantidade), 71.4);

    record(
      'Teste 2 — Finalização recalcula',
      `ignora 71.4; movimento ≈ ${round3(QTD_WH)} (NUMERIC 14,3)`,
      {
        antes: adulterado.rows[0],
        fin: { status: fin.status, qtd: finItem?.estoque_contado },
        movimento: mov[0]
          ? { quantidade: Number(mov[0].quantidade), saldo_apos: Number(mov[0].saldo_apos) }
          : null,
      },
      pass,
    );
    if (!pass) failStop('Teste 2');
  }

  // ========== TESTE 3 ==========
  {
    const p = await criarInsumo(idLoja, 'T3', { uc: 'KG', uf: 'UND' });
    await setSaldo(idLoja, p.id_insumo, 5);
    const c = await criarContagem(idLoja, 't3', [{ id_insumo: p.id_insumo, sistema: 5 }]);
    const idItem = c.itens[0].id_item;

    const put = await putItens(c.idContagem, [
      { id_item: idItem, contagem_caixa: 2, contagem_pc_fd: null, contagem_kg_und: 37 },
    ]);
    const putOk =
      put.status === 400 &&
      (put.data?.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA ||
        String(put.data?.error || '').includes('Conversão'));

    await pool.query(
      `UPDATE estoque_itens
       SET contagem_caixa = 2, contagem_kg_und = 37, estoque_contado = 71.4
       WHERE id_item = $1`,
      [idItem],
    );
    const movAntes = await movimentos(c.idContagem);
    const saldoAntes = await saldo(idLoja, p.id_insumo);
    const fin = await finCont(c.idContagem);
    const st = await statusContagem(c.idContagem);
    const movDepois = await movimentos(c.idContagem);
    const saldoDepois = await saldo(idLoja, p.id_insumo);
    const finOk =
      fin.status === 400 &&
      (fin.data?.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA ||
        String(fin.data?.error || '').includes('Conversão')) &&
      st.status === 'aberta' &&
      movDepois.length === 0 &&
      almostEqual(saldoDepois, saldoAntes);

    const pass = putOk && finOk && movAntes.length === 0;
    record(
      'Teste 3 — Conversão ausente',
      'PUT 400 conversao_nao_encontrada; finalizar 400, 0 movimentos, status aberto',
      {
        put: { status: put.status, motivo: put.data?.motivo, error: put.data?.error },
        fin: { status: fin.status, motivo: fin.data?.motivo, error: fin.data?.error },
        status: st.status,
        movAntes: movAntes.length,
        movDepois: movDepois.length,
        saldoAntes,
        saldoDepois,
      },
      pass,
    );
    if (!pass) failStop('Teste 3');
  }

  // ========== TESTE 4 ==========
  {
    const a = await criarInsumo(idLoja, 'T4A', { uc: 'KG', uf: 'KG' });
    const b = await criarInsumo(idLoja, 'T4B', { uc: 'KG', uf: 'UND' });
    const cProd = await criarInsumo(idLoja, 'T4C', { uc: 'KG', uf: 'UND' });
    await criarFator(b.id_insumo);
    await setSaldo(idLoja, a.id_insumo, 1);
    await setSaldo(idLoja, b.id_insumo, 1);
    await setSaldo(idLoja, cProd.id_insumo, 1);
    const c = await criarContagem(idLoja, 't4', [
      { id_insumo: a.id_insumo, sistema: 1, caixa: 1, kg: 0, contado: 17.2 },
      { id_insumo: b.id_insumo, sistema: 1, caixa: 2, kg: 37, contado: QTD_WH },
      { id_insumo: cProd.id_insumo, sistema: 1, caixa: 2, kg: 37, contado: 71.4 },
    ]);

    const movAntes = await movimentos(c.idContagem);
    const saldosAntes = {
      A: await saldo(idLoja, a.id_insumo),
      B: await saldo(idLoja, b.id_insumo),
      C: await saldo(idLoja, cProd.id_insumo),
    };
    const fin = await finCont(c.idContagem);
    const st = await pool.query(`SELECT status FROM estoque_contagens WHERE id_contagem = $1`, [
      c.idContagem,
    ]);
    const movDepois = await movimentos(c.idContagem);
    const saldosDepois = {
      A: await saldo(idLoja, a.id_insumo),
      B: await saldo(idLoja, b.id_insumo),
      C: await saldo(idLoja, cProd.id_insumo),
    };
    const pass =
      fin.status === 400 &&
      st.rows[0].status === 'aberta' &&
      movAntes.length === 0 &&
      movDepois.length === 0 &&
      almostEqual(saldosAntes.A, saldosDepois.A) &&
      almostEqual(saldosAntes.B, saldosDepois.B) &&
      almostEqual(saldosAntes.C, saldosDepois.C);

    record(
      'Teste 4 — Atomicidade A/B/C',
      'finalizar 400; 0 movimentos; saldos iguais; status aberto',
      {
        fin: { status: fin.status, motivo: fin.data?.motivo, error: fin.data?.error, itens: fin.data?.itens },
        status: st.rows[0].status,
        movAntes: movAntes.length,
        movDepois: movDepois.length,
        saldosAntes,
        saldosDepois,
      },
      pass,
    );
    if (!pass) failStop('Teste 4');
  }

  // ========== TESTE 5 ==========
  {
    const p = await criarInsumo(idLoja, 'T5', { uc: 'KG', uf: 'KG' });
    await setSaldo(idLoja, p.id_insumo, 50);
    const c = await criarContagem(idLoja, 't5', [{ id_insumo: p.id_insumo, sistema: 50 }]);
    const idItem = c.itens[0].id_item;
    const put = await putItens(c.idContagem, [
      { id_item: idItem, contagem_caixa: 0, contagem_pc_fd: null, contagem_kg_und: 45 },
    ]);
    const putItem = itemByCodigo(put.data, p.codigo);
    const difOk = almostEqual(putItem?.diferenca, -5) && almostEqual(putItem?.estoque_sistema, 50);

    await setSaldo(idLoja, p.id_insumo, 48);
    const fin = await finCont(c.idContagem);
    const finItem = itemByCodigo(fin.data, p.codigo);
    const mov = await movimentos(c.idContagem);
    const snapshot = await pool.query(
      `SELECT estoque_sistema, estoque_contado FROM estoque_itens WHERE id_item = $1`,
      [idItem],
    );
    const saldoFinal = await saldo(idLoja, p.id_insumo);
    const pass =
      put.status === 200 &&
      difOk &&
      fin.status === 200 &&
      almostEqual(finItem?.estoque_contado, 45) &&
      almostEqual(Number(snapshot.rows[0].estoque_sistema), 50) &&
      mov.length === 1 &&
      almostEqual(Number(mov[0].quantidade), -3) &&
      almostEqual(saldoFinal, 45);

    record(
      'Teste 5 — Snapshot × saldo vivo',
      'divergência 45-50=-5; ajuste 45-48=-3; saldo=45; snapshot=50',
      {
        put: {
          status: put.status,
          contado: putItem?.estoque_contado,
          sistema: putItem?.estoque_sistema,
          diferenca: putItem?.diferenca,
        },
        fin: { status: fin.status, qtd: finItem?.estoque_contado, sistema: finItem?.estoque_sistema },
        snapshot: snapshot.rows[0],
        movimento: mov[0]
          ? { quantidade: Number(mov[0].quantidade), saldo_apos: Number(mov[0].saldo_apos) }
          : null,
        saldoFinal,
      },
      pass,
    );
    if (!pass) failStop('Teste 5');
  }

  // ========== TESTE 6 ==========
  {
    const p = await criarInsumo(idLoja, 'T6', { uc: 'KG', uf: 'UND' });
    const c = await criarContagem(idLoja, 't6', [
      {
        id_insumo: p.id_insumo,
        sistema: 0,
        caixa: 2,
        kg: 37,
        contado: 71.4,
      },
    ]);
    const get = await getCont(c.idContagem);
    const getItem = itemByCodigo(get.data, p.codigo);
    const pass =
      get.status === 200 &&
      (getItem?.estoque_contado == null) &&
      getItem?.erro_conversao != null &&
      (getItem.erro_conversao.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA ||
        String(getItem.erro_conversao.motivo || '').includes('conversao'));

    record(
      'Teste 6 — GET não mostra QTD velha',
      'estoque_contado null (não 71.4); erro_conversao presente',
      {
        get: get.status,
        estoque_contado: getItem?.estoque_contado,
        erro: getItem?.erro_conversao,
        campos: {
          caixa: getItem?.contagem_caixa,
          kg: getItem?.contagem_kg_und,
        },
      },
      pass,
    );
    if (!pass) failStop('Teste 6');
  }

  // ========== TESTE 7 ==========
  {
    const p = await criarInsumo(idLoja, 'T7', { uc: 'KG', uf: 'KG' });
    const c = await criarContagem(idLoja, 't7', [{ id_insumo: p.id_insumo, sistema: 0 }]);
    const idItem = c.itens[0].id_item;
    const put1 = await putItens(c.idContagem, [
      { id_item: idItem, contagem_caixa: 2, contagem_pc_fd: null, contagem_kg_und: 1.5 },
    ]);
    const antes = await pool.query(
      `SELECT estoque_contado, contagem_caixa, contagem_kg_und FROM estoque_itens WHERE id_item = $1`,
      [idItem],
    );
    const put2 = await putItens(c.idContagem, [
      { id_item: idItem, contagem_caixa: 2, contagem_pc_fd: null, contagem_kg_und: null },
    ]);
    const depois = await pool.query(
      `SELECT estoque_contado, contagem_caixa, contagem_kg_und FROM estoque_itens WHERE id_item = $1`,
      [idItem],
    );
    const pass =
      put1.status === 200 &&
      almostEqual(Number(antes.rows[0].estoque_contado), QTD_ID) &&
      put2.status === 200 &&
      depois.rows[0].contagem_kg_und == null &&
      almostEqual(Number(depois.rows[0].estoque_contado), 34.4) &&
      Number(depois.rows[0].estoque_contado) !== Number(antes.rows[0].estoque_contado);

    record(
      'Teste 7 — Campo limpo no PUT',
      'kg_und null; estoque_contado passa de 35.9 para 34.4 (2×17,2); sem COALESCE do 1,5',
      {
        put1: put1.status,
        antes: {
          contado: Number(antes.rows[0].estoque_contado),
          caixa: Number(antes.rows[0].contagem_caixa),
          kg: Number(antes.rows[0].contagem_kg_und),
        },
        put2: put2.status,
        depois: {
          contado: depois.rows[0].estoque_contado == null ? null : Number(depois.rows[0].estoque_contado),
          caixa: depois.rows[0].contagem_caixa == null ? null : Number(depois.rows[0].contagem_caixa),
          kg: depois.rows[0].contagem_kg_und == null ? null : Number(depois.rows[0].contagem_kg_und),
        },
      },
      pass,
    );
    if (!pass) failStop('Teste 7');
  }

  // ========== TESTE 8 ==========
  {
    const p = await criarInsumo(idLoja, 'T8', { uc: 'KG', uf: 'KG' });
    await setSaldo(idLoja, p.id_insumo, 0);
    const c = await criarContagem(idLoja, 't8', [{ id_insumo: p.id_insumo, sistema: 0 }]);
    const idItem = c.itens[0].id_item;
    const put = await putItens(c.idContagem, [
      { id_item: idItem, contagem_caixa: 2, contagem_pc_fd: null, contagem_kg_und: 1.5 },
    ]);
    const putItem = itemByCodigo(put.data, p.codigo);
    const get = await getCont(c.idContagem);
    const getItem = itemByCodigo(get.data, p.codigo);
    const fin = await finCont(c.idContagem);
    const finItem = itemByCodigo(fin.data, p.codigo);
    const mov = await movimentos(c.idContagem);
    const saldoFinal = await saldo(idLoja, p.id_insumo);
    const pass =
      put.status === 200 &&
      almostEqual(putItem?.estoque_contado, QTD_ID) &&
      get.status === 200 &&
      almostEqual(getItem?.estoque_contado, QTD_ID) &&
      fin.status === 200 &&
      almostEqual(finItem?.estoque_contado, QTD_ID) &&
      mov.length === 1 &&
      eq3(Number(mov[0].quantidade), QTD_ID) &&
      eq3(saldoFinal, QTD_ID);

    record(
      'Teste 8 — Regressão identidade KG→KG',
      `PUT/GET/finalizar = ${QTD_ID}`,
      {
        put: { status: put.status, qtd: putItem?.estoque_contado },
        get: { status: get.status, qtd: getItem?.estoque_contado },
        fin: { status: fin.status, qtd: finItem?.estoque_contado },
        movimento: mov[0]
          ? { quantidade: Number(mov[0].quantidade), saldo_apos: Number(mov[0].saldo_apos) }
          : null,
        saldoFinal,
      },
      pass,
    );
    if (!pass) failStop('Teste 8');
  }
} catch (e) {
  if (!String(e.message || '').startsWith('STOP:')) {
    console.error('\nERRO:', e);
    record('execucao', 'sem exceção', e.message, false);
  }
} finally {
  try {
    await limpar();
    console.log(`\nCleanup ${TAG} concluído.`);
  } catch (e) {
    console.error('Falha no cleanup:', e.message);
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
}

console.log('\n########## RESULTADO ETAPA 4 ##########\n');
for (const r of results) {
  console.log(`${r.teste}: ${r.status}`);
}
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
console.log(`\nTotal: ${results.length}  PASS: ${pass}  FAIL: ${fail}`);
if (fail > 0) process.exitCode = 1;
