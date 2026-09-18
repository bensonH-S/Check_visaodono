import { pool } from '../../db.js';
import { chaveDedup, filtrarNovos, registrarEnvio } from '../dedup.js';
import { dataHojeSp } from '../horario.js';
import { agruparPorRegional, regionaisDaLoja } from '../regiao.js';
import { bolhasEstoqueZero } from '../texto.js';
import { destinosDoRecado, enviarRecadoAlvim } from '../recado.js';
import { chavePendencia, marcarCobradas, registrarDeteccao } from '../pendencia.js';
import { primeiroNome } from '../texto.js';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function coletarEstoqueZero({ limite = 40, id_loja = null } = {}) {
  const params = [limite];
  let filtroLoja = '';
  if (id_loja) {
    params.push(Number(id_loja));
    filtroLoja = `AND p.id_loja = $${params.length}`;
  }
  const { rows } = await pool.query(
    `
    SELECT
      p.id_loja,
      l.name AS loja,
      l.bk_number,
      p.codigo,
      p.descricao,
      p.unidade_contagem AS unidade,
      p.grupo_diario,
      COALESCE(s.quantidade, 0)::numeric AS quantidade
    FROM insumos p
    JOIN lojas l ON l.id_loja = p.id_loja
    LEFT JOIN estoque_saldos s
      ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
    WHERE p.ativo = TRUE
      AND COALESCE(p.contagem_diaria, FALSE) = TRUE
      AND COALESCE(s.quantidade, 0) <= 0.001
      AND l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
      ${filtroLoja}
    ORDER BY quantidade ASC, l.name, p.descricao
    LIMIT $1
    `,
    params,
  );
  const itens = [];
  for (const r of rows) {
    itens.push({
      id_loja: Number(r.id_loja),
      loja: r.loja,
      bk_number: r.bk_number,
      codigo: String(r.codigo || ''),
      descricao: r.descricao,
      unidade: r.unidade || 'UND',
      grupo: r.grupo_diario || null,
      quantidade: num(r.quantidade),
      regionais: await regionaisDaLoja(r.id_loja),
    });
  }
  return itens;
}

function lojasDoGrupo(itens) {
  const porLoja = new Map();
  for (const item of itens) {
    const id = item.id_loja;
    if (!porLoja.has(id)) {
      porLoja.set(id, { id_loja: id, loja: item.loja, bk_number: item.bk_number, itens: [] });
    }
    porLoja.get(id).itens.push({
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: item.quantidade,
    });
  }
  return [...porLoja.values()];
}

export async function executarEstoqueZero(config, { dryRun = false, destinoOverride = null } = {}) {
  const dia = dataHojeSp();
  const coletados = await coletarEstoqueZero();
  if (!coletados.length) {
    return { ferramenta: 'estoque_zero', enviados: 0, pendentes: 0, motivo: 'nada_zerado' };
  }

  const comChave = coletados.map((item) => ({
    ...item,
    chave: chaveDedup('estoque_zero', [item.id_loja, item.codigo], dia),
  }));
  const novas = destinoOverride
    ? new Set(comChave.map((i) => i.chave))
    : new Set(await filtrarNovos(comChave.map((i) => i.chave)));
  const pendentes = comChave.filter((i) => novas.has(i.chave));
  if (!pendentes.length) {
    return { ferramenta: 'estoque_zero', enviados: 0, pendentes: 0, motivo: 'ja_avisado_hoje' };
  }

  const grupos = agruparPorRegional(pendentes);
  const fila = destinoOverride ? grupos.slice(0, 1) : grupos;
  let enviados = 0;
  const detalhes = [];

  for (const grupo of fila) {
    const lojas = lojasDoGrupo(grupo.itens);
    const chaves = [];
    for (const item of grupo.itens) {
      const chaveP = chavePendencia('estoque_zero', [item.id_loja, item.codigo], dia);
      const p = await registrarDeteccao({
        chave: chaveP,
        tipo: 'estoque_zero',
        loja: item.loja,
        id_loja: item.id_loja,
        regional: primeiroNome(grupo.nome_regional),
        id_regiao: grupo.id_regiao,
        id_usuario: grupo.ids_usuario?.[0] || null,
        assunto: item.descricao || item.item,
        dia,
        payload: { codigo: item.codigo, quantidade: item.quantidade },
      });
      chaves.push(chaveP);
      void p;
    }
    const fatos = {
      tipo: 'estoque_zero',
      missao: 'avisar_item_zerado_na_loja',
      regional: grupo.nome_regional,
      regiao: grupo.nome_regiao,
      ids_usuario: grupo.ids_usuario || [],
      lojas,
    };
    const destinos = destinosDoRecado(config, grupo, destinoOverride);
    if (!destinos.length) {
      detalhes.push({ regiao: grupo.nome_regiao, ok: false, motivo: 'sem_regional' });
      continue;
    }

    const r = await enviarRecadoAlvim({
      config,
      destinos,
      fatos,
      fallbackBolhas: bolhasEstoqueZero({ nomeRegional: grupo.nome_regional, lojas }),
      dryRun,
    });
    if (dryRun) {
      detalhes.push({ regiao: grupo.nome_regiao, ok: true, dryRun: true, bolhas: r.bolhas });
      continue;
    }
    if (!r.ok) {
      detalhes.push({ regiao: grupo.nome_regiao, ok: false, motivo: r.motivo });
      continue;
    }

    if (destinoOverride) {
      await marcarCobradas(chaves);
      enviados += 1;
      detalhes.push({
        regiao: grupo.nome_regiao,
        ok: true,
        teste: true,
        itens: grupo.itens.length,
        bolhas: r.bolhas?.length,
      });
      continue;
    }

    for (const item of grupo.itens) {
      await registrarEnvio({
        chave: item.chave,
        ferramenta: 'estoque_zero',
        destino: destinos.map((d) => d.id_usuario || d).join(','),
        payload: {
          id_loja: item.id_loja,
          codigo: item.codigo,
          quantidade: item.quantidade,
        },
      });
    }
    await marcarCobradas(chaves);
    enviados += 1;
    detalhes.push({ regiao: grupo.nome_regiao, ok: true, itens: grupo.itens.length });
  }

  return {
    ferramenta: 'estoque_zero',
    enviados,
    pendentes: pendentes.length,
    detalhes,
  };
}
