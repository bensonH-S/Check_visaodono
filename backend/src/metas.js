import { pool } from './db.js';
import { temPermissao } from './permissoes.js';

export function podeGerenciarMetas(user) {
  return temPermissao(user, 'metas.gerenciar');
}

export function podeVerMetas(user) {
  return podeGerenciarMetas(user) || temPermissao(user, 'metas.ver');
}

export async function listarPeriodosMetas() {
  const { rows } = await pool.query(
    `SELECT id_periodo, ano, mes, titulo, observacao, criado_em
     FROM metas_periodos
     ORDER BY ano DESC, mes DESC`,
  );
  return rows;
}

async function carregarPaineis(idPeriodo) {
  const { rows: paineis } = await pool.query(
    `SELECT id_painel, codigo, titulo, tipo, ordem
     FROM metas_paineis
     WHERE id_periodo = $1
     ORDER BY ordem, id_painel`,
    [idPeriodo],
  );

  const resultado = [];
  for (const painel of paineis) {
    const [indicadores, lojas, realizados] = await Promise.all([
      pool.query(
        `SELECT i.id_indicador, i.codigo, i.nome, i.tipo_valor, pi.peso, pi.ordem
         FROM metas_painel_indicadores pi
         JOIN metas_indicadores i ON i.id_indicador = pi.id_indicador
         WHERE pi.id_painel = $1
         ORDER BY pi.ordem, i.nome`,
        [painel.id_painel],
      ),
      pool.query(
        `SELECT pl.id_loja, pl.rotulo_curto, pl.ordem, l.name AS nome_loja, l.bk_number
         FROM metas_painel_lojas pl
         JOIN lojas l ON l.id_loja = pl.id_loja
         WHERE pl.id_painel = $1
         ORDER BY pl.ordem, l.name`,
        [painel.id_painel],
      ),
      pool.query(
        `SELECT r.id_indicador, r.id_loja, r.valor_texto, r.valor_numero, r.atingiu, r.pontos_obtidos
         FROM metas_realizados r
         WHERE r.id_painel = $1`,
        [painel.id_painel],
      ),
    ]);

    const mapRealizado = new Map();
    for (const r of realizados.rows) {
      mapRealizado.set(`${r.id_indicador}-${r.id_loja ?? 'null'}`, r);
    }

    let subtotalPeso = 0;
    const linhasIndicadores = indicadores.rows.map((ind) => {
      subtotalPeso += Number(ind.peso) || 0;
      const celulas = lojas.rows.map((loja) => {
        const key = `${ind.id_indicador}-${loja.id_loja}`;
        const real = mapRealizado.get(key);
        return {
          id_loja: loja.id_loja,
          rotulo_curto: loja.rotulo_curto,
          nome_loja: loja.nome_loja,
          bk_number: loja.bk_number,
          valor_texto: real?.valor_texto ?? null,
          valor_numero: real?.valor_numero != null ? Number(real.valor_numero) : null,
          atingiu: real?.atingiu ?? null,
          pontos_obtidos: real?.pontos_obtidos ?? null,
        };
      });
      return {
        id_indicador: ind.id_indicador,
        codigo: ind.codigo,
        nome: ind.nome,
        peso: ind.peso,
        tipo_valor: ind.tipo_valor,
        celulas,
      };
    });

    resultado.push({
      ...painel,
      subtotal_peso: subtotalPeso,
      lojas: lojas.rows,
      indicadores: linhasIndicadores,
    });
  }
  return resultado;
}

async function carregarRankings(idPeriodo) {
  const { rows: indicadores } = await pool.query(
    `SELECT DISTINCT i.id_indicador, i.codigo, i.nome, i.meta_minima, i.ordem
     FROM metas_rankings r
     JOIN metas_indicadores i ON i.id_indicador = r.id_indicador
     WHERE r.id_periodo = $1
     ORDER BY i.ordem, i.nome`,
    [idPeriodo],
  );

  const grupos = [];
  for (const ind of indicadores) {
    const { rows } = await pool.query(
      `SELECT r.id_ranking, r.posicao, r.valor_numero, r.valor_texto, r.pontos, r.classe, r.destaque, r.critico,
              r.nome_gestor, r.id_gestor, r.nome_loja_planilha, r.ordem_linha,
              l.id_loja, l.name AS nome_loja, l.bk_number,
              u.nome AS gestor_cadastro
       FROM metas_rankings r
       LEFT JOIN lojas l ON l.id_loja = r.id_loja
       LEFT JOIN usuarios u ON u.id_usuario = r.id_gestor
       WHERE r.id_periodo = $1 AND r.id_indicador = $2
       ORDER BY COALESCE(r.ordem_linha, 9999), COALESCE(r.posicao, 9999), r.id_ranking`,
      [idPeriodo, ind.id_indicador],
    );
    grupos.push({
      id_indicador: ind.id_indicador,
      codigo: ind.codigo,
      nome: ind.nome,
      meta_minima: ind.meta_minima != null ? Number(ind.meta_minima) : null,
      linhas: rows.map((row) => ({
        id_ranking: row.id_ranking,
        posicao: row.posicao,
        ordem_linha: row.ordem_linha,
        id_loja: row.id_loja,
        nome_loja: row.nome_loja || row.nome_loja_planilha,
        bk_number: row.bk_number,
        valor_numero: row.valor_numero != null ? Number(row.valor_numero) : null,
        valor_texto: row.valor_texto,
        pontos: row.pontos,
        classe: row.classe,
        destaque: row.destaque,
        critico: row.critico != null ? Number(row.critico) : null,
        nome_gestor: row.nome_gestor || row.gestor_cadastro,
      })),
    });
  }
  return grupos;
}

/** Colaboradores e valores unitários fixos da aba Prêmios (Saúde / R.E.V.). */
export const PREMIOS_COLABORADORES_PADRAO = [
  { nome: 'Eshely', valor_unitario: 100 },
  { nome: 'Mikaele', valor_unitario: 120 },
  { nome: 'Renato', valor_unitario: 350 },
  { nome: 'Millena', valor_unitario: 100 },
  { nome: 'Laysa', valor_unitario: 50 },
  { nome: 'Ana', valor_unitario: 35 },
  { nome: 'Igor', valor_unitario: 100 },
  { nome: 'Delivery', valor_unitario: 50 },
  { nome: 'Barbara', valor_unitario: 400 },
  { nome: 'Plinio', valor_unitario: 400 },
  { nome: 'Fagno', valor_unitario: 400 },
];

const PREMIOS_NOME_LEGADO = {
  amanda: 'Eshely',
  eshely: 'Eshely',
  mikaele: 'Mikaele',
  renato: 'Renato',
  millena: 'Millena',
  paula: 'Millena',
  laysa: 'Laysa',
  ana: 'Ana',
  igor: 'Igor',
  delivery: 'Delivery',
  andressa: 'Delivery',
  barbara: 'Barbara',
  babara: 'Barbara',
  plinio: 'Plinio',
  fagno: 'Fagno',
};

function normNomePremio(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function calcularPremioValores({ premio_saude, premio_rev, valor_unitario }) {
  const saude = Math.max(0, Number(premio_saude) || 0);
  const rev = Math.max(0, Number(premio_rev) || 0);
  const valor = Number(valor_unitario) || 0;
  return {
    subtotal: saude * valor,
    total: (saude + rev) * valor,
  };
}

function serializarPremio(r) {
  const valor_unitario = r.valor_unitario != null ? Number(r.valor_unitario) : null;
  const calc = calcularPremioValores({
    premio_saude: r.premio_saude,
    premio_rev: r.premio_rev,
    valor_unitario,
  });
  return {
    id_premio: r.id_premio,
    id_usuario: r.id_usuario,
    nome: r.nome,
    premio_saude: r.premio_saude != null ? Number(r.premio_saude) : 0,
    premio_rev: r.premio_rev != null ? Number(r.premio_rev) : 0,
    valor_unitario,
    subtotal: calc.subtotal,
    total: calc.total,
    observacao: r.observacao,
  };
}

/** Garante a lista oficial de colaboradores com valor unitário fixo no período. */
export async function sincronizarPremiosPadrao(idPeriodo) {
  const { rows: existentes } = await pool.query(
    `SELECT id_premio, nome, premio_saude, premio_rev
     FROM metas_premios WHERE id_periodo = $1`,
    [idPeriodo],
  );

  const score = (r) => (Number(r.premio_saude) || 0) + (Number(r.premio_rev) || 0);
  const porCanonico = new Map();
  for (const row of existentes) {
    const chave = normNomePremio(row.nome);
    const canonico =
      PREMIOS_NOME_LEGADO[chave]
      || PREMIOS_COLABORADORES_PADRAO.find((p) => normNomePremio(p.nome) === chave)?.nome;
    if (!canonico) continue;
    const atual = porCanonico.get(canonico);
    if (!atual || score(row) > score(atual)) porCanonico.set(canonico, row);
  }

  const idsManter = [];
  for (const padrao of PREMIOS_COLABORADORES_PADRAO) {
    const herdado = porCanonico.get(padrao.nome);
    const saude = Number(herdado?.premio_saude) || 0;
    const rev = Number(herdado?.premio_rev) || 0;
    const calc = calcularPremioValores({
      premio_saude: saude,
      premio_rev: rev,
      valor_unitario: padrao.valor_unitario,
    });

    if (herdado) {
      await pool.query(
        `UPDATE metas_premios SET
           nome = $2,
           premio_saude = $3,
           premio_rev = $4,
           valor_unitario = $5,
           subtotal = $6,
           total = $7
         WHERE id_premio = $1`,
        [herdado.id_premio, padrao.nome, saude, rev, padrao.valor_unitario, calc.subtotal, calc.total],
      );
      idsManter.push(herdado.id_premio);
    } else {
      const { rows: inserido } = await pool.query(
        `INSERT INTO metas_premios (id_periodo, nome, premio_saude, premio_rev, valor_unitario, subtotal, total)
         VALUES ($1, $2, 0, 0, $3, 0, 0)
         RETURNING id_premio`,
        [idPeriodo, padrao.nome, padrao.valor_unitario],
      );
      idsManter.push(inserido[0].id_premio);
    }
  }

  await pool.query(
    `DELETE FROM metas_premios
     WHERE id_periodo = $1
       AND NOT (id_premio = ANY($2::int[]))`,
    [idPeriodo, idsManter],
  );
}

async function carregarPremios(idPeriodo) {
  await sincronizarPremiosPadrao(idPeriodo);
  const { rows } = await pool.query(
    `SELECT p.*, u.nome AS nome_usuario
     FROM metas_premios p
     LEFT JOIN usuarios u ON u.id_usuario = p.id_usuario
     WHERE p.id_periodo = $1
     ORDER BY array_position($2::text[], p.nome), p.nome`,
    [idPeriodo, PREMIOS_COLABORADORES_PADRAO.map((p) => p.nome)],
  );
  return rows.map(serializarPremio);
}

export async function salvarPremioMetas(user, { id_premio, premio_saude, premio_rev }) {
  if (!podeGerenciarMetas(user)) throw new Error('Sem permissão para editar');
  if (!id_premio) throw new Error('id_premio obrigatório');

  const { rows: atual } = await pool.query(
    `SELECT id_premio, premio_saude, premio_rev, valor_unitario FROM metas_premios WHERE id_premio = $1`,
    [id_premio],
  );
  if (!atual[0]) throw new Error('Prêmio não encontrado');

  const cur = atual[0];
  const saude = premio_saude !== undefined ? premio_saude : cur.premio_saude;
  const rev = premio_rev !== undefined ? premio_rev : cur.premio_rev;
  const calc = calcularPremioValores({
    premio_saude: saude,
    premio_rev: rev,
    valor_unitario: cur.valor_unitario,
  });

  const { rows } = await pool.query(
    `UPDATE metas_premios SET
       premio_saude = $2,
       premio_rev = $3,
       subtotal = $4,
       total = $5
     WHERE id_premio = $1
     RETURNING *`,
    [id_premio, saude ?? 0, rev ?? 0, calc.subtotal, calc.total],
  );
  return serializarPremio(rows[0]);
}

export async function carregarMetasPeriodo(idPeriodo, user) {
  if (!podeVerMetas(user)) throw new Error('Sem permissão');

  const { rows } = await pool.query(
    `SELECT id_periodo, ano, mes, titulo, observacao
     FROM metas_periodos WHERE id_periodo = $1`,
    [idPeriodo],
  );
  if (!rows[0]) throw new Error('Período não encontrado');

  const [paineis, rankings, premios] = await Promise.all([
    carregarPaineis(idPeriodo),
    carregarRankings(idPeriodo),
    carregarPremios(idPeriodo),
  ]);

  return {
    periodo: rows[0],
    pode_editar: podeGerenciarMetas(user),
    paineis,
    rankings,
    premios,
  };
}

export async function salvarRealizadoMetas(user, { id_painel, id_indicador, id_loja, valor_texto, valor_numero, atingiu, pontos_obtidos }) {
  if (!podeGerenciarMetas(user)) throw new Error('Sem permissão para editar');

  const { rows: painel } = await pool.query(
    `SELECT id_periodo FROM metas_paineis WHERE id_painel = $1`,
    [id_painel],
  );
  if (!painel[0]) throw new Error('Painel não encontrado');

  const { rows } = await pool.query(
    `INSERT INTO metas_realizados (id_periodo, id_painel, id_indicador, id_loja, valor_texto, valor_numero, atingiu, pontos_obtidos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id_painel, id_indicador, id_loja) DO UPDATE SET
       valor_texto = EXCLUDED.valor_texto,
       valor_numero = EXCLUDED.valor_numero,
       atingiu = EXCLUDED.atingiu,
       pontos_obtidos = EXCLUDED.pontos_obtidos
     RETURNING *`,
    [
      painel[0].id_periodo,
      id_painel,
      id_indicador,
      id_loja || null,
      valor_texto ?? null,
      valor_numero ?? null,
      atingiu ?? null,
      pontos_obtidos ?? null,
    ],
  );
  return rows[0];
}

export async function salvarRankingMetas(user, { id_ranking, valor_numero, valor_texto, pontos, classe, destaque, critico }) {
  if (!podeGerenciarMetas(user)) throw new Error('Sem permissão para editar');

  if (!id_ranking) throw new Error('id_ranking obrigatório');

  const { rows: atual } = await pool.query(
    `SELECT id_ranking, valor_numero, valor_texto, pontos, classe, destaque, critico FROM metas_rankings WHERE id_ranking = $1`,
    [id_ranking],
  );
  if (!atual[0]) throw new Error('Registro de ranking não encontrado');

  const cur = atual[0];
  const destaqueFinal = destaque !== undefined ? destaque : cur.destaque;
  const pontosFinal =
    destaqueFinal != null && String(destaqueFinal).toUpperCase() === 'DEMANDA'
      ? null
      : pontos !== undefined
        ? pontos
        : cur.pontos;

  const { rows } = await pool.query(
    `UPDATE metas_rankings SET
       valor_numero = $2,
       valor_texto = $3,
       pontos = $4,
       classe = $5,
       destaque = $6,
       critico = $7
     WHERE id_ranking = $1
     RETURNING id_ranking, valor_numero, valor_texto, pontos, classe, destaque, critico`,
    [
      id_ranking,
      valor_numero !== undefined ? valor_numero : cur.valor_numero,
      valor_texto !== undefined ? valor_texto : cur.valor_texto,
      pontosFinal,
      classe !== undefined ? classe : cur.classe,
      destaqueFinal,
      critico !== undefined ? critico : cur.critico,
    ],
  );
  return rows[0];
}
