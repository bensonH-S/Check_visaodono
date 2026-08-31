/**
 * Ciclo de estoque entre duas contagens finalizadas (timestamp real).
 * Intervalo aberto à esquerda: (inicio_em, fim_em].
 */
import { pool } from '../db.js';
import { carregarFichaPorCodigoVenda } from './estoqueMotor.js';
import {
  garantirSchemaPilotoBaixa,
  resolverConsumoInsumo,
  resolverInsumoCanonico,
} from './estoqueConsumo.js';

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round4(n) {
  return Math.round(num(n) * 10000) / 10000;
}

function ancoraContagem(c) {
  return c.contado_em || c.finalizado_em || null;
}

/**
 * Contagem fora da janela oficial? null se loja sem perfil.
 */
export function avaliarForaJanela(contadoEm, perfil) {
  if (!perfil || !contadoEm) return null;
  const d = new Date(contadoEm);
  if (Number.isNaN(d.getTime())) return null;

  // Hora local SP
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hh = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const mm = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const minutosDia = hh * 60 + mm;

  const [ch, cm] = String(perfil.hora_corte || '06:00')
    .slice(0, 5)
    .split(':')
    .map(Number);
  const corte = (Number.isFinite(ch) ? ch : 6) * 60 + (Number.isFinite(cm) ? cm : 0);
  const janela = Number(perfil.janela_minutos) || 30;
  const dist = Math.abs(minutosDia - corte);
  // atravessa meia-noite (ex. corte 06:00 e contagem 23:50)
  const distWrap = Math.min(dist, 24 * 60 - dist);
  return distWrap > janela;
}

async function carregarPerfil(idLoja, client = pool) {
  try {
    const { rows } = await client.query(
      `SELECT id_loja, modo_ciclo, hora_corte::text, janela_minutos
       FROM lojas_estoque_perfil WHERE id_loja = $1`,
      [idLoja],
    );
    return rows[0] || null;
  } catch (e) {
    if (e.code === '42P01') return null; // tabela ainda não migrada
    throw e;
  }
}

async function resolverInsumoRico(client, idLoja, codigo) {
  return resolverInsumoCanonico(client, idLoja, codigo);
}

async function carregarContagemCiclo(idContagem, client = pool) {
  const { rows } = await client.query(
    `SELECT id_contagem, id_loja, data_contagem, tipo, status,
            finalizado_em, contado_em, fora_janela, criado_em
     FROM estoque_contagens WHERE id_contagem = $1`,
    [idContagem],
  );
  return rows[0] || null;
}

/**
 * Resolve par A→B: ids explícitos ou últimas 2 finalizadas do mesmo tipo.
 */
export async function resolverParContagens({
  id_loja,
  id_contagem_inicio = null,
  id_contagem_fim = null,
  tipo = null,
} = {}) {
  const idLoja = Number(id_loja);
  if (!Number.isFinite(idLoja) || idLoja <= 0) {
    throw Object.assign(new Error('id_loja inválido'), { status: 400 });
  }

  if (id_contagem_inicio && id_contagem_fim) {
    const a = await carregarContagemCiclo(Number(id_contagem_inicio));
    const b = await carregarContagemCiclo(Number(id_contagem_fim));
    if (!a || !b) throw Object.assign(new Error('Contagem não encontrada'), { status: 404 });
    if (a.id_loja !== idLoja || b.id_loja !== idLoja) {
      throw Object.assign(new Error('Contagens não pertencem à loja'), { status: 400 });
    }
    if (a.status !== 'finalizada' || b.status !== 'finalizada') {
      throw Object.assign(new Error('Ambas as contagens precisam estar finalizadas'), { status: 400 });
    }
    if (String(a.tipo || 'completa') !== String(b.tipo || 'completa')) {
      throw Object.assign(new Error('Contagens de tipos diferentes — ciclo exige mesmo tipo'), {
        status: 400,
      });
    }
    const ta = ancoraContagem(a);
    const tb = ancoraContagem(b);
    if (!ta || !tb) {
      throw Object.assign(new Error('Contagem sem contado_em/finalizado_em'), { status: 400 });
    }
    if (new Date(tb) <= new Date(ta)) {
      throw Object.assign(new Error('Contagem fim deve ser depois do início'), { status: 400 });
    }
    return { inicio: a, fim: b, inicio_em: ta, fim_em: tb };
  }

  const params = [idLoja];
  let filtroTipo = '';
  if (tipo) {
    params.push(String(tipo));
    filtroTipo = ` AND COALESCE(tipo, 'completa') = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT id_contagem, id_loja, data_contagem, tipo, status,
            finalizado_em, contado_em, fora_janela, criado_em
     FROM estoque_contagens
     WHERE id_loja = $1 AND status = 'finalizada'
       AND COALESCE(contado_em, finalizado_em) IS NOT NULL
       ${filtroTipo}
     ORDER BY COALESCE(contado_em, finalizado_em) DESC, id_contagem DESC
     LIMIT 20`,
    params,
  );
  if (rows.length < 2) {
    throw Object.assign(new Error('Precisa de ao menos 2 contagens finalizadas'), { status: 400 });
  }
  // Últimas 2 do mesmo tipo (a mais recente define o tipo)
  const tipoAlvo = String(rows[0].tipo || 'completa');
  const mesmoTipo = rows.filter((r) => String(r.tipo || 'completa') === tipoAlvo);
  if (mesmoTipo.length < 2) {
    throw Object.assign(new Error(`Precisa de 2 contagens finalizadas do tipo ${tipoAlvo}`), {
      status: 400,
    });
  }
  const fim = mesmoTipo[0];
  const inicio = mesmoTipo[1];
  return {
    inicio,
    fim,
    inicio_em: ancoraContagem(inicio),
    fim_em: ancoraContagem(fim),
  };
}

async function itensContados(idContagem) {
  const { rows } = await pool.query(
    `SELECT i.id_insumo, i.estoque_contado::float AS contado,
            ins.codigo, ins.descricao
     FROM estoque_itens i
     JOIN insumos ins ON ins.id_insumo = i.id_insumo
     WHERE i.id_contagem = $1 AND i.estoque_contado IS NOT NULL`,
    [idContagem],
  );
  return rows;
}

/**
 * Agrega movimentos no intervalo (exclui tipo contagem).
 */
async function agregarMovimentos(idLoja, inicioEm, fimEm, idInsumos) {
  if (!idInsumos.length) return new Map();
  const { rows } = await pool.query(
    `SELECT m.id_insumo,
            m.tipo,
            SUM(m.quantidade)::float AS qtde,
            COUNT(*)::int AS n
     FROM estoque_movimentos m
     WHERE m.id_loja = $1
       AND m.id_insumo = ANY($2::int[])
       AND m.criado_em > $3::timestamptz
       AND m.criado_em <= $4::timestamptz
       AND m.tipo <> 'contagem'
     GROUP BY m.id_insumo, m.tipo`,
    [idLoja, idInsumos, inicioEm, fimEm],
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.id_insumo)) {
      map.set(r.id_insumo, {
        entrada: 0,
        venda: 0,
        break: 0,
        ajuste: 0,
        importacao: 0,
        n_movs: 0,
      });
    }
    const slot = map.get(r.id_insumo);
    const q = num(r.qtde);
    if (r.tipo === 'entrada') slot.entrada += q;
    else if (r.tipo === 'venda') slot.venda += q;
    else if (r.tipo === 'break') slot.break += q;
    else if (r.tipo === 'ajuste') slot.ajuste += q;
    else if (r.tipo === 'importacao') slot.importacao += q;
    slot.n_movs += num(r.n);
  }
  return map;
}

/**
 * Qtde de produto vendida no intervalo (eventos de baixa), para reaplicar ficha.
 */
async function qtdeProdutoNoIntervalo(idLoja, inicioEm, fimEm) {
  const { rows } = await pool.query(
    `WITH movs AS (
       SELECT m.referencia_id, m.criado_em, m.observacao, vi.codigo, vi.qtde::float AS qtde_item,
              ROW_NUMBER() OVER (
                PARTITION BY m.referencia_id, date_trunc('second', m.criado_em)
                ORDER BY m.id_movimento
              ) AS rn
       FROM estoque_movimentos m
       JOIN estoque_venda_itens vi ON vi.id_item = m.referencia_id
       WHERE m.id_loja = $1
         AND m.tipo = 'venda'
         AND m.referencia_tipo = 'estoque_venda_item'
         AND m.criado_em > $2::timestamptz
         AND m.criado_em <= $3::timestamptz
     )
     SELECT referencia_id, criado_em, observacao, codigo, qtde_item
     FROM movs WHERE rn = 1`,
    [idLoja, inicioEm, fimEm],
  );

  const porCodigo = new Map();
  for (const r of rows) {
    const obs = String(r.observacao || '');
    const mDelta = obs.match(/delta\s+(-?[\d.]+)/i);
    let q;
    if (mDelta) q = Number(mDelta[1]);
    else q = num(r.qtde_item);
    if (!Number.isFinite(q) || q === 0) continue;
    const cod = String(r.codigo || '').trim();
    if (!cod) continue;
    porCodigo.set(cod, round4((porCodigo.get(cod) || 0) + q));
  }
  return porCodigo;
}

async function consumoTeoricoPorInsumo(idLoja, porCodigoVenda, idInsumosSet) {
  const consumo = new Map(); // id_insumo -> qtde positiva consumida
  const client = await pool.connect();
  const fichaCache = new Map();
  const insumoCache = new Map();
  try {
    await garantirSchemaPilotoBaixa(pool);
    const getInsumo = async (codigo) => {
      const key = String(codigo || '').trim().toUpperCase();
      if (!key) return null;
      if (insumoCache.has(key)) return insumoCache.get(key);
      const ins = await resolverInsumoRico(client, idLoja, key);
      insumoCache.set(key, ins);
      return ins;
    };
    const getFicha = async (codigo) => {
      const key = String(codigo || '').trim();
      if (!key) return null;
      if (fichaCache.has(key)) return fichaCache.get(key);
      const f = await carregarFichaPorCodigoVenda(client, key, idLoja);
      fichaCache.set(key, f);
      return f;
    };

    for (const [codigo, qtdeVenda] of porCodigoVenda) {
      if (qtdeVenda <= 0) continue;
      const ficha = await getFicha(codigo);
      if (!ficha) {
        const insumo = await getInsumo(codigo);
        if (insumo && idInsumosSet.has(insumo.id_insumo)) {
          consumo.set(
            insumo.id_insumo,
            round4((consumo.get(insumo.id_insumo) || 0) + qtdeVenda),
          );
        }
        continue;
      }
      for (const item of ficha.itens) {
        const insumo = await getInsumo(item.codigo_insumo);
        if (!insumo || !idInsumosSet.has(insumo.id_insumo)) continue;
        const consumoItem = await resolverConsumoInsumo(client, {
          idInsumo: insumo.id_insumo,
          quantidadeReceita: item.quantidade,
          unidadeReceita: item.unidade_receita || 'und',
          unidadeEstoque: insumo.unidade_contagem,
        });
        if (!consumoItem.ok) continue;
        const c = qtdeVenda * consumoItem.quantidadeEstoque;
        consumo.set(insumo.id_insumo, round4((consumo.get(insumo.id_insumo) || 0) + c));
      }
    }
  } finally {
    client.release();
  }
  return consumo;
}

/**
 * Calcula o ciclo A→B.
 */
export async function calcularCiclo({
  id_loja,
  id_contagem_inicio = null,
  id_contagem_fim = null,
  tipo = null,
  persistir = false,
} = {}) {
  const par = await resolverParContagens({
    id_loja,
    id_contagem_inicio,
    id_contagem_fim,
    tipo,
  });
  const { inicio, fim, inicio_em, fim_em } = par;
  const idLoja = Number(id_loja);
  const perfil = await carregarPerfil(idLoja);
  const foraJanelaFim =
    fim.fora_janela != null ? fim.fora_janela : avaliarForaJanela(fim_em, perfil);

  const itensA = await itensContados(inicio.id_contagem);
  const itensB = await itensContados(fim.id_contagem);
  const mapA = new Map(itensA.map((i) => [i.id_insumo, i]));
  const mapB = new Map(itensB.map((i) => [i.id_insumo, i]));

  const idInsumos = [...mapA.keys()].filter((id) => mapB.has(id));
  const idInsumosSet = new Set(idInsumos);

  const movs = await agregarMovimentos(idLoja, inicio_em, fim_em, idInsumos);
  const porCodigo = await qtdeProdutoNoIntervalo(idLoja, inicio_em, fim_em);
  const consumoTeorico = await consumoTeoricoPorInsumo(idLoja, porCodigo, idInsumosSet);

  const itens = [];
  let totDivLivro = 0;
  let totDivTeorico = 0;
  let totEntradas = 0;
  let totVendasLivro = 0;
  let totBreaks = 0;
  let totConsumoTeorico = 0;

  for (const idInsumo of idInsumos) {
    const a = mapA.get(idInsumo);
    const b = mapB.get(idInsumo);
    const ei = num(a.contado);
    const ef = num(b.contado);
    const m = movs.get(idInsumo) || {
      entrada: 0,
      venda: 0,
      break: 0,
      ajuste: 0,
      importacao: 0,
      n_movs: 0,
    };
    const transferencia_in = 0;
    const transferencia_out = 0;

    const esperado_livro = round4(
      ei + m.entrada + m.venda + m.break + m.ajuste + m.importacao + transferencia_in + transferencia_out,
    );
    const consumo_teorico = num(consumoTeorico.get(idInsumo));
    const esperado_teorico = round4(
      ei + m.entrada + m.break + m.ajuste + m.importacao + transferencia_in - transferencia_out - consumo_teorico,
    );
    const div_livro = round4(ef - esperado_livro);
    const div_teorico = round4(ef - esperado_teorico);

    totDivLivro += Math.abs(div_livro);
    totDivTeorico += Math.abs(div_teorico);
    totEntradas += m.entrada;
    totVendasLivro += m.venda;
    totBreaks += m.break;
    totConsumoTeorico += consumo_teorico;

    itens.push({
      id_insumo: idInsumo,
      codigo: a.codigo,
      descricao: a.descricao,
      ei,
      ef,
      entradas: round4(m.entrada),
      vendas_livro: round4(m.venda),
      breaks: round4(m.break),
      ajustes: round4(m.ajuste),
      importacao: round4(m.importacao),
      transferencia_in,
      transferencia_out,
      consumo_teorico: round4(consumo_teorico),
      esperado_livro,
      esperado_teorico,
      div_livro,
      div_teorico,
      n_movs: m.n_movs,
    });
  }

  itens.sort((x, y) => Math.abs(y.div_livro) - Math.abs(x.div_livro));

  const duracaoSeg = Math.max(0, Math.round((new Date(fim_em) - new Date(inicio_em)) / 1000));

  const ciclo = {
    id_loja: idLoja,
    id_contagem_inicio: inicio.id_contagem,
    id_contagem_fim: fim.id_contagem,
    tipo: String(inicio.tipo || 'completa'),
    data_contagem_inicio: inicio.data_contagem,
    data_contagem_fim: fim.data_contagem,
    inicio_em,
    fim_em,
    duracao_segundos: duracaoSeg,
    duracao_horas: round4(duracaoSeg / 3600),
    fora_janela: foraJanelaFim,
    perfil: perfil
      ? {
          modo_ciclo: perfil.modo_ciclo,
          hora_corte: String(perfil.hora_corte).slice(0, 8),
          janela_minutos: perfil.janela_minutos,
        }
      : null,
    transferencias_suportadas: false,
    totais: {
      skus: itens.length,
      entradas: round4(totEntradas),
      vendas_livro: round4(totVendasLivro),
      breaks: round4(totBreaks),
      consumo_teorico: round4(totConsumoTeorico),
      soma_abs_div_livro: round4(totDivLivro),
      soma_abs_div_teorico: round4(totDivTeorico),
    },
    itens,
  };

  if (persistir) {
    const { rows } = await pool.query(
      `INSERT INTO estoque_ciclos
         (id_loja, id_contagem_inicio, id_contagem_fim, inicio_em, fim_em, duracao_segundos, fora_janela)
       VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6,$7)
       ON CONFLICT (id_contagem_inicio, id_contagem_fim) DO UPDATE
         SET inicio_em = EXCLUDED.inicio_em,
             fim_em = EXCLUDED.fim_em,
             duracao_segundos = EXCLUDED.duracao_segundos,
             fora_janela = EXCLUDED.fora_janela
       RETURNING id_ciclo`,
      [
        idLoja,
        inicio.id_contagem,
        fim.id_contagem,
        inicio_em,
        fim_em,
        duracaoSeg,
        foraJanelaFim,
      ],
    );
    ciclo.id_ciclo = rows[0]?.id_ciclo || null;
  }

  return ciclo;
}

function hojeSpISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Painel da rede: diária do dia (quem contou, quem está em andamento, quem falta).
 * Casa em data_contagem (dia operacional), não no horário de fechamento.
 */
export async function listarStatusContagemRede({
  idsPermitidos = null,
  tipo = 'diaria',
  data = null,
} = {}) {
  const hoje = data && /^\d{4}-\d{2}-\d{2}$/.test(String(data)) ? String(data).slice(0, 10) : hojeSpISO();
  const tipoNorm = String(tipo || 'diaria');
  const ids =
    Array.isArray(idsPermitidos) && idsPermitidos.length
      ? idsPermitidos.map(Number).filter((n) => n > 0)
      : null;

  const { rows } = await pool.query(
    `
    SELECT
      l.id_loja,
      l.bk_number,
      l.name,
      c.id_contagem,
      c.status,
      c.titulo,
      COALESCE(c.tipo, 'completa') AS tipo,
      c.data_contagem::text AS data_contagem,
      c.criado_em,
      c.finalizado_em,
      COALESCE(c.contado_em, c.finalizado_em) AS contado_em,
      u.nome AS criado_por_nome,
      ult.data_contagem::text AS ultima_data,
      ult.finalizado_em AS ultima_finalizado_em
    FROM lojas l
    LEFT JOIN LATERAL (
      SELECT *
      FROM estoque_contagens x
      WHERE x.id_loja = l.id_loja
        AND COALESCE(x.tipo, 'completa') = $2
        AND x.data_contagem = $1::date
      ORDER BY x.criado_em DESC, x.id_contagem DESC
      LIMIT 1
    ) c ON TRUE
    LEFT JOIN usuarios u ON u.id_usuario = c.criado_por
    LEFT JOIN LATERAL (
      SELECT data_contagem, finalizado_em
      FROM estoque_contagens y
      WHERE y.id_loja = l.id_loja
        AND COALESCE(y.tipo, 'completa') = $2
        AND y.status = 'finalizada'
      ORDER BY COALESCE(y.contado_em, y.finalizado_em, y.data_contagem::timestamptz) DESC NULLS LAST,
               y.id_contagem DESC
      LIMIT 1
    ) ult ON TRUE
    WHERE l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
      AND ($3::int[] IS NULL OR l.id_loja = ANY($3::int[]))
    ORDER BY l.name
    `,
    [hoje, tipoNorm, ids],
  );

  const lojas = rows.map((r) => {
    let status = 'faltou';
    let status_label = 'Não contou';
    if (r.id_contagem && r.status === 'finalizada') {
      status = 'contou';
      status_label = 'Contou';
    } else if (r.id_contagem && r.status === 'aberta') {
      status = 'aberta';
      status_label = 'Em andamento';
    }
    return {
      id_loja: r.id_loja,
      bk_number: r.bk_number,
      name: r.name,
      id_contagem: r.id_contagem || null,
      status,
      status_label,
      titulo: r.titulo || null,
      tipo: r.tipo || tipoNorm,
      data_contagem: r.data_contagem || null,
      criado_em: r.criado_em || null,
      finalizado_em: r.finalizado_em || null,
      contado_em: r.contado_em || null,
      criado_por_nome: r.criado_por_nome || null,
      ultima_data: r.ultima_data || null,
      ultima_finalizado_em: r.ultima_finalizado_em || null,
    };
  });

  return { hoje, tipo: tipoNorm, lojas };
}

export { carregarPerfil, ancoraContagem };
