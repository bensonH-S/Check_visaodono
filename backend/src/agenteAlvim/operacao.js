import { listarStatusContagemRede } from '../services/estoqueCiclo.js';
import { nomeItemCurto, nomeLojaCurto, primeiroNome } from './texto.js';
import { agruparPorRegional, regionaisDaLoja } from './regiao.js';
import { pool } from '../db.js';

function lojaCurta(row) {
  return nomeLojaCurto(row.loja || row.name);
}

export function chaveLoja(nome) {
  return String(nome || '')
    .replace(/^(BURGER KING|BK)\s*[-–:]?\s*/i, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function mesmoNomeLoja(a, b) {
  const x = chaveLoja(a);
  const y = chaveLoja(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y));
}

export function lojasMencionadasNoTexto(texto, lojas) {
  const t = chaveLoja(texto);
  if (!t) return [];
  return (lojas || []).filter((l) => {
    const k = chaveLoja(l.loja || l.name);
    return k.length >= 4 && t.includes(k);
  });
}

export async function snapshotOperacao({ idRegiao = null, limiteZero = 40 } = {}) {
  const { hoje, lojas } = await listarStatusContagemRede({ tipo: 'diaria' });
  const comRegional = [];
  for (const loja of lojas) {
    const regionais = await regionaisDaLoja(loja.id_loja);
    const principal = regionais[0] || {};
    if (idRegiao && Number(principal.id_regiao) !== Number(idRegiao)) continue;
    comRegional.push({
      id_loja: loja.id_loja,
      loja: lojaCurta(loja),
      status: loja.status,
      status_label: loja.status_label,
      regional: primeiroNome(principal.nome_regional),
      id_regiao: principal.id_regiao || null,
    });
  }

  const contou = comRegional.filter((l) => l.status === 'contou');
  const aberta = comRegional.filter((l) => l.status === 'aberta');
  const faltou = comRegional.filter((l) => l.status === 'faltou');

  const { coletarEstoqueZero } = await import('./tools/estoqueZero.js');
  const zeradosBrutos = await coletarEstoqueZero({ limite: limiteZero });
  const zeradosFiltrados = idRegiao
    ? zeradosBrutos.filter((i) => (i.regionais || []).some((r) => Number(r.id_regiao) === Number(idRegiao)))
    : zeradosBrutos;
  const gruposZero = agruparPorRegional(zeradosFiltrados);
  const estoque_zero = gruposZero.map((g) => ({
    regional: primeiroNome(g.nome_regional),
    id_regiao: g.id_regiao,
    lojas: agruparItensLoja(g.itens),
  }));

  return {
    hoje,
    resumo_contagem: {
      total: comRegional.length,
      contou: contou.length,
      aberta: aberta.length,
      faltou: faltou.length,
    },
    contagem: {
      faltou: faltou.map(mapStatusLoja),
      aberta: aberta.map(mapStatusLoja),
      contou: contou.map(mapStatusLoja),
    },
    estoque_zero,
  };
}

function mapStatusLoja(l) {
  return {
    id_loja: l.id_loja,
    loja: l.loja,
    regional: l.regional,
    status: l.status,
    status_label: l.status_label,
  };
}

export function statusLojaNoSnapshot(snapshot, { id_loja = null, loja = null } = {}) {
  const listas = [
    ...(snapshot?.contagem?.faltou || []),
    ...(snapshot?.contagem?.aberta || []),
    ...(snapshot?.contagem?.contou || []),
  ];
  if (id_loja) {
    const hit = listas.find((l) => Number(l.id_loja) === Number(id_loja));
    if (hit) return hit;
  }
  if (loja) {
    const hit = listas.find((l) => mesmoNomeLoja(l.loja, loja));
    if (hit) return hit;
  }
  return null;
}

export function montarConsulta({ texto, snapshot, pendencias = [], lojasContexto = [] }) {
  const todas = [
    ...(snapshot?.contagem?.faltou || []),
    ...(snapshot?.contagem?.aberta || []),
    ...(snapshot?.contagem?.contou || []),
  ];
  const noTexto = lojasMencionadasNoTexto(texto, todas);
  const doCtx = (lojasContexto || [])
    .map((n) => todas.find((l) => mesmoNomeLoja(l.loja, n)))
    .filter(Boolean);
  const dasPend = (pendencias || [])
    .map((p) => statusLojaNoSnapshot(snapshot, { id_loja: p.id_loja, loja: p.loja }))
    .filter(Boolean);
  const uniq = new Map();
  for (const l of [...noTexto, ...doCtx, ...dasPend]) {
    uniq.set(l.id_loja || l.loja, l);
  }
  const lojas = [...uniq.values()].map((l) => {
    const zerados = (snapshot?.estoque_zero || [])
      .flatMap((g) => g.lojas || [])
      .find((z) => mesmoNomeLoja(z.loja, l.loja));
    return {
      loja: nomeLojaCurto(l.loja),
      id_loja: l.id_loja || null,
      contagem: l.status,
      contagem_label: l.status_label || l.status,
      itens_zerados: zerados?.itens || [],
    };
  });
  return { hoje: snapshot?.hoje || null, lojas };
}

function agruparItensLoja(itens) {
  const porLoja = new Map();
  for (const item of itens || []) {
    const nome = lojaCurta(item);
    if (!porLoja.has(nome)) porLoja.set(nome, []);
    porLoja.get(nome).push(nomeItemCurto(item.descricao || item.item));
  }
  return [...porLoja.entries()].map(([loja, itensLoja]) => ({ loja, itens: itensLoja }));
}

export async function salvarPedidoMonitoramento({ texto, solicitadoPor, grupo }) {
  const itens = String(texto || '')
    .split(/,|;| e /i)
    .map((s) => s.replace(/quando|monitorar|tiver|somente|uma|1|cx|caixa/gi, '').trim())
    .filter((s) => s.length > 2)
    .slice(0, 12);
  await pool.query(
    `
    CREATE TABLE IF NOT EXISTS agente_alvim_pedidos (
      id SERIAL PRIMARY KEY,
      texto TEXT NOT NULL,
      itens TEXT[] NOT NULL DEFAULT '{}',
      solicitado_por TEXT,
      grupo TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    `,
  );
  await pool.query(
    `
    INSERT INTO agente_alvim_pedidos (texto, itens, solicitado_por, grupo)
    VALUES ($1, $2, $3, $4)
    `,
    [String(texto || '').slice(0, 500), itens, solicitadoPor || null, grupo || null],
  );
  return itens;
}

export async function pedidosAtivos() {
  try {
    const { rows } = await pool.query(
      `
      SELECT texto, itens, solicitado_por
      FROM agente_alvim_pedidos
      WHERE ativo = TRUE
      ORDER BY criado_em DESC
      LIMIT 10
      `,
    );
    return rows;
  } catch {
    return [];
  }
}
