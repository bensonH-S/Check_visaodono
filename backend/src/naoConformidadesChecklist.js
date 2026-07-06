/** Gera NCs automaticamente ao finalizar checklist. */

export const SQL_NC_CHECKLIST_FINALIZADO = `
  INNER JOIN visitas v ON v.id_visita = nc.id_visita AND v.status = 'Finalizada'
`;

export const NOTA_MINIMA_NC = 80;
const ESTRELAS_NC_LIMITE = 2;
const ESTRELAS_CRITICA_LIMITE = 3;

const PADROES_SIM_INDICA_PROBLEMA = [
  /foi encontrad/i,
  /há presença/i,
  /ha presenca/i,
  /evidência de/i,
  /evidencia de/i,
  /possui alguma obstru/i,
  /existe vazamento/i,
  /há vazamento/i,
  /ha vazamento/i,
];

export function textoIndicaSimRuim(texto) {
  const t = String(texto || '');
  return PADROES_SIM_INDICA_PROBLEMA.some((re) => re.test(t));
}

function observacaoIndicaNaoSeAplica(obs) {
  if (!obs?.trim()) return false;
  return /n[aã]o\s+se\s+aplica|n[aã]o\s+aplica|sem\s+m[aá]quina|j[aá]\s+estamos\s+sem/i.test(obs);
}

export function respostaIndicaNc(pergunta, resposta) {
  if (resposta.resposta === 'N/A') return false;
  if (observacaoIndicaNaoSeAplica(resposta.observacao)) return false;

  const tipo = pergunta.tipo_resposta;
  if (tipo === 'sim_nao' || tipo === 'sim_nao_foto') {
    if (!resposta.resposta) return false;
    if (textoIndicaSimRuim(pergunta.texto)) return resposta.resposta === 'Sim';
    return resposta.resposta === 'Não';
  }
  if (tipo === 'estrelas' || tipo === 'estrelas_foto') {
    const nota = resposta.nota_estrelas;
    if (nota == null) return false;
    if (pergunta.critica) return nota <= ESTRELAS_CRITICA_LIMITE;
    return nota <= ESTRELAS_NC_LIMITE;
  }
  return false;
}

function montarDescricaoItem(pergunta, resposta) {
  const codigo = pergunta.codigo ? `Q${pergunta.codigo}` : `P${pergunta.id_pergunta}`;
  let desc = `[${codigo}] ${pergunta.texto}`;
  if (resposta.observacao?.trim()) {
    desc += ` — Obs.: ${resposta.observacao.trim()}`;
  }
  return desc;
}

function gravidadeItem(pergunta, resposta) {
  if (pergunta.critica) return 'Crítica';
  if (
    (pergunta.tipo_resposta === 'estrelas' || pergunta.tipo_resposta === 'estrelas_foto') &&
    resposta.nota_estrelas != null &&
    resposta.nota_estrelas <= ESTRELAS_NC_LIMITE
  ) {
    return 'Crítica';
  }
  return 'Moderada';
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} idVisita
 * @returns {Promise<{ criadas: number, ignorada?: boolean }>}
 */
export async function gerarNcsFromVisita(client, idVisita) {
  const visitaRes = await client.query(
    `SELECT id_visita, id_loja, nota_final, status
     FROM visitas WHERE id_visita = $1`,
    [idVisita],
  );
  const visita = visitaRes.rows[0];
  if (!visita) return { criadas: 0 };

  const existentes = await client.query(
    `SELECT COUNT(*)::int AS total FROM nao_conformidades WHERE id_visita = $1`,
    [idVisita],
  );
  if (existentes.rows[0].total > 0) {
    return { criadas: 0, ignorada: true };
  }

  let criadas = 0;
  const nota = visita.nota_final != null ? Number(visita.nota_final) : null;

  if (nota != null && !Number.isNaN(nota) && nota < NOTA_MINIMA_NC) {
    await client.query(
      `INSERT INTO nao_conformidades
         (id_loja, id_visita, area, descricao, gravidade, status)
       VALUES ($1, $2, $3, $4, $5::gravidade_nc, 'Em aberto')`,
      [
        visita.id_loja,
        idVisita,
        'Resultado geral',
        `Nota abaixo do mínimo (${nota.toFixed(0)}% — meta ${NOTA_MINIMA_NC}%)`,
        nota < 60 ? 'Crítica' : 'Moderada',
      ],
    );
    criadas += 1;
  }

  const respostas = await client.query(
    `SELECT r.resposta, r.nota_estrelas, r.observacao,
            p.id_pergunta, p.codigo, p.texto, p.tipo_resposta, p.critica,
            c.nome AS categoria
     FROM respostas r
     JOIN perguntas p ON p.id_pergunta = r.id_pergunta
     JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
     WHERE r.id_visita = $1`,
    [idVisita],
  );

  for (const row of respostas.rows) {
    if (!respostaIndicaNc(row, row)) continue;
    await client.query(
      `INSERT INTO nao_conformidades
         (id_loja, id_visita, area, descricao, gravidade, status)
       VALUES ($1, $2, $3, $4, $5::gravidade_nc, 'Em aberto')`,
      [
        visita.id_loja,
        idVisita,
        row.categoria?.slice(0, 80) || 'Checklist',
        montarDescricaoItem(row, row),
        gravidadeItem(row, row),
      ],
    );
    criadas += 1;
  }

  return { criadas };
}
