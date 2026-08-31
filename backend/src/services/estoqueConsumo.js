/**
 * Consumo de insumo na unidade de estoque.
 *
 * Fonte da verdade para baixa por venda. Não usa qtde_estoque da ficha
 * (esse campo misturou receita crua com kg já convertidos).
 *
 * Nunca assume UN = KG. Sem fator validado, não baixa.
 */
import { logger } from '../logger.js';

export const MOTIVO_BAIXA = {
  CONVERSAO_NAO_VALIDADA: 'CONVERSAO_NAO_VALIDADA',
  CONVERSAO_BLOQUEADA: 'CONVERSAO_BLOQUEADA',
  QUANTIDADE_INVALIDA: 'QUANTIDADE_INVALIDA',
  FORA_PILOTO: 'FORA_PILOTO',
  INSUMO_NAO_CADASTRADO: 'INSUMO_NAO_CADASTRADO',
};

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round6(n) {
  return Math.round(num(n) * 1e6) / 1e6;
}

/** Normaliza unidade da receita/estoque para comparação. */
export function normalizarUnidade(u) {
  const x = String(u || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['kg', 'kilo', 'kilos', 'kilograma', 'kilogramas'].includes(x)) return 'kg';
  if (['g', 'gr', 'grs', 'grama', 'gramas'].includes(x)) return 'g';
  if (
    ['und', 'un', 'unid', 'unidade', 'unidades', 'pc', 'pcs', 'peca', 'pecas', 'pç', 'aro'].includes(
      x,
    )
  ) {
    return 'und';
  }
  if (x === 'fatia' || x === 'fatias') return 'fatia';
  if (x === 'concha' || x === 'conchas') return 'concha';
  if (x === 'volta' || x === 'voltas') return 'volta';
  return x || 'und';
}

/** Fator SI quando origem/destino são a mesma grandeza (g ↔ kg). */
export function fatorSi(unidadeOrigem, unidadeDestino) {
  const o = normalizarUnidade(unidadeOrigem);
  const d = normalizarUnidade(unidadeDestino);
  if (o === 'g' && d === 'kg') return 0.001;
  if (o === 'kg' && d === 'g') return 1000;
  return null;
}

/**
 * Converte quantidade da receita → unidade de estoque.
 * fatorConversao = quanto 1 unidade_origem vale na unidade_destino (já validado).
 *
 * @returns {{ ok: true, quantidadeEstoque: number, origemConversao: string } | { ok: false, motivo: string }}
 */
export function resolverConsumoEstoque({
  quantidadeReceita,
  unidadeReceita,
  unidadeEstoque,
  fatorConversao = null,
  fatorStatus = null,
} = {}) {
  const q = num(quantidadeReceita);
  if (!(q > 0)) {
    return { ok: false, motivo: MOTIVO_BAIXA.QUANTIDADE_INVALIDA };
  }

  const orig = normalizarUnidade(unidadeReceita);
  const dest = normalizarUnidade(unidadeEstoque);

  if (orig === dest) {
    return { ok: true, quantidadeEstoque: round6(q), origemConversao: 'identidade', fatorAplicado: 1 };
  }

  const si = fatorSi(orig, dest);
  if (si != null) {
    return { ok: true, quantidadeEstoque: round6(q * si), origemConversao: 'si', fatorAplicado: si };
  }

  const status = String(fatorStatus || '').toLowerCase();
  if (status === 'bloqueado') {
    return { ok: false, motivo: MOTIVO_BAIXA.CONVERSAO_BLOQUEADA, fatorAplicado: num(fatorConversao, 0) || null };
  }

  const fator = num(fatorConversao, 0);
  if (status === 'validado' && fator > 0) {
    return {
      ok: true,
      quantidadeEstoque: round6(q * fator),
      origemConversao: 'fator_validado',
      fatorAplicado: fator,
    };
  }

  return { ok: false, motivo: MOTIVO_BAIXA.CONVERSAO_NAO_VALIDADA, fatorAplicado: null };
}

let schemaPilotoOk = false;

export async function garantirSchemaPilotoBaixa(client) {
  if (schemaPilotoOk) return;
  try {
    await client.query(`
      ALTER TABLE lojas_estoque_perfil
        ADD COLUMN IF NOT EXISTS piloto_baixa BOOLEAN NOT NULL DEFAULT TRUE
    `);
  } catch (e) {
    if (e.code !== '42P01') throw e;
  }
  await client.query(`
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
  await client.query(`
    CREATE TABLE IF NOT EXISTS estoque_insumo_aliases (
      id_alias SERIAL PRIMARY KEY,
      id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
      codigo_ficha TEXT NOT NULL,
      id_insumo INTEGER NOT NULL REFERENCES insumos(id_insumo) ON DELETE CASCADE,
      observacao TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_estoque_insumo_aliases_loja_codigo
        UNIQUE (id_loja, codigo_ficha)
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS estoque_baixa_pendencias (
      id_pendencia BIGSERIAL PRIMARY KEY,
      id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
      id_venda INTEGER,
      codigo_venda TEXT,
      codigo_insumo TEXT,
      id_insumo INTEGER,
      quantidade_receita NUMERIC(14, 6),
      unidade_receita TEXT,
      unidade_estoque TEXT,
      motivo TEXT NOT NULL,
      observacao TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_estoque_baixa_pendencias_loja_em
      ON estoque_baixa_pendencias (id_loja, criado_em DESC)
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS estoque_baixa_auditoria (
      id_auditoria BIGSERIAL PRIMARY KEY,
      id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
      id_venda INTEGER,
      data_venda DATE,
      codigo_produto TEXT,
      descricao_produto TEXT,
      quantidade_vendida NUMERIC(14, 6),
      codigo_ficha TEXT,
      id_insumo INTEGER,
      codigo_insumo TEXT,
      descricao_insumo TEXT,
      quantidade_receita NUMERIC(14, 6),
      unidade_receita TEXT,
      unidade_estoque TEXT,
      fator_aplicado NUMERIC(14, 8),
      origem_conversao TEXT,
      consumo_unitario NUMERIC(14, 6),
      delta NUMERIC(14, 6),
      saldo_antes NUMERIC(14, 6),
      saldo_depois NUMERIC(14, 6),
      status TEXT NOT NULL,
      observacao TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_estoque_baixa_auditoria_loja_em
      ON estoque_baixa_auditoria (id_loja, criado_em DESC)
  `);
  try {
    await semearPilotoBaixa(client);
  } catch (e) {
    logger.warn('estoque', 'Seed piloto baixa incompleto', { error: e.message });
  }
  schemaPilotoOk = true;
}

async function semearPilotoBaixa(client) {
  await client.query(`
    INSERT INTO lojas_estoque_perfil (id_loja, piloto_baixa)
    SELECT l.id_loja, TRUE
    FROM lojas l
    WHERE l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
    ON CONFLICT (id_loja) DO UPDATE SET piloto_baixa = TRUE, atualizado_em = NOW()
  `);
  await client.query(`
    INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
    SELECT i.id_insumo, u.origem, 'kg', 0.0115,
           'embalagem 8x2,208kg / 192 fatias', 'validado', NOW()
    FROM insumos i
    CROSS JOIN (VALUES ('und'), ('fatia')) AS u(origem)
    WHERE UPPER(TRIM(i.codigo)) = '35619' AND i.ativo = TRUE
    ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO NOTHING
  `);
  await client.query(`
    INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
    SELECT i.id_insumo, 'und', 'kg', ROUND((17.2 / 152)::numeric, 8),
           'caixa 17,2kg / 152 und', 'validado', NOW()
    FROM insumos i
    WHERE UPPER(TRIM(i.codigo)) = '021403' AND i.ativo = TRUE
    ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO NOTHING
  `);
  await client.query(`
    INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
    SELECT i.id_insumo, 'und', 'kg', ROUND((18.7 / 330)::numeric, 8),
           'caixa 18,7kg / 330 und', 'validado', NOW()
    FROM insumos i
    WHERE UPPER(TRIM(i.codigo)) = '35622' AND i.ativo = TRUE
    ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO NOTHING
  `);
  await client.query(`
    INSERT INTO estoque_insumo_aliases (id_loja, codigo_ficha, id_insumo, observacao)
    SELECT i.id_loja, '21403', i.id_insumo, 'código legado; canônico 021403'
    FROM insumos i
    WHERE UPPER(TRIM(i.codigo)) = '021403' AND i.ativo = TRUE AND i.contagem_diaria = TRUE
    ON CONFLICT (id_loja, codigo_ficha) DO NOTHING
  `);
}

export async function lojaEmPilotoBaixa(client, idLoja) {
  try {
    const { rows } = await client.query(
      `SELECT COALESCE(piloto_baixa, TRUE) AS piloto
       FROM lojas_estoque_perfil WHERE id_loja = $1`,
      [idLoja],
    );
    if (!rows.length) return true;
    return rows[0]?.piloto !== false;
  } catch (e) {
    if (e.code === '42P01' || e.code === '42703') return true;
    throw e;
  }
}

/**
 * Resolve insumo canônico: alias explícito da ficha, depois código exato.
 * Não remove zero à esquerda.
 */
export async function resolverInsumoCanonico(client, idLoja, codigo) {
  const cod = String(codigo || '').trim().toUpperCase();
  if (!cod) return null;

  try {
    const { rows: alias } = await client.query(
      `SELECT i.id_insumo, i.codigo, i.descricao, i.unidade_contagem,
              COALESCE(i.contagem_diaria, FALSE) AS contagem_diaria, i.ativo
       FROM estoque_insumo_aliases a
       JOIN insumos i ON i.id_insumo = a.id_insumo
       WHERE a.id_loja = $1 AND UPPER(a.codigo_ficha) = $2
       LIMIT 1`,
      [idLoja, cod],
    );
    if (alias[0]?.ativo !== false) {
      if (alias[0]) return alias[0];
    }
  } catch (e) {
    if (e.code !== '42P01') throw e;
  }

  const { rows } = await client.query(
    `SELECT id_insumo, codigo, descricao, unidade_contagem,
            COALESCE(contagem_diaria, FALSE) AS contagem_diaria, ativo
     FROM insumos
     WHERE id_loja = $1 AND UPPER(codigo) = $2 AND ativo = TRUE
     LIMIT 1`,
    [idLoja, cod],
  );
  return rows[0] || null;
}

async function buscarConversao(client, idInsumo, unidadeOrigem, unidadeDestino) {
  const orig = normalizarUnidade(unidadeOrigem);
  const dest = normalizarUnidade(unidadeDestino);
  const origens = orig === 'fatia' ? ['fatia', 'und'] : orig === 'und' ? ['und', 'fatia'] : [orig];
  try {
    const { rows } = await client.query(
      `SELECT fator, status, unidade_origem
       FROM estoque_conversoes
       WHERE id_insumo = $1
         AND unidade_origem = ANY($2::text[])
         AND unidade_destino = $3
       ORDER BY CASE WHEN unidade_origem = $4 THEN 0 ELSE 1 END
       LIMIT 1`,
      [idInsumo, origens, dest, orig],
    );
    return rows[0] || null;
  } catch (e) {
    if (e.code === '42P01') return null;
    throw e;
  }
}

export async function resolverConsumoInsumo(client, {
  idInsumo,
  quantidadeReceita,
  unidadeReceita,
  unidadeEstoque,
}) {
  const orig = normalizarUnidade(unidadeReceita);
  const dest = normalizarUnidade(unidadeEstoque);
  let fatorConversao = null;
  let fatorStatus = null;
  if (orig !== dest && fatorSi(orig, dest) == null) {
    const row = await buscarConversao(client, idInsumo, orig, dest);
    if (row) {
      fatorConversao = row.fator;
      fatorStatus = row.status;
    }
  }
  return resolverConsumoEstoque({
    quantidadeReceita,
    unidadeReceita,
    unidadeEstoque,
    fatorConversao,
    fatorStatus,
  });
}

export async function registrarPendenciaBaixa(client, payload) {
  const {
    id_loja,
    id_venda = null,
    codigo_venda = null,
    codigo_insumo = null,
    id_insumo = null,
    quantidade_receita = null,
    unidade_receita = null,
    unidade_estoque = null,
    motivo,
    observacao = null,
  } = payload;
  try {
    await client.query(
      `INSERT INTO estoque_baixa_pendencias
         (id_loja, id_venda, codigo_venda, codigo_insumo, id_insumo,
          quantidade_receita, unidade_receita, unidade_estoque, motivo, observacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id_loja,
        id_venda,
        codigo_venda,
        codigo_insumo,
        id_insumo,
        quantidade_receita,
        unidade_receita,
        unidade_estoque,
        motivo,
        observacao,
      ],
    );
  } catch (e) {
    if (e.code !== '42P01') {
      logger.warn('estoque', 'Falha ao gravar pendência de baixa', { error: e.message, motivo });
    }
  }
  logger.warn('estoque-baixa', motivo, {
    id_loja,
    codigo_venda,
    codigo_insumo,
    quantidade_receita,
    unidade_receita,
    unidade_estoque,
    observacao,
  });
}

export const STATUS_AUDITORIA_PILOTO = {
  MOVIMENTO_GERADO: 'MOVIMENTO_GERADO',
  FORA_DO_PILOTO: 'FORA_DO_PILOTO',
  CONVERSAO_NAO_VALIDADA: 'CONVERSAO_NAO_VALIDADA',
};

/**
 * Sessão de auditoria temporária do piloto. Falha de insert nunca interrompe a baixa.
 */
export async function criarSessaoAuditoriaPiloto(client, {
  id_loja,
  codigo_venda,
  quantidade_vendida,
  referencia_tipo = null,
  referencia_id = null,
  descricao_produto = null,
}) {
  let id_venda = null;
  let data_venda = null;
  let desc = descricao_produto || null;
  if (referencia_tipo === 'estoque_venda_item' && referencia_id) {
    try {
      const { rows } = await client.query(
        `SELECT v.id_venda, v.data_venda::text AS data_venda, vi.descricao
         FROM estoque_venda_itens vi
         JOIN estoque_vendas v ON v.id_venda = vi.id_venda
         WHERE vi.id_item = $1`,
        [referencia_id],
      );
      if (rows[0]) {
        id_venda = rows[0].id_venda;
        data_venda = rows[0].data_venda;
        desc = desc || rows[0].descricao || null;
      }
    } catch {
      /* auditoria não pode quebrar a baixa */
    }
  }

  return {
    async log(entry) {
      try {
        await client.query(
          `INSERT INTO estoque_baixa_auditoria
             (id_loja, id_venda, data_venda, codigo_produto, descricao_produto, quantidade_vendida,
              codigo_ficha, id_insumo, codigo_insumo, descricao_insumo,
              quantidade_receita, unidade_receita, unidade_estoque,
              fator_aplicado, origem_conversao, consumo_unitario, delta,
              saldo_antes, saldo_depois, status, observacao)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [
            id_loja,
            id_venda,
            data_venda,
            codigo_venda,
            desc,
            quantidade_vendida,
            entry.codigo_ficha ?? null,
            entry.id_insumo ?? null,
            entry.codigo_insumo ?? null,
            entry.descricao_insumo ?? null,
            entry.quantidade_receita ?? null,
            entry.unidade_receita ?? null,
            entry.unidade_estoque ?? null,
            entry.fator_aplicado ?? null,
            entry.origem_conversao ?? null,
            entry.consumo_unitario ?? null,
            entry.delta ?? null,
            entry.saldo_antes ?? null,
            entry.saldo_depois ?? null,
            entry.status,
            entry.observacao ?? null,
          ],
        );
      } catch (e) {
        logger.warn('estoque', 'Falha ao gravar auditoria do piloto', {
          error: e.message,
          status: entry?.status,
          codigo_insumo: entry?.codigo_insumo,
        });
      }
    },
  };
}

export async function listarAuditoriaPiloto(client, {
  id_loja,
  status = null,
  codigo_insumo = null,
  limit = 300,
}) {
  const params = [id_loja];
  let filtro = '';
  if (status) {
    params.push(String(status));
    filtro += ` AND a.status = $${params.length}`;
  }
  if (codigo_insumo) {
    params.push(String(codigo_insumo).trim().toUpperCase());
    filtro += ` AND UPPER(COALESCE(a.codigo_insumo, a.codigo_ficha, '')) = $${params.length}`;
  }
  params.push(Math.min(Number(limit) || 300, 2000));
  const { rows } = await client.query(
    `SELECT a.*
     FROM estoque_baixa_auditoria a
     WHERE a.id_loja = $1 ${filtro}
     ORDER BY a.criado_em DESC, a.id_auditoria DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
}

export function linhasExcelAuditoriaPiloto(rows) {
  return (rows || []).map((r) => ({
    criado_em: r.criado_em,
    data_venda: r.data_venda,
    id_venda: r.id_venda,
    codigo_produto: r.codigo_produto,
    descricao_produto: r.descricao_produto,
    quantidade_vendida: r.quantidade_vendida != null ? Number(r.quantidade_vendida) : null,
    codigo_ficha: r.codigo_ficha,
    codigo_insumo: r.codigo_insumo,
    descricao_insumo: r.descricao_insumo,
    quantidade_receita: r.quantidade_receita != null ? Number(r.quantidade_receita) : null,
    unidade_receita: r.unidade_receita,
    unidade_estoque: r.unidade_estoque,
    fator_aplicado: r.fator_aplicado != null ? Number(r.fator_aplicado) : null,
    origem_conversao: r.origem_conversao,
    consumo_unitario: r.consumo_unitario != null ? Number(r.consumo_unitario) : null,
    delta: r.delta != null ? Number(r.delta) : null,
    saldo_antes: r.saldo_antes != null ? Number(r.saldo_antes) : null,
    saldo_depois: r.saldo_depois != null ? Number(r.saldo_depois) : null,
    status: r.status,
    observacao: r.observacao,
  }));
}
