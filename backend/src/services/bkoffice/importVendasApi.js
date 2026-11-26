/**
 * Importação diária e reimportação das vendas da API BK Office.
 * Grava origem bkoffice_api e recalcula as baixas do dia (desfaz o Excel
 * legado uma vez; a API é reprocessada por completo, sem duplicar).
 */
import { pool } from '../../db.js';
import { processarVenda, upsertProdutoVenda } from '../estoqueMotor.js';
import { ORIGEM_API, apiSyncAtivo } from './fonteVendas.js';
import {
  DATAS_REIMPORT_PADRAO,
  agregarItensVendaApi,
  dataCivilSP,
  diaAnteriorCivil,
  deveDispararJobDiario,
  diffReimportacao,
  executarImportacaoLojas,
  horaMinutoSP,
  lerTokenApi,
  listarVendasDia,
  montarPlanoItens,
} from './apiClient.js';

export { DATAS_REIMPORT_PADRAO };

let timer = null;
let rodando = false;
let ultimoDiaDisparado = null;
let backoffUntil = 0;

export async function listarLojasParaApi({ ids = null } = {}, db = pool) {
  const params = [];
  let filtro = `
    COALESCE(is_active, TRUE) = TRUE
    AND (
      (bk_number IS NOT NULL AND TRIM(bk_number) <> '')
      OR name ILIKE '%taquari%'
      OR COALESCE(city, '') ILIKE '%taquari%'
    )
  `;
  if (Array.isArray(ids) && ids.length) {
    params.push(ids.map(Number).filter((n) => n > 0));
    filtro += ` AND id_loja = ANY($${params.length}::int[])`;
  }
  const { rows } = await db.query(
    `SELECT id_loja, name, bk_number, cnpj
     FROM lojas
     WHERE ${filtro}
     ORDER BY name`,
    params,
  );
  return rows;
}

export async function assertSchemaBkOfficeApi(db = pool) {
  const { rows } = await db.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'estoque_venda_itens' AND column_name = 'desconto')
         OR (table_name = 'estoque_vendas' AND column_name = 'substituida_em')
         OR (table_name = 'estoque_bkoffice_reimport_backup' AND column_name = 'payload')
       )`,
  );
  if (rows.length < 3) {
    throw Object.assign(
      new Error(
        'Migration 172_estoque_vendas_bkoffice_api.sql não aplicada. Nada foi gravado.',
      ),
      { code: 'MIGRATION_PENDENTE', status: 500 },
    );
  }
}

async function desfazerMovimentosVenda(client, { id_loja, itemIds }) {
  const ids = (itemIds || []).map(Number).filter((n) => n > 0);
  if (!ids.length) return { movimentos: 0, insumos: 0 };
  const { rows: nets } = await client.query(
    `SELECT id_insumo, SUM(quantidade)::float AS quantidade
     FROM estoque_movimentos
     WHERE referencia_tipo = 'estoque_venda_item'
       AND tipo = 'venda'
       AND referencia_id = ANY($1::int[])
     GROUP BY id_insumo`,
    [ids],
  );
  for (const net of nets) {
    const sum = Number(net.quantidade) || 0;
    if (Math.abs(sum) < 0.0000001) continue;
    await client.query(
      `INSERT INTO estoque_saldos (id_loja, id_insumo, quantidade, atualizado_em)
       VALUES ($1, $2, (0 - $3::numeric), NOW())
       ON CONFLICT (id_loja, id_insumo) DO UPDATE
         SET quantidade = estoque_saldos.quantidade - $3::numeric,
             atualizado_em = NOW()`,
      [id_loja, net.id_insumo, sum],
    );
  }
  const del = await client.query(
    `DELETE FROM estoque_movimentos
     WHERE referencia_tipo = 'estoque_venda_item'
       AND tipo = 'venda'
       AND referencia_id = ANY($1::int[])`,
    [ids],
  );
  return { movimentos: del.rowCount || 0, insumos: nets.length };
}

/**
 * Tira do saldo as baixas do Excel daquele dia e apaga os movimentos,
 * para o CMV (que soma ABS do tipo venda) não contar Excel e API juntos.
 * Idempotente: venda já marcada com substituida_em é ignorada.
 */
export async function substituirBaixasExcel(client, { id_loja, data }) {
  const { rows: vendas } = await client.query(
    `SELECT id_venda
     FROM estoque_vendas
     WHERE id_loja = $1
       AND data_venda = $2::date
       AND origem = 'bkoffice'
       AND substituida_em IS NULL
     FOR UPDATE`,
    [id_loja, data],
  );
  let movimentos = 0;
  for (const venda of vendas) {
    const { rows: itens } = await client.query(
      `SELECT id_item FROM estoque_venda_itens WHERE id_venda = $1`,
      [venda.id_venda],
    );
    const ids = itens.map((i) => i.id_item);
    const feito = await desfazerMovimentosVenda(client, { id_loja, itemIds: ids });
    movimentos += feito.movimentos;
    await client.query(
      `UPDATE estoque_venda_itens
       SET processado = TRUE, erro = NULL
       WHERE id_venda = $1 AND processado = FALSE`,
      [venda.id_venda],
    );
    await client.query(
      `UPDATE estoque_vendas
       SET substituida_em = NOW(),
           observacao = 'Substituída por bkoffice_api'
       WHERE id_venda = $1`,
      [venda.id_venda],
    );
  }
  return { vendas: vendas.length, movimentos };
}

async function desfazerBaixasApi(client, { id_loja, idVenda }) {
  const { rows } = await client.query(
    `SELECT id_item FROM estoque_venda_itens WHERE id_venda = $1`,
    [idVenda],
  );
  return desfazerMovimentosVenda(client, {
    id_loja,
    itemIds: rows.map((r) => r.id_item),
  });
}

/**
 * Grava o dia da API e, se processar, refaz as baixas a partir das quantidades novas.
 * Reprocessar o mesmo dia substitui itens e movimentos; não acumula.
 */
export async function gravarVendaApiDia(
  client,
  { id_loja, data, itens, processar = true } = {},
) {
  const agregados = agregarItensVendaApi(itens);
  let movimentosExcel = 0;
  let movimentosApi = 0;
  if (processar) {
    const excel = await substituirBaixasExcel(client, { id_loja, data });
    movimentosExcel = excel.movimentos;
  }

  const { rows: cab } = await client.query(
    `INSERT INTO estoque_vendas
       (id_loja, data_venda, origem, status, arquivo_nome)
     VALUES ($1, $2::date, $3, 'pendente', 'bkoffice_api')
     ON CONFLICT (id_loja, data_venda, origem) DO UPDATE
       SET arquivo_nome = 'bkoffice_api',
           status = 'pendente',
           observacao = NULL
     RETURNING id_venda`,
    [id_loja, data, ORIGEM_API],
  );
  const idVenda = cab[0].id_venda;

  if (processar) {
    const undo = await desfazerBaixasApi(client, { id_loja, idVenda });
    movimentosApi = undo.movimentos;
  }

  const { rows: atuais } = await client.query(
    `SELECT id_item, codigo, qtde, processado, descricao, venda_liquida, desconto
     FROM estoque_venda_itens
     WHERE id_venda = $1`,
    [idVenda],
  );
  const plano = montarPlanoItens(atuais, agregados);
  const remover = plano
    .filter((a) => a.acao === 'apagar' || a.acao === 'zerar')
    .map((a) => a.id_item)
    .filter(Boolean);
  if (remover.length) {
    await client.query(`DELETE FROM estoque_venda_itens WHERE id_item = ANY($1::int[])`, [
      remover,
    ]);
  }

  for (const a of plano) {
    if (a.acao === 'atualizar' && a.id_item) {
      const pv = await upsertProdutoVenda(client, a.codigo, a.descricao, id_loja);
      await client.query(
        `UPDATE estoque_venda_itens
         SET descricao = $2,
             qtde = $3,
             venda_liquida = $4,
             desconto = $5,
             id_produto = COALESCE($6, id_produto),
             processado = FALSE,
             sem_ficha = FALSE,
             erro = NULL
         WHERE id_item = $1`,
        [
          a.id_item,
          a.descricao || '',
          a.qtde,
          a.venda_liquida,
          a.desconto,
          pv?.id_produto || null,
        ],
      );
    } else if (a.acao === 'inserir') {
      const pv = await upsertProdutoVenda(client, a.codigo, a.descricao, id_loja);
      await client.query(
        `INSERT INTO estoque_venda_itens
           (id_venda, codigo, descricao, qtde, venda_liquida, desconto, id_produto, processado, sem_ficha)
         VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,FALSE)`,
        [
          idVenda,
          a.codigo,
          a.descricao || '',
          a.qtde,
          a.venda_liquida,
          a.desconto,
          pv?.id_produto || null,
        ],
      );
    }
  }

  let proc = null;
  if (processar && agregados.length) {
    proc = await processarVenda(idVenda, { data_movimento: data }, client);
  } else if (processar) {
    await client.query(
      `UPDATE estoque_vendas
       SET status = 'processada', processado_em = NOW()
       WHERE id_venda = $1`,
      [idVenda],
    );
  }

  return {
    id_venda: idVenda,
    itens: agregados.length,
    movimentos_excel: movimentosExcel,
    movimentos_api: movimentosApi,
    processado: proc,
  };
}

export async function importarDiaLojaApi({
  loja,
  data,
  itens,
  processar = true,
  client = null,
} = {}) {
  const own = !client;
  const c = client || (await pool.connect());
  try {
    if (own) await c.query('BEGIN');
    const gravado = await gravarVendaApiDia(c, {
      id_loja: loja.id_loja,
      data,
      itens,
      processar,
    });
    if (own) await c.query('COMMIT');
    return gravado;
  } catch (e) {
    if (own) await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (own) c.release();
  }
}

export async function lerItensDia(db, { id_loja, data }) {
  const { rows } = await db.query(
    `SELECT v.origem,
            vi.codigo,
            vi.qtde::float AS qtde,
            vi.venda_liquida::float AS venda_liquida,
            COALESCE(vi.desconto, 0)::float AS desconto
     FROM estoque_vendas v
     JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
     WHERE v.id_loja = $1
       AND v.data_venda = $2::date
       AND v.origem IN ('bkoffice', 'bkoffice_api')`,
    [id_loja, data],
  );
  return rows;
}

export async function preverRecalculoBaixas(db, { id_loja, data }) {
  const { rows } = await db.query(
    `SELECT v.origem, COUNT(*)::int AS movimentos
     FROM estoque_movimentos m
     JOIN estoque_venda_itens vi ON vi.id_item = m.referencia_id
     JOIN estoque_vendas v ON v.id_venda = vi.id_venda
     WHERE m.referencia_tipo = 'estoque_venda_item'
       AND m.tipo = 'venda'
       AND v.id_loja = $1
       AND v.data_venda = $2::date
       AND v.origem IN ('bkoffice', 'bkoffice_api')
       AND (v.origem <> 'bkoffice' OR v.substituida_em IS NULL)
     GROUP BY v.origem`,
    [id_loja, data],
  );
  const porOrigem = Object.fromEntries(rows.map((r) => [r.origem, r.movimentos]));
  return {
    movimentos_excel: porOrigem.bkoffice || 0,
    movimentos_api: porOrigem.bkoffice_api || 0,
  };
}

async function backupDia(client, { id_loja, data }) {
  const { rows: vendas } = await client.query(
    `SELECT * FROM estoque_vendas
     WHERE id_loja = $1 AND data_venda = $2::date AND origem IN ('bkoffice', 'bkoffice_api')`,
    [id_loja, data],
  );
  const ids = vendas.map((v) => v.id_venda);
  let itens = [];
  let movimentos = [];
  if (ids.length) {
    const itensRes = await client.query(
      `SELECT * FROM estoque_venda_itens WHERE id_venda = ANY($1::int[])`,
      [ids],
    );
    itens = itensRes.rows;
    const itemIds = itens.map((i) => i.id_item);
    if (itemIds.length) {
      const movRes = await client.query(
        `SELECT * FROM estoque_movimentos
         WHERE referencia_tipo = 'estoque_venda_item'
           AND referencia_id = ANY($1::int[])`,
        [itemIds],
      );
      movimentos = movRes.rows;
    }
  }
  const payload = { vendas, itens, movimentos };
  const ins = await client.query(
    `INSERT INTO estoque_bkoffice_reimport_backup (id_loja, data_venda, payload)
     VALUES ($1, $2::date, $3::jsonb)
     RETURNING id_backup`,
    [id_loja, data, JSON.stringify(payload)],
  );
  return {
    id_backup: ins.rows[0].id_backup,
    linhas: vendas.length + itens.length + movimentos.length,
  };
}

export async function buscarRede({ datas, idsLojas = null, buscarDia = null, db = pool } = {}) {
  const token = lerTokenApi();
  const lojas = await listarLojasParaApi({ ids: idsLojas }, db);
  const buscar =
    buscarDia ||
    ((args) =>
      listarVendasDia({
        cnpj: args.cnpj,
        data: args.data,
        token,
      }));
  return executarImportacaoLojas({ lojas, datas, buscarDia: buscar });
}

export async function reimportarVendasApi({
  datas = DATAS_REIMPORT_PADRAO,
  idsLojas = null,
  apply = false,
  buscarDia = null,
  db = pool,
} = {}) {
  await assertSchemaBkOfficeApi(db);
  const relatorio = await buscarRede({ datas, idsLojas, buscarDia, db });
  const falhas = relatorio.filter((r) => r.status === 'erro');

  if (!apply) {
    for (const linha of relatorio) {
      if (linha.status !== 'ok') continue;
      const atuais = await lerItensDia(db, linha);
      const diff = diffReimportacao(atuais, linha.itens);
      const baixas = await preverRecalculoBaixas(db, linha);
      linha.antes = diff.antes;
      linha.depois = diff.depois;
      linha.bruto_delta = diff.bruto_delta;
      linha.qtde_delta = diff.qtde_delta;
      linha.baixas = baixas;
      delete linha.itens;
    }
    return { apply: false, relatorio, falhas: falhas.length };
  }

  if (falhas.length) {
    const err = Object.assign(
      new Error(
        'Há loja/dia com falha na API. Nada foi gravado. O --apply só abre a transação com todas as leituras ok.',
      ),
      { code: 'APLICACAO_BLOQUEADA', status: 409, relatorio },
    );
    throw err;
  }

  const client = await db.connect();
  let rowcountBackup = 0;
  let rowcountItens = 0;
  let rowcountMovimentos = 0;
  try {
    await client.query('BEGIN');
    for (const linha of relatorio) {
      if (linha.status !== 'ok') continue;
      const b = await backupDia(client, linha);
      rowcountBackup += 1;
      const gravado = await gravarVendaApiDia(client, {
        id_loja: linha.id_loja,
        data: linha.data,
        itens: linha.itens,
        processar: true,
      });
      rowcountItens += gravado.itens;
      rowcountMovimentos += gravado.movimentos_excel + gravado.movimentos_api;
      linha.id_venda = gravado.id_venda;
      linha.id_backup = b.id_backup;
      delete linha.itens;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  return {
    apply: true,
    relatorio,
    falhas: 0,
    rowcount_backup: rowcountBackup,
    rowcount_itens: rowcountItens,
    rowcount_movimentos: rowcountMovimentos,
  };
}

async function registrarJob(data, status, mensagem) {
  await pool.query(
    `INSERT INTO estoque_sync_jobs
       (id_loja, data_inicio, data_fim, status, iniciado_em, finalizado_em, mensagem)
     VALUES (NULL, $1::date, $1::date, $2, NOW(), NOW(), $3)`,
    [data, status, mensagem.slice(0, 2000)],
  );
}

export async function diaJaImportado(dataVenda, db = pool) {
  const { rows } = await db.query(
    `SELECT id_job
     FROM estoque_sync_jobs
     WHERE data_inicio = $1::date
       AND data_fim = $1::date
       AND status = 'ok'
       AND mensagem LIKE 'bkoffice_api%'
       AND (finalizado_em AT TIME ZONE 'America/Sao_Paulo')::date
           = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
     LIMIT 1`,
    [dataVenda],
  );
  return rows.length > 0;
}

export async function importarDiaAnteriorRede({ data = null, buscarDia = null } = {}) {
  await assertSchemaBkOfficeApi();
  const alvo = data || diaAnteriorCivil(dataCivilSP());
  const relatorio = await buscarRede({ datas: [alvo], buscarDia });
  let ok = 0;
  let erros = 0;
  for (const linha of relatorio) {
    if (linha.status !== 'ok') {
      const tag = linha.data ? `${linha.data} ` : '';
      console.warn(
        `[bkoffice-api] loja ${linha.id_loja} ${linha.name} ${tag}${linha.status}: ${linha.mensagem || ''}`,
      );
      if (linha.status === 'erro') erros += 1;
      continue;
    }
    try {
      const gravado = await importarDiaLojaApi({
        loja: { id_loja: linha.id_loja },
        data: linha.data,
        itens: linha.itens,
        processar: true,
      });
      ok += 1;
      console.log(
        `[bkoffice-api] loja ${linha.id_loja} ${linha.data} OK ${gravado.itens} itens, movimentos excel ${gravado.movimentos_excel}, api ${gravado.movimentos_api}`,
      );
    } catch (e) {
      erros += 1;
      linha.status = 'erro';
      linha.mensagem = e.message || String(e);
      console.error(
        `[bkoffice-api] loja ${linha.id_loja} ${linha.data} ERRO: ${linha.mensagem}`,
      );
    }
  }
  // estoque_sync_jobs aceita só pendente/rodando/ok/erro.
  const status = erros ? 'erro' : 'ok';
  const pulos = relatorio.filter((r) =>
    ['popeyes', 'sem_cnpj', 'nao_autorizado'].includes(r.status),
  ).length;
  await registrarJob(
    alvo,
    status,
    `bkoffice_api ${status}: ${ok} loja(s), ${erros} erro(s), ${pulos} pulo(s)`,
  );
  return { data: alvo, relatorio, ok, erros, status };
}

export function iniciarSchedulerVendasBkOfficeApi() {
  if (!apiSyncAtivo()) {
    console.log('[bkoffice-api] Job diário desligado (BKOFFICE_API_SYNC=0 ou fonte excel).');
    return null;
  }
  if (!String(process.env.BKOFFICE_API_TOKEN || '').trim()) {
    console.warn('[bkoffice-api] BKOFFICE_API_TOKEN ausente — job diário não inicia.');
    return null;
  }
  if (timer) return timer;
  const horario = String(process.env.BKOFFICE_API_SYNC_HORARIO || '05:00').slice(0, 5);
  const limite = String(process.env.BKOFFICE_API_SYNC_LIMITE || '12:00').slice(0, 5);
  console.log(
    `[bkoffice-api] Job diário às ${horario} (America/Sao_Paulo, recupera até ${limite}) — importa o dia anterior.`,
  );

  const tick = async () => {
    if (rodando) return;
    if (Date.now() < backoffUntil) return;
    const diaCivil = dataCivilSP();
    const hora = horaMinutoSP();
    if (!deveDispararJobDiario({ horaMinuto: hora, diaCivil, ultimoDiaDisparado, horario, limite })) {
      return;
    }
    const ontem = diaAnteriorCivil(diaCivil);
    try {
      if (await diaJaImportado(ontem)) {
        ultimoDiaDisparado = diaCivil;
        return;
      }
    } catch (e) {
      console.error('[bkoffice-api] não foi possível checar o job anterior:', e.message);
      return;
    }
    rodando = true;
    try {
      const r = await importarDiaAnteriorRede({ data: ontem });
      if (r.erros) {
        backoffUntil = Date.now() + 15 * 60 * 1000;
        console.error(
          `[bkoffice-api] ${r.erros} loja(s) com erro — nova tentativa em 15 min`,
        );
      } else {
        ultimoDiaDisparado = diaCivil;
      }
    } catch (e) {
      backoffUntil = Date.now() + 15 * 60 * 1000;
      console.error('[bkoffice-api] job falhou:', e.message);
    } finally {
      rodando = false;
    }
  };

  setTimeout(() => void tick(), 20000);
  timer = setInterval(() => void tick(), 60000);
  return timer;
}
