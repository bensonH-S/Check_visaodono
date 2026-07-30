import { Router } from 'express';
import { pool } from '../db.js';
import { requirePermissao } from '../permissoes.js';
import { usuarioPodeLoja } from '../lojasUsuario.js';
import { auditar } from '../auditoriaHelpers.js';
import { ajustarSaldoPorContagem } from '../services/estoqueMotor.js';
import estoqueOperacional from './estoqueOperacional.js';

const router = Router();

const permProdutos = requirePermissao('estoque.produtos');
const permProdutosOuOp = requirePermissao('estoque.produtos', 'estoque.operacional');
const permConferencia = requirePermissao('estoque.conferencia');
const permReabrirContagem = requirePermissao('estoque.conferencia.reabrir');
const verModulo = requirePermissao(
  'estoque.produtos',
  'estoque.conferencia',
  'estoque.operacional',
);

router.use(estoqueOperacional);

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function unidadeMaiuscula(v) {
  return String(v || 'UND').trim().toUpperCase() || 'UND';
}

function parseIdLoja(src) {
  const id = Number(src);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function acessoLoja(req, idLoja) {
  if (!idLoja) return { status: 400, error: 'Selecione a loja' };
  if (!usuarioPodeLoja(req.user, idLoja)) {
    return { status: 403, error: 'Sem acesso a esta loja' };
  }
  return null;
}

function hojeISOLisboa() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function tituloConferencia(dataISO) {
  const [y, m, d] = String(dataISO || '').split('-');
  if (!y || !m || !d) return 'Conferência de estoque';
  return `Conferência ${d}/${m}/${y}`;
}

async function criarContagemComItens(
  client,
  { id_loja, data_contagem, titulo, observacao, idUsuario, usarUltimo },
) {
  if (!id_loja) throw Object.assign(new Error('Loja obrigatória'), { status: 400 });

  const { rows: cont } = await client.query(
    `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, criado_por)
     VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, 'aberta', $4, $5)
     RETURNING id_contagem`,
    [id_loja, data_contagem, titulo, observacao, idUsuario || null],
  );
  const idContagem = cont[0].id_contagem;

  if (usarUltimo !== false) {
    await client.query(
      `INSERT INTO estoque_itens (id_contagem, id_produto, estoque_sistema, estoque_contado)
       SELECT $1, p.id_produto,
              COALESCE(s.quantidade, u.estoque, 0),
              NULL
       FROM produtos p
       LEFT JOIN estoque_saldos s
         ON s.id_produto = p.id_produto AND s.id_loja = p.id_loja
       LEFT JOIN (
         SELECT DISTINCT ON (i.id_produto)
           i.id_produto,
           COALESCE(i.estoque_contado, i.estoque_sistema, 0) AS estoque
         FROM estoque_itens i
         JOIN estoque_contagens c ON c.id_contagem = i.id_contagem
         WHERE c.status = 'finalizada'
           AND c.id_loja = $2
         ORDER BY i.id_produto, c.data_contagem DESC, c.id_contagem DESC
       ) u ON u.id_produto = p.id_produto
       WHERE p.ativo = TRUE AND p.id_loja = $2`,
      [idContagem, id_loja],
    );
  } else {
    await client.query(
      `INSERT INTO estoque_itens (id_contagem, id_produto, estoque_sistema, estoque_contado)
       SELECT $1, p.id_produto, 0, NULL
       FROM produtos p
       WHERE p.ativo = TRUE AND p.id_loja = $2`,
      [idContagem, id_loja],
    );
  }
  return idContagem;
}

function mapProduto(row) {
  return {
    id_produto: row.id_produto,
    id_loja: row.id_loja != null ? Number(row.id_loja) : null,
    codigo: row.codigo,
    descricao: row.descricao,
    unidade_contagem: unidadeMaiuscula(row.unidade_contagem),
    preco_caixa: row.preco_caixa != null ? Number(row.preco_caixa) : 0,
    und_convertida: row.und_convertida != null ? Number(row.und_convertida) : 1,
    valor_unidade: row.valor_unidade != null ? Number(row.valor_unidade) : 0,
    ativo: row.ativo !== false,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
  };
}

function mapItem(row) {
  const estoque_sistema = num(row.estoque_sistema);
  const estoque_contado =
    row.estoque_contado == null || row.estoque_contado === ''
      ? null
      : num(row.estoque_contado);
  const valor_unidade = num(row.valor_unidade);
  const qtd = estoque_contado ?? 0;
  const valor_estoque = Math.round(qtd * valor_unidade * 100) / 100;
  const diferenca = estoque_contado == null ? null : estoque_contado - estoque_sistema;
  return {
    id_item: row.id_item,
    id_produto: row.id_produto,
    codigo: row.codigo,
    descricao: row.descricao,
    unidade_contagem: unidadeMaiuscula(row.unidade_contagem),
    preco_caixa: num(row.preco_caixa),
    und_convertida: num(row.und_convertida, 1),
    valor_unidade,
    estoque_sistema,
    estoque_contado,
    diferenca,
    valor_estoque: estoque_contado == null ? null : valor_estoque,
  };
}

async function carregarContagem(id) {
  const { rows: contagens } = await pool.query(
    `SELECT c.*, l.name AS loja_nome, l.bk_number AS loja_codigo,
            u.nome AS criado_por_nome
     FROM estoque_contagens c
     LEFT JOIN lojas l ON l.id_loja = c.id_loja
     LEFT JOIN usuarios u ON u.id_usuario = c.criado_por
     WHERE c.id_contagem = $1`,
    [id],
  );
  if (!contagens.length) return null;

  const { rows: itens } = await pool.query(
    `SELECT i.id_item, i.id_produto, i.estoque_sistema, i.estoque_contado,
            p.codigo, p.descricao, p.unidade_contagem, p.preco_caixa,
            p.und_convertida, p.valor_unidade
     FROM estoque_itens i
     JOIN produtos p ON p.id_produto = i.id_produto
     WHERE i.id_contagem = $1
     ORDER BY p.descricao`,
    [id],
  );

  const mapped = itens.map(mapItem);
  const comContagem = mapped.filter((i) => i.estoque_contado != null);
  const total_valor =
    Math.round(comContagem.reduce((s, i) => s + (i.valor_estoque || 0), 0) * 100) / 100;
  const total_diferenca =
    Math.round(comContagem.reduce((s, i) => s + (i.diferenca || 0), 0) * 1000) / 1000;
  const divergencias = comContagem.filter((i) => i.diferenca !== 0).length;
  const pendentes = mapped.filter((i) => i.estoque_contado == null).length;

  const c = contagens[0];
  return {
    id_contagem: c.id_contagem,
    id_loja: c.id_loja,
    loja_nome: c.loja_nome,
    loja_codigo: c.loja_codigo,
    data_contagem: c.data_contagem,
    titulo: c.titulo,
    status: c.status,
    observacao: c.observacao,
    total_valor,
    total_diferenca,
    divergencias,
    pendentes,
    itens_total: mapped.length,
    criado_por: c.criado_por,
    criado_por_nome: c.criado_por_nome,
    criado_em: c.criado_em,
    finalizado_em: c.finalizado_em,
    itens: mapped,
  };
}

// ── Produtos (sempre por loja) ─────────────────────────────────────────────

router.get('/produtos', permProdutosOuOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const q = String(req.query.q || '').trim();
    const ativos = req.query.ativos;
    const params = [idLoja];
    const where = ['id_loja = $1'];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(codigo ILIKE $${params.length} OR descricao ILIKE $${params.length})`);
    }
    if (ativos === '1') where.push('ativo = TRUE');
    if (ativos === '0') where.push('ativo = FALSE');

    const { rows } = await pool.query(
      `SELECT * FROM produtos
       WHERE ${where.join(' AND ')}
       ORDER BY descricao`,
      params,
    );
    res.json(rows.map(mapProduto));
  } catch (e) {
    next(e);
  }
});

router.post('/produtos', permProdutos, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const codigo = String(req.body?.codigo || '').trim().toUpperCase();
    const descricao = String(req.body?.descricao || '').trim();
    const unidade_contagem = unidadeMaiuscula(req.body?.unidade_contagem);
    const preco_caixa = num(req.body?.preco_caixa);
    const und_convertida = num(req.body?.und_convertida, 1);
    if (!codigo) return res.status(400).json({ error: 'Informe o código do produto' });
    if (descricao.length < 2) {
      return res.status(400).json({ error: 'Informe a descrição do produto (mín. 2 caracteres)' });
    }
    if (und_convertida <= 0) {
      return res.status(400).json({ error: 'UND convertida deve ser maior que zero' });
    }

    const { rows } = await pool.query(
      `INSERT INTO produtos (id_loja, codigo, descricao, unidade_contagem, preco_caixa, und_convertida, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING *`,
      [idLoja, codigo, descricao, unidade_contagem, preco_caixa, und_convertida],
    );
    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'produto',
      idReferencia: rows[0].id_produto,
      descricao: `Produto criado (loja ${idLoja}): ${codigo} — ${descricao}`,
    });
    res.status(201).json(mapProduto(rows[0]));
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Já existe um produto com este código nesta loja' });
    }
    next(e);
  }
});

router.patch('/produtos/:id', permProdutos, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const atual = await pool.query('SELECT * FROM produtos WHERE id_produto = $1', [id]);
    if (!atual.rows.length) return res.status(404).json({ error: 'Produto não encontrado' });

    const prev = atual.rows[0];
    const bloqueio = acessoLoja(req, prev.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const codigo =
      req.body?.codigo != null ? String(req.body.codigo).trim().toUpperCase() : prev.codigo;
    const descricao =
      req.body?.descricao != null ? String(req.body.descricao).trim() : prev.descricao;
    const unidade_contagem =
      req.body?.unidade_contagem != null
        ? unidadeMaiuscula(req.body.unidade_contagem)
        : unidadeMaiuscula(prev.unidade_contagem);
    const preco_caixa =
      req.body?.preco_caixa != null ? num(req.body.preco_caixa) : num(prev.preco_caixa);
    const und_convertida =
      req.body?.und_convertida != null
        ? num(req.body.und_convertida, 1)
        : num(prev.und_convertida, 1);
    const ativo = req.body?.ativo != null ? !!req.body.ativo : prev.ativo !== false;

    if (!codigo) return res.status(400).json({ error: 'Informe o código do produto' });
    if (descricao.length < 2) return res.status(400).json({ error: 'Informe a descrição do produto' });
    if (und_convertida <= 0) {
      return res.status(400).json({ error: 'UND convertida deve ser maior que zero' });
    }

    const { rows } = await pool.query(
      `UPDATE produtos
       SET codigo = $1, descricao = $2, unidade_contagem = $3,
           preco_caixa = $4, und_convertida = $5, ativo = $6, atualizado_em = NOW()
       WHERE id_produto = $7 AND id_loja = $8
       RETURNING *`,
      [codigo, descricao, unidade_contagem, preco_caixa, und_convertida, ativo, id, prev.id_loja],
    );
    await auditar(req, {
      modulo: 'estoque',
      acao: 'atualizar',
      entidade: 'produto',
      idReferencia: id,
      descricao: `Produto atualizado (loja ${prev.id_loja}): ${codigo}`,
    });
    res.json(mapProduto(rows[0]));
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Já existe um produto com este código nesta loja' });
    }
    next(e);
  }
});

// ── Contagens / conferência (por loja) ─────────────────────────────────────

router.get('/contagens', permConferencia, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const { rows } = await pool.query(
      `SELECT c.id_contagem, c.id_loja, c.data_contagem, c.titulo, c.status,
              c.observacao, c.total_valor, c.criado_em, c.finalizado_em,
              c.criado_por, u.nome AS criado_por_nome,
              l.name AS loja_nome, l.bk_number AS loja_codigo,
              (SELECT COUNT(*)::int FROM estoque_itens i WHERE i.id_contagem = c.id_contagem) AS itens_total,
              (SELECT COUNT(*)::int FROM estoque_itens i
               WHERE i.id_contagem = c.id_contagem AND i.estoque_contado IS NULL) AS pendentes,
              (SELECT COUNT(*)::int FROM estoque_itens i
               WHERE i.id_contagem = c.id_contagem
                 AND i.estoque_contado IS NOT NULL
                 AND i.estoque_contado <> i.estoque_sistema) AS divergencias
       FROM estoque_contagens c
       LEFT JOIN lojas l ON l.id_loja = c.id_loja
       LEFT JOIN usuarios u ON u.id_usuario = c.criado_por
       WHERE c.id_loja = $1
       ORDER BY c.criado_em DESC, c.id_contagem DESC
       LIMIT 100`,
      [idLoja],
    );
    res.json(
      rows.map((r) => ({
        ...r,
        total_valor: r.total_valor != null ? Number(r.total_valor) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

/** Retorna a conferência aberta da loja, ou a mais recente. */
router.get('/contagens/atual', permConferencia, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const hoje = hojeISOLisboa();
    const metaBase = { hoje, id_loja: idLoja };

    const { rows: abertas } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE status = 'aberta' AND id_loja = $1
       ORDER BY criado_em DESC, id_contagem DESC
       LIMIT 1`,
      [idLoja],
    );
    if (abertas.length) {
      const detalhe = await carregarContagem(abertas[0].id_contagem);
      return res.json({ ...detalhe, meta: { ...metaBase, iniciada_agora: false } });
    }

    const { rows: ultima } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE id_loja = $1
       ORDER BY COALESCE(finalizado_em, criado_em) DESC, id_contagem DESC
       LIMIT 1`,
      [idLoja],
    );
    if (ultima.length) {
      const detalhe = await carregarContagem(ultima[0].id_contagem);
      return res.json({ ...detalhe, meta: { ...metaBase, iniciada_agora: false } });
    }

    res.json({
      id_contagem: null,
      id_loja: idLoja,
      itens: [],
      meta: { ...metaBase, iniciada_agora: false },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/contagens/:id', permConferencia, async (req, res, next) => {
  try {
    const detalhe = await carregarContagem(Number(req.params.id));
    if (!detalhe) return res.status(404).json({ error: 'Contagem não encontrada' });
    const bloqueio = acessoLoja(req, detalhe.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    res.json(detalhe);
  } catch (e) {
    next(e);
  }
});

router.post('/contagens', permConferencia, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id_loja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const data_contagem = String(req.body?.data_contagem || '').trim() || null;
    const titulo = String(req.body?.titulo || '').trim() || null;
    const observacao =
      req.body?.observacao != null ? String(req.body.observacao).trim() || null : null;
    const usarUltimo = req.body?.usar_ultimo_estoque !== false;

    await client.query('BEGIN');
    const idContagem = await criarContagemComItens(client, {
      id_loja,
      data_contagem,
      titulo,
      observacao,
      idUsuario: req.user?.id_usuario || req.user?.sub,
      usarUltimo,
    });
    await client.query('COMMIT');
    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'estoque_contagem',
      idReferencia: idContagem,
      descricao: `Contagem criada (#${idContagem}) loja ${id_loja}`,
    });

    res.status(201).json(await carregarContagem(idContagem));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  } finally {
    client.release();
  }
});

router.post('/contagens/iniciar-sabado', permConferencia, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const hoje = hojeISOLisboa();
    const idUsuario = req.user?.id_usuario || req.user?.sub || null;
    const metaBase = { hoje, id_loja: idLoja };

    const { rows: abertas } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE status = 'aberta' AND id_loja = $1
       LIMIT 1`,
      [idLoja],
    );
    if (abertas.length) {
      const detalhe = await carregarContagem(abertas[0].id_contagem);
      return res.json({ ...detalhe, meta: { ...metaBase, iniciada_agora: false } });
    }

    await client.query('BEGIN');
    const idContagem = await criarContagemComItens(client, {
      id_loja: idLoja,
      data_contagem: hoje,
      titulo: tituloConferencia(hoje),
      observacao: null,
      idUsuario,
      usarUltimo: true,
    });
    await client.query('COMMIT');
    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'estoque_contagem',
      idReferencia: idContagem,
      descricao: `Conferência iniciada (#${idContagem}) loja ${idLoja} em ${hoje}`,
    });
    const detalhe = await carregarContagem(idContagem);
    res.status(201).json({ ...detalhe, meta: { ...metaBase, iniciada_agora: true } });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  } finally {
    client.release();
  }
});

router.put('/contagens/:id/itens', permConferencia, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows: cont } = await pool.query(
      'SELECT id_contagem, id_loja, status FROM estoque_contagens WHERE id_contagem = $1',
      [id],
    );
    if (!cont.length) return res.status(404).json({ error: 'Contagem não encontrada' });
    const bloqueio = acessoLoja(req, cont[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    if (cont[0].status === 'finalizada') {
      return res.status(400).json({ error: 'Contagem finalizada — não pode ser editada' });
    }

    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!itens.length) return res.status(400).json({ error: 'Envie ao menos um item' });

    const ids = [];
    const contados = [];
    const sistemas = [];
    let temSistema = false;
    for (const item of itens) {
      const idItem = Number(item.id_item);
      if (!idItem) continue;
      ids.push(idItem);
      contados.push(
        item.estoque_contado === null || item.estoque_contado === ''
          ? null
          : num(item.estoque_contado),
      );
      if (item.estoque_sistema !== undefined) {
        temSistema = true;
        sistemas.push(num(item.estoque_sistema));
      } else {
        sistemas.push(null);
      }
    }

    if (!ids.length) return res.status(400).json({ error: 'Nenhum item válido' });

    if (temSistema) {
      await pool.query(
        `UPDATE estoque_itens AS ei
         SET estoque_contado = v.contado,
             estoque_sistema = COALESCE(v.sistema, ei.estoque_sistema)
         FROM unnest($1::int[], $2::numeric[], $3::numeric[]) AS v(id_item, contado, sistema)
         WHERE ei.id_item = v.id_item AND ei.id_contagem = $4`,
        [ids, contados, sistemas, id],
      );
    } else {
      await pool.query(
        `UPDATE estoque_itens AS ei
         SET estoque_contado = v.contado
         FROM unnest($1::int[], $2::numeric[]) AS v(id_item, contado)
         WHERE ei.id_item = v.id_item AND ei.id_contagem = $3`,
        [ids, contados, id],
      );
    }

    res.json(await carregarContagem(id));
  } catch (e) {
    next(e);
  }
});

router.post('/contagens/:id/finalizar', permConferencia, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const detalhe = await carregarContagem(id);
    if (!detalhe) return res.status(404).json({ error: 'Contagem não encontrada' });
    const bloqueio = acessoLoja(req, detalhe.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    if (detalhe.status === 'finalizada') {
      return res.status(400).json({ error: 'Contagem já finalizada' });
    }
    if (detalhe.pendentes > 0) {
      return res.status(400).json({
        error: `Ainda há ${detalhe.pendentes} produto(s) sem contagem. Preencha todos ou informe 0.`,
      });
    }

    const idUsuario = req.user?.id_usuario || req.user?.sub || null;
    await client.query('BEGIN');
    await client.query(
      `UPDATE estoque_contagens
       SET status = 'finalizada', total_valor = $1, finalizado_em = NOW()
       WHERE id_contagem = $2`,
      [detalhe.total_valor, id],
    );
    await ajustarSaldoPorContagem(client, id, idUsuario);
    await client.query('COMMIT');

    await auditar(req, {
      modulo: 'estoque',
      acao: 'finalizar',
      entidade: 'estoque_contagem',
      idReferencia: id,
      descricao: `Contagem #${id} finalizada — total R$ ${detalhe.total_valor}`,
    });

    res.json(await carregarContagem(id));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

/**
 * Reabre conferência finalizada para edição — permissão estoque.conferencia.reabrir.
 * Não reverte saldos já ajustados; ao finalizar de novo o motor recalcula o delta.
 */
router.patch('/contagens/:id/reabrir', permReabrirContagem, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      'SELECT id_contagem, id_loja, status, titulo FROM estoque_contagens WHERE id_contagem = $1',
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Contagem não encontrada' });
    const cont = rows[0];
    const bloqueio = acessoLoja(req, cont.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    if (cont.status !== 'finalizada') {
      return res.status(400).json({ error: 'Só é possível reabrir contagem finalizada' });
    }

    const { rows: outrasAbertas } = await pool.query(
      `SELECT id_contagem FROM estoque_contagens
       WHERE id_loja = $1 AND status = 'aberta' AND id_contagem <> $2
       LIMIT 1`,
      [cont.id_loja, id],
    );
    if (outrasAbertas.length) {
      return res.status(400).json({
        error: `Já existe conferência aberta (#${outrasAbertas[0].id_contagem}). Finalize ou exclua antes de reabrir esta.`,
      });
    }

    await pool.query(
      `UPDATE estoque_contagens
       SET status = 'aberta', finalizado_em = NULL
       WHERE id_contagem = $1`,
      [id],
    );

    await auditar(req, {
      modulo: 'estoque',
      acao: 'reabrir',
      entidade: 'estoque_contagem',
      idReferencia: id,
      descricao: `Contagem #${id} reaberta (${cont.titulo || 'sem título'})`,
    });

    res.json(await carregarContagem(id));
  } catch (e) {
    next(e);
  }
});

router.delete('/contagens/:id', permConferencia, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      'SELECT id_contagem, id_loja, titulo, status FROM estoque_contagens WHERE id_contagem = $1',
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Contagem não encontrada' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    await pool.query('DELETE FROM estoque_contagens WHERE id_contagem = $1', [id]);
    await auditar(req, {
      modulo: 'estoque',
      acao: 'excluir',
      entidade: 'estoque_contagem',
      idReferencia: id,
      descricao: `Contagem #${id} excluída (${rows[0].titulo || rows[0].status})`,
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.get('/resumo', verModulo, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const [{ rows: prod }, { rows: cont }] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE ativo)::int AS ativos
         FROM produtos WHERE id_loja = $1`,
        [idLoja],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'aberta')::int AS abertas,
                COUNT(*) FILTER (WHERE status = 'finalizada')::int AS finalizadas
         FROM estoque_contagens WHERE id_loja = $1`,
        [idLoja],
      ),
    ]);
    res.json({
      id_loja: idLoja,
      produtos: prod[0],
      contagens: cont[0],
    });
  } catch (e) {
    next(e);
  }
});

export default router;
