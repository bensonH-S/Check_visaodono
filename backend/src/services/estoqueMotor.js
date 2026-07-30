import { pool } from '../db.js';

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Aplica delta no saldo e registra movimento.
 * quantidade > 0 = entrada; quantidade < 0 = saída.
 */
export async function aplicarMovimento(
  client,
  {
    id_loja,
    id_produto,
    tipo,
    quantidade,
    referencia_tipo = null,
    referencia_id = null,
    observacao = null,
    criado_por = null,
  },
) {
  const delta = num(quantidade);
  if (!id_loja || !id_produto || !tipo || delta === 0) {
    throw Object.assign(new Error('Movimento inválido'), { status: 400 });
  }

  const { rows } = await client.query(
    `INSERT INTO estoque_saldos (id_loja, id_produto, quantidade, atualizado_em)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id_loja, id_produto) DO UPDATE
       SET quantidade = estoque_saldos.quantidade + EXCLUDED.quantidade,
           atualizado_em = NOW()
     RETURNING quantidade`,
    [id_loja, id_produto, delta],
  );
  const saldo_apos = num(rows[0]?.quantidade);

  const { rows: mov } = await client.query(
    `INSERT INTO estoque_movimentos
       (id_loja, id_produto, tipo, quantidade, saldo_apos,
        referencia_tipo, referencia_id, observacao, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id_movimento`,
    [
      id_loja,
      id_produto,
      tipo,
      delta,
      saldo_apos,
      referencia_tipo,
      referencia_id,
      observacao,
      criado_por,
    ],
  );

  return { id_movimento: mov[0].id_movimento, saldo_apos };
}

export async function obterSaldo(idLoja, idProduto, client = pool) {
  const { rows } = await client.query(
    `SELECT quantidade FROM estoque_saldos
     WHERE id_loja = $1 AND id_produto = $2`,
    [idLoja, idProduto],
  );
  return rows.length ? num(rows[0].quantidade) : 0;
}

/** Resolve produto de estoque (insumo) por loja + código. */
export async function resolverInsumoPorCodigo(client, idLoja, codigo) {
  const cod = String(codigo || '').trim().toUpperCase();
  if (!cod) return null;
  const { rows } = await client.query(
    `SELECT id_produto, codigo, descricao
     FROM produtos
     WHERE id_loja = $1 AND UPPER(codigo) = $2 AND ativo = TRUE
     LIMIT 1`,
    [idLoja, cod],
  );
  return rows[0] || null;
}

/** Upsert produto_venda pelo código BK. */
export async function upsertProdutoVenda(client, codigo, descricao = '') {
  const cod = String(codigo || '').trim();
  if (!cod) return null;
  const desc = String(descricao || '').trim() || cod;
  const { rows } = await client.query(
    `INSERT INTO produtos_venda (codigo, descricao, ativo, atualizado_em)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (codigo) DO UPDATE
       SET descricao = CASE
             WHEN EXCLUDED.descricao <> '' AND EXCLUDED.descricao <> EXCLUDED.codigo
             THEN EXCLUDED.descricao
             ELSE produtos_venda.descricao
           END,
           atualizado_em = NOW()
     RETURNING *`,
    [cod, desc],
  );
  return rows[0];
}

export async function carregarFichaPorCodigoVenda(client, codigoVenda) {
  const cod = String(codigoVenda || '').trim();
  if (!cod) return null;
  const { rows: pv } = await client.query(
    `SELECT pv.*, f.id_ficha, f.ativo AS ficha_ativa
     FROM produtos_venda pv
     LEFT JOIN ficha_tecnica f ON f.id_produto_venda = pv.id_produto_venda AND f.ativo = TRUE
     WHERE pv.codigo = $1
     LIMIT 1`,
    [cod],
  );
  if (!pv.length || !pv[0].id_ficha) return null;

  const { rows: itens } = await client.query(
    `SELECT id_item, codigo_insumo, quantidade, observacao
     FROM ficha_tecnica_itens
     WHERE id_ficha = $1
     ORDER BY codigo_insumo`,
    [pv[0].id_ficha],
  );
  if (!itens.length) return null;

  return {
    produto_venda: pv[0],
    id_ficha: pv[0].id_ficha,
    itens,
  };
}

/**
 * Baixa insumos de uma quantidade de produto de venda via ficha.
 * Retorna { ok, sem_ficha, baixas[], erros[] }.
 */
export async function baixarPorProdutoVenda(
  client,
  {
    id_loja,
    codigo_venda,
    quantidade,
    tipo = 'venda',
    referencia_tipo = null,
    referencia_id = null,
    observacao = null,
    criado_por = null,
  },
) {
  const qtde = num(quantidade);
  if (qtde <= 0) {
    return { ok: false, sem_ficha: false, baixas: [], erros: ['Quantidade inválida'] };
  }

  const ficha = await carregarFichaPorCodigoVenda(client, codigo_venda);
  if (!ficha) {
    return { ok: false, sem_ficha: true, baixas: [], erros: ['Sem ficha técnica'] };
  }

  const baixas = [];
  const erros = [];

  for (const item of ficha.itens) {
    const insumo = await resolverInsumoPorCodigo(client, id_loja, item.codigo_insumo);
    if (!insumo) {
      erros.push(`Insumo ${item.codigo_insumo} não cadastrado na loja`);
      continue;
    }
    const delta = -(qtde * num(item.quantidade));
    const mov = await aplicarMovimento(client, {
      id_loja,
      id_produto: insumo.id_produto,
      tipo,
      quantidade: delta,
      referencia_tipo,
      referencia_id,
      observacao:
        observacao ||
        `Baixa ${tipo}: ${codigo_venda} x${qtde} → ${item.codigo_insumo} (${item.quantidade})`,
      criado_por,
    });
    baixas.push({
      id_produto: insumo.id_produto,
      codigo: insumo.codigo,
      quantidade: delta,
      saldo_apos: mov.saldo_apos,
    });
  }

  return {
    ok: erros.length === 0 && baixas.length > 0,
    sem_ficha: false,
    parcial: erros.length > 0 && baixas.length > 0,
    baixas,
    erros,
    id_ficha: ficha.id_ficha,
  };
}

/** Processa itens pendentes de uma venda importada. */
export async function processarVenda(idVenda, { criado_por = null } = {}, externalClient = null) {
  const client = externalClient || (await pool.connect());
  const ownClient = !externalClient;
  try {
    if (ownClient) await client.query('BEGIN');

    const { rows: vendas } = await client.query(
      `SELECT * FROM estoque_vendas WHERE id_venda = $1 FOR UPDATE`,
      [idVenda],
    );
    if (!vendas.length) throw Object.assign(new Error('Venda não encontrada'), { status: 404 });
    const venda = vendas[0];

    const { rows: itens } = await client.query(
      `SELECT * FROM estoque_venda_itens
       WHERE id_venda = $1 AND processado = FALSE
       ORDER BY id_item`,
      [idVenda],
    );

    let processados = 0;
    let semFicha = 0;
    let comErro = 0;

    for (const item of itens) {
      const pv = await upsertProdutoVenda(client, item.codigo, item.descricao);
      const result = await baixarPorProdutoVenda(client, {
        id_loja: venda.id_loja,
        codigo_venda: item.codigo,
        quantidade: item.qtde,
        tipo: 'venda',
        referencia_tipo: 'estoque_venda_item',
        referencia_id: item.id_item,
        observacao: `Venda #${idVenda} ${venda.data_venda} — ${item.codigo}`,
        criado_por,
      });

      if (result.sem_ficha) {
        semFicha += 1;
        await client.query(
          `UPDATE estoque_venda_itens
           SET id_produto_venda = $1, sem_ficha = TRUE, processado = FALSE, erro = $2
           WHERE id_item = $3`,
          [pv?.id_produto_venda || null, 'Sem ficha técnica', item.id_item],
        );
        continue;
      }

      if (result.ok || result.parcial) {
        processados += 1;
        await client.query(
          `UPDATE estoque_venda_itens
           SET id_produto_venda = $1, sem_ficha = FALSE, processado = TRUE,
               erro = $2
           WHERE id_item = $3`,
          [
            pv?.id_produto_venda || null,
            result.erros.length ? result.erros.join('; ') : null,
            item.id_item,
          ],
        );
      } else {
        comErro += 1;
        await client.query(
          `UPDATE estoque_venda_itens
           SET id_produto_venda = $1, processado = FALSE, erro = $2
           WHERE id_item = $3`,
          [pv?.id_produto_venda || null, result.erros.join('; ') || 'Falha na baixa', item.id_item],
        );
      }
    }

    const { rows: stats } = await client.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE processado)::int AS processados,
         COUNT(*) FILTER (WHERE sem_ficha AND NOT processado)::int AS sem_ficha,
         COUNT(*) FILTER (WHERE erro IS NOT NULL AND NOT processado AND NOT sem_ficha)::int AS erros
       FROM estoque_venda_itens WHERE id_venda = $1`,
      [idVenda],
    );
    const s = stats[0];
    let status = 'pendente';
    if (s.total > 0 && s.processados === s.total) status = 'processada';
    else if (s.processados > 0 || s.sem_ficha > 0) status = 'parcial';
    else if (s.erros > 0) status = 'erro';

    await client.query(
      `UPDATE estoque_vendas
       SET status = $1, processado_em = CASE WHEN $1 IN ('processada','parcial') THEN NOW() ELSE processado_em END
       WHERE id_venda = $2`,
      [status, idVenda],
    );

    if (ownClient) await client.query('COMMIT');
    return {
      id_venda: idVenda,
      status,
      processados,
      sem_ficha: semFicha,
      erros: comErro,
      stats: s,
    };
  } catch (e) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownClient) client.release();
  }
}

/**
 * Ao finalizar contagem: ajusta saldo para o valor contado.
 */
export async function ajustarSaldoPorContagem(client, idContagem, criado_por = null) {
  const { rows: cont } = await client.query(
    `SELECT id_contagem, id_loja, status FROM estoque_contagens WHERE id_contagem = $1`,
    [idContagem],
  );
  if (!cont.length) throw Object.assign(new Error('Contagem não encontrada'), { status: 404 });
  const { id_loja } = cont[0];

  const { rows: itens } = await client.query(
    `SELECT id_item, id_produto, estoque_contado, estoque_sistema
     FROM estoque_itens WHERE id_contagem = $1`,
    [idContagem],
  );

  let ajustes = 0;
  for (const item of itens) {
    if (item.estoque_contado == null) continue;
    const contado = num(item.estoque_contado);
    const atual = await obterSaldo(id_loja, item.id_produto, client);
    const delta = contado - atual;
    if (delta === 0) {
      // ainda assim garante linha de saldo
      await client.query(
        `INSERT INTO estoque_saldos (id_loja, id_produto, quantidade, atualizado_em)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id_loja, id_produto) DO UPDATE SET atualizado_em = NOW()`,
        [id_loja, item.id_produto, contado],
      );
      continue;
    }
    await aplicarMovimento(client, {
      id_loja,
      id_produto: item.id_produto,
      tipo: 'contagem',
      quantidade: delta,
      referencia_tipo: 'estoque_contagem',
      referencia_id: idContagem,
      observacao: `Ajuste por contagem #${idContagem}`,
      criado_por,
    });
    ajustes += 1;
  }
  return { ajustes };
}

/** Lança break (consumo) — itens diretos e/ou produto venda via ficha. */
export async function lancarBreak(
  {
    id_loja,
    data_break,
    tipo = 'refeicao',
    motivo = null,
    itens = [],
    criado_por = null,
  },
  externalClient = null,
) {
  const client = externalClient || (await pool.connect());
  const ownClient = !externalClient;
  try {
    if (ownClient) await client.query('BEGIN');

    const { rows: br } = await client.query(
      `INSERT INTO estoque_break (id_loja, data_break, tipo, motivo, criado_por)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5)
       RETURNING *`,
      [id_loja, data_break || null, tipo, motivo, criado_por],
    );
    const idBreak = br[0].id_break;
    const baixas = [];
    const erros = [];

    for (const raw of itens) {
      const qtde = num(raw.quantidade);
      if (qtde <= 0) continue;

      if (raw.id_produto || raw.codigo_insumo) {
        let idProduto = raw.id_produto ? Number(raw.id_produto) : null;
        let codigo = raw.codigo_insumo || raw.codigo || null;
        let descricao = raw.descricao || null;
        if (!idProduto && codigo) {
          const insumo = await resolverInsumoPorCodigo(client, id_loja, codigo);
          if (!insumo) {
            erros.push(`Insumo ${codigo} não encontrado`);
            continue;
          }
          idProduto = insumo.id_produto;
          codigo = insumo.codigo;
          descricao = insumo.descricao;
        }
        if (!idProduto) {
          erros.push('Item sem produto');
          continue;
        }
        await client.query(
          `INSERT INTO estoque_break_itens
             (id_break, id_produto, codigo, descricao, quantidade)
           VALUES ($1,$2,$3,$4,$5)`,
          [idBreak, idProduto, codigo, descricao, qtde],
        );
        const mov = await aplicarMovimento(client, {
          id_loja,
          id_produto: idProduto,
          tipo: 'break',
          quantidade: -qtde,
          referencia_tipo: 'estoque_break',
          referencia_id: idBreak,
          observacao: motivo || `Break #${idBreak}`,
          criado_por,
        });
        baixas.push({ id_produto: idProduto, quantidade: -qtde, saldo_apos: mov.saldo_apos });
        continue;
      }

      if (raw.codigo_venda || raw.id_produto_venda) {
        let codigoVenda = raw.codigo_venda;
        let idPv = raw.id_produto_venda ? Number(raw.id_produto_venda) : null;
        if (idPv && !codigoVenda) {
          const { rows } = await client.query(
            'SELECT codigo FROM produtos_venda WHERE id_produto_venda = $1',
            [idPv],
          );
          codigoVenda = rows[0]?.codigo;
        }
        if (!codigoVenda) {
          erros.push('Produto de venda inválido');
          continue;
        }
        const pv = await upsertProdutoVenda(client, codigoVenda, raw.descricao || '');
        await client.query(
          `INSERT INTO estoque_break_itens
             (id_break, id_produto_venda, codigo, descricao, quantidade)
           VALUES ($1,$2,$3,$4,$5)`,
          [idBreak, pv.id_produto_venda, codigoVenda, pv.descricao, qtde],
        );
        const result = await baixarPorProdutoVenda(client, {
          id_loja,
          codigo_venda: codigoVenda,
          quantidade: qtde,
          tipo: 'break',
          referencia_tipo: 'estoque_break',
          referencia_id: idBreak,
          observacao: motivo || `Break #${idBreak} — ${codigoVenda}`,
          criado_por,
        });
        if (result.sem_ficha) {
          erros.push(`Sem ficha para ${codigoVenda}`);
        } else {
          baixas.push(...result.baixas);
          if (result.erros.length) erros.push(...result.erros);
        }
      }
    }

    if (!baixas.length && erros.length) {
      throw Object.assign(new Error(erros.join('; ')), { status: 400 });
    }
    if (!baixas.length) {
      throw Object.assign(new Error('Informe ao menos um item para o break'), { status: 400 });
    }

    if (ownClient) await client.query('COMMIT');
    return { break: br[0], baixas, erros };
  } catch (e) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownClient) client.release();
  }
}

/** Importa linhas de venda (já parseadas) e opcionalmente processa baixas. */
export async function importarVendasLoja(
  {
    id_loja,
    itens,
    origem = 'bkoffice',
    arquivo_nome = null,
    criado_por = null,
    processar = true,
  },
  externalClient = null,
) {
  const client = externalClient || (await pool.connect());
  const ownClient = !externalClient;
  try {
    if (ownClient) await client.query('BEGIN');

    const porData = new Map();
    for (const row of itens) {
      const data = String(row.data_venda || row.data || '').slice(0, 10);
      const codigo = String(row.codigo || '').trim();
      if (!data || !codigo) continue;
      if (!porData.has(data)) porData.set(data, []);
      porData.get(data).push(row);
    }

    const resultados = [];
    for (const [data_venda, linhas] of porData) {
      const { rows: vend } = await client.query(
        `INSERT INTO estoque_vendas
           (id_loja, data_venda, origem, status, arquivo_nome, criado_por)
         VALUES ($1, $2::date, $3, 'pendente', $4, $5)
         ON CONFLICT (id_loja, data_venda, origem) DO UPDATE
           SET arquivo_nome = COALESCE(EXCLUDED.arquivo_nome, estoque_vendas.arquivo_nome),
               status = 'pendente',
               observacao = NULL
         RETURNING *`,
        [id_loja, data_venda, origem, arquivo_nome, criado_por],
      );
      const idVenda = vend[0].id_venda;

      // Remove itens não processados para reimportar; mantém processados
      await client.query(
        `DELETE FROM estoque_venda_itens
         WHERE id_venda = $1 AND processado = FALSE`,
        [idVenda],
      );

      for (const row of linhas) {
        const codigo = String(row.codigo || '').trim();
        const descricao = String(row.descricao || '').trim();
        const qtde = num(row.qtde ?? row.quantidade);
        const venda_liquida =
          row.venda_liquida != null ? num(row.venda_liquida) : row.valor != null ? num(row.valor) : null;
        if (!codigo || qtde <= 0) continue;

        const pv = await upsertProdutoVenda(client, codigo, descricao);
        await client.query(
          `INSERT INTO estoque_venda_itens
             (id_venda, codigo, descricao, qtde, venda_liquida, id_produto_venda, processado, sem_ficha)
           VALUES ($1,$2,$3,$4,$5,$6,FALSE,FALSE)
           ON CONFLICT (id_venda, codigo) DO UPDATE
             SET descricao = EXCLUDED.descricao,
                 qtde = EXCLUDED.qtde,
                 venda_liquida = EXCLUDED.venda_liquida,
                 id_produto_venda = EXCLUDED.id_produto_venda
           WHERE estoque_venda_itens.processado = FALSE`,
          [idVenda, codigo, descricao, qtde, venda_liquida, pv?.id_produto_venda || null],
        );
      }

      let proc = null;
      if (processar) {
        proc = await processarVenda(idVenda, { criado_por }, client);
      }
      resultados.push({ id_venda: idVenda, data_venda, processado: proc });
    }

    if (ownClient) await client.query('COMMIT');
    return { loja: id_loja, dias: resultados.length, resultados };
  } catch (e) {
    if (ownClient) await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (ownClient) client.release();
  }
}
