import { pool } from '../db.js';

export async function regionaisDaLoja(idLoja) {
  const id = Number(idLoja);
  if (!Number.isFinite(id) || id <= 0) return [];
  const { rows } = await pool.query(
    `
    SELECT DISTINCT
      r.id_regiao,
      r.nome AS nome_regiao,
      u.id_usuario,
      u.nome AS nome_regional
    FROM frota_regiao_lojas rl
    JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
    LEFT JOIN usuarios u ON u.id_usuario = r.id_regional AND u.ativo = TRUE
    WHERE rl.id_loja = $1
    UNION
    SELECT DISTINCT
      r.id_regiao,
      r.nome AS nome_regiao,
      u.id_usuario,
      u.nome AS nome_regional
    FROM frota_regiao_lojas rl
    JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
    JOIN frota_regiao_regionais rr ON rr.id_regiao = r.id_regiao
    JOIN usuarios u ON u.id_usuario = rr.id_usuario AND u.ativo = TRUE
    WHERE rl.id_loja = $1
    ORDER BY id_regiao, id_usuario NULLS LAST
    `,
    [id],
  );
  return rows.map((r) => ({
    id_regiao: Number(r.id_regiao),
    nome_regiao: r.nome_regiao || 'Sem região',
    id_usuario: r.id_usuario ? Number(r.id_usuario) : null,
    nome_regional: r.nome_regional || null,
  }));
}

export function chaveRegional(row) {
  if (row?.id_regiao) return `regiao:${row.id_regiao}`;
  return 'regiao:0';
}

export function agruparPorRegional(itens, pegarLoja) {
  const grupos = new Map();
  for (const item of itens) {
    const regionais = item.regionais?.length
      ? item.regionais
      : [{ id_regiao: 0, nome_regiao: 'Sem região', id_usuario: null, nome_regional: null }];
    for (const reg of regionais) {
      const key = chaveRegional(reg);
      if (!grupos.has(key)) {
        grupos.set(key, {
          ...reg,
          itens: [],
          ids_usuario: new Set(),
        });
      }
      const g = grupos.get(key);
      g.itens.push(item);
      if (reg.id_usuario) g.ids_usuario.add(reg.id_usuario);
      if (pegarLoja) pegarLoja(g, item);
    }
  }
  return [...grupos.values()].map((g) => ({
    id_regiao: g.id_regiao,
    nome_regiao: g.nome_regiao,
    nome_regional: g.nome_regional,
    ids_usuario: [...g.ids_usuario],
    itens: g.itens,
  }));
}
