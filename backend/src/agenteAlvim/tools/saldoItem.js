import { pool } from '../../db.js';
import { logger } from '../../logger.js';
import { nomeItemCurto, nomeLojaCurto, qtdFalaEmprestimo } from '../texto.js';
import { centroCoordenadas, kmEntre, resumoEmprestimo } from '../emprestimo.js';

function chaveNome(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function primeiro(valor) {
  return chaveNome(valor).split(/\s+/)[0] || '';
}

function chaveLojaLocal(nome) {
  return String(nome || '')
    .replace(/^(BURGER KING|BK)\s*[-–:]?\s*/i, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function mesmoNomeLojaLocal(a, b) {
  const x = chaveLojaLocal(a);
  const y = chaveLojaLocal(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 4 && y.includes(x)) || (y.length >= 4 && x.includes(y));
}

function itemBate(descricao, tokens) {
  const d = chaveNome(descricao);
  const curto = chaveNome(nomeItemCurto(descricao));
  return (tokens || []).every((t) => d.includes(t) || curto.includes(t));
}

async function listarRegionais() {
  const { rows } = await pool.query(
    `
    SELECT DISTINCT
      r.id_regiao,
      r.nome AS nome_regiao,
      u.nome AS nome_regional
    FROM frota_regioes r
    LEFT JOIN usuarios u ON u.id_usuario = r.id_regional AND u.ativo = TRUE
    WHERE r.ativo = TRUE
    UNION
    SELECT DISTINCT
      r.id_regiao,
      r.nome AS nome_regiao,
      u.nome AS nome_regional
    FROM frota_regioes r
    JOIN frota_regiao_regionais rr ON rr.id_regiao = r.id_regiao
    JOIN usuarios u ON u.id_usuario = rr.id_usuario AND u.ativo = TRUE
    WHERE r.ativo = TRUE
    ORDER BY 2
    `,
  );
  return rows.map((r) => ({
    id_regiao: Number(r.id_regiao),
    nome_regiao: r.nome_regiao || '',
    nome_regional: r.nome_regional || '',
    chave: primeiro(r.nome_regional) || chaveNome(r.nome_regiao),
  }));
}

export function acharRegionalNaLista(nome, regionais) {
  const k = primeiro(nome) || chaveNome(nome);
  if (!k) return null;
  return (regionais || []).find((r) => {
    const cr = r.chave || primeiro(r.nome_regional);
    const cn = chaveNome(r.nome_regional);
    const cg = chaveNome(r.nome_regiao);
    return cr === k || cn.startsWith(`${k} `) || cn === k || k.startsWith(cr) || cg.includes(k);
  }) || null;
}

async function coordsDaLoja(nome) {
  if (!nome) return null;
  const { rows } = await pool.query(
    `
    SELECT id_loja, name, latitude, longitude
    FROM lojas
    WHERE bk_number IS NOT NULL AND TRIM(bk_number::text) <> ''
    `,
  );
  const hit = rows.find((r) => mesmoNomeLojaLocal(r.name, nome));
  if (!hit) return null;
  const lat = Number(hit.latitude);
  const lng = Number(hit.longitude);
  return {
    id_loja: Number(hit.id_loja),
    loja: hit.name,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

export async function coletarSaldoEmprestimo({
  regional,
  item_tokens = [],
  minimo = 0,
  loja_origem = null,
  pediu_cx = false,
  quer_proxima = false,
} = {}) {
  const tokens = (item_tokens || []).map((t) => chaveNome(t)).filter(Boolean);
  const regionais = await listarRegionais();
  const reg = acharRegionalNaLista(regional, regionais);
  if (!reg) {
    logger.info('agente-alvim', 'Empréstimo: regional não achada', { tentou: regional });
    return {
      regional: regional || null,
      item: tokens.join(' '),
      minimo: Number(minimo) || 0,
      lojas: [],
      aviso: regional ? `não achei a regional ${regional} no cadastro` : 'não achei qual regional',
      criterio: null,
    };
  }

  const { rows: lojasReg } = await pool.query(
    `
    SELECT l.id_loja, l.name, l.latitude, l.longitude
    FROM frota_regiao_lojas rl
    JOIN lojas l ON l.id_loja = rl.id_loja
    WHERE rl.id_regiao = $1
      AND l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
    `,
    [reg.id_regiao],
  );
  const ids = lojasReg.map((l) => Number(l.id_loja)).filter(Boolean);
  if (!ids.length) {
    return {
      regional: reg.nome_regional || regional,
      item: tokens.join(' '),
      minimo: Number(minimo) || 0,
      lojas: [],
      aviso: `não achei loja na região de ${reg.nome_regional || regional}`,
      criterio: null,
    };
  }

  const { rows: saldos } = await pool.query(
    `
    SELECT
      p.id_loja,
      l.name AS loja,
      p.descricao,
      p.unidade_contagem AS unidade,
      COALESCE(NULLIF(p.und_convertida, 0), 1) AS und_convertida,
      COALESCE(s.quantidade, 0)::numeric AS quantidade,
      l.latitude,
      l.longitude
    FROM insumos p
    JOIN lojas l ON l.id_loja = p.id_loja
    LEFT JOIN estoque_saldos s
      ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
    WHERE p.ativo = TRUE
      AND p.id_loja = ANY($1::int[])
      AND COALESCE(p.contagem_diaria, FALSE) = TRUE
    `,
    [ids],
  );

  const origemNome = loja_origem
    ? await coordsDaLoja(loja_origem)
    : null;
  const origem = origemNome || centroCoordenadas(
    lojasReg.map((l) => ({ lat: l.latitude, lng: l.longitude })),
  );
  const min = Number(minimo) || 0;
  const candidatos = saldos.filter((r) => itemBate(r.descricao, tokens));
  const porLoja = new Map();
  for (const r of candidatos) {
    const id = Number(r.id_loja);
    if (origemNome?.id_loja && id === origemNome.id_loja) continue;
    const qtd = Number(r.quantidade) || 0;
    const atual = porLoja.get(id);
    if (atual && atual.qtd_estoque >= qtd) continue;
    const km = origem ? kmEntre(origem, { lat: r.latitude, lng: r.longitude }) : null;
    const fala = qtdFalaEmprestimo({
      qtd,
      unid: r.unidade,
      und_convertida: r.und_convertida,
      pediu_cx,
    });
    porLoja.set(id, {
      loja: nomeLojaCurto(r.loja),
      qtd: fala.qtd,
      unid: fala.unid,
      kg: String(r.unidade || '').toUpperCase() === 'KG' ? Math.round(qtd) : null,
      qtd_estoque: qtd,
      unid_estoque: String(r.unidade || 'UND').trim() || 'UND',
      sem_fator_caixa: fala.sem_fator_caixa === true,
      item: nomeItemCurto(r.descricao),
      km,
    });
  }

  const todos = [...porLoja.values()];
  const { mais_perto, com_minimo, unica_longe } = resumoEmprestimo(todos, { minimo: min });
  const temCx = todos.some((l) => l.unid === 'cx');
  const criterio = origemNome
    ? `perto de ${nomeLojaCurto(origemNome.loja)}, região de ${reg.nome_regional || regional}`
    : `miolo da região de ${reg.nome_regional || regional}`;

  const saida = {
    regional: reg.nome_regional || regional,
    item: mais_perto?.item || tokens.join(' '),
    minimo: min,
    unid: mais_perto?.unid || (pediu_cx ? 'cx' : 'und'),
    origem: origemNome ? nomeLojaCurto(origemNome.loja) : `região de ${reg.nome_regional || regional}`,
    mais_perto,
    quem_tem_o_minimo: com_minimo,
    unica_longe,
    lojas: unica_longe
      ? [mais_perto, ...com_minimo.filter((l) => l.loja !== mais_perto?.loja)].filter(Boolean).slice(0, 4)
      : (com_minimo.length ? com_minimo : todos).slice(0, quer_proxima ? 3 : 8),
    abaixo: com_minimo.length ? [] : todos.slice(0, 3),
    criterio,
    aviso: null,
  };
  if (!tokens.length) {
    saida.lojas = [];
    saida.mais_perto = null;
    saida.quem_tem_o_minimo = [];
    saida.aviso = 'não entendi qual item';
  } else if (!candidatos.length) {
    saida.lojas = [];
    saida.mais_perto = null;
    saida.quem_tem_o_minimo = [];
    saida.aviso = `não achei ${tokens.join(' ')} na região de ${reg.nome_regional || regional}`;
  } else if (pediu_cx && !temCx) {
    saida.aviso = 'cadastro sem fator de caixa; não dá pra falar em cx';
  } else if (!com_minimo.length) {
    saida.aviso = `ninguém na região de ${reg.nome_regional || regional} tem mais de ${min} cx`;
  } else if (unica_longe) {
    saida.aviso = `a que tem mais de ${min} cx não é a mais perto`;
  }

  logger.info('agente-alvim', 'Consulta empréstimo', {
    regional: saida.regional,
    item: saida.item,
    minimo: saida.minimo,
    origem: saida.origem,
    unica_longe: saida.unica_longe,
    mais_perto: saida.mais_perto
      ? { loja: saida.mais_perto.loja, qtd: saida.mais_perto.qtd, unid: saida.mais_perto.unid, km: saida.mais_perto.km }
      : null,
    quem_tem_o_minimo: (saida.quem_tem_o_minimo || []).map((l) => ({ loja: l.loja, qtd: l.qtd, km: l.km })),
    aviso: saida.aviso,
  });
  return saida;
}
