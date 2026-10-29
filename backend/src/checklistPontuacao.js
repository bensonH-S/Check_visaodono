/**
 * Pontuação Sim/Não do checklist.
 * Em perguntas de achado ("foi encontrada barata?", "produto vencido foi servido?"),
 * Sim = problema (0 pts e NC) e Não = conforme (100 pts).
 *
 * A flag sim_indica_problema força esse comportamento. O texto também, para perguntas
 * antigas que ficaram com a flag desligada. Ao incluir um padrão novo, atualize
 * backend/migrations/213_checklist_sim_nao_achado.sql (fn_texto_sim_indica_problema).
 */

export const PADROES_SIM_INDICA_PROBLEMA_SQL = [
  'foi encontrad',
  'h[aá] presença',
  'ha presenca',
  'evid[eê]ncia de',
  'evidencia de',
  'possui alguma obstru',
  'existe vazamento',
  'h[aá] vazamento',
  'ha vazamento',
  'foram observad',
  'foi observad',
  'foi identificad',
  'foram identificad',
  'evidenciou',
  'foi evidenc',
  'foi servid',
  'h[aá] equipamentos',
  'ha equipamentos',
  'h[aá] danos',
  'ha danos',
  'h[aá] risco',
  'ha risco',
  'h[aá] desperd',
  'ha desperd',
  'existe algum equipamento',
];

const PADROES_SIM_INDICA_PROBLEMA = PADROES_SIM_INDICA_PROBLEMA_SQL.map(
  (fonte) => new RegExp(fonte, 'i'),
);

export function sqlPerguntaSimIndicaProblema(alias = 'p') {
  const texto = PADROES_SIM_INDICA_PROBLEMA_SQL
    .map((fonte) => `COALESCE(${alias}.texto ~* '${fonte.replace(/'/g, "''")}', FALSE)`)
    .join(' OR ');
  return `(COALESCE(${alias}.sim_indica_problema, FALSE) OR ${texto})`;
}

const SIM_RUIM = sqlPerguntaSimIndicaProblema('p');

export const SQL_PONTUACAO_RESPOSTA = `
  CASE
    WHEN p.tipo_resposta IN ('estrelas', 'estrelas_foto') AND r.nota_estrelas IS NOT NULL
      THEN (r.nota_estrelas::numeric / 5.0) * 100
    WHEN r.resposta = 'N/A' THEN NULL
    WHEN ${SIM_RUIM} AND r.resposta = 'Não' THEN 100
    WHEN ${SIM_RUIM} AND r.resposta = 'Sim' THEN 0
    WHEN r.resposta = 'Sim' THEN 100
    WHEN r.resposta = 'Não' THEN 0
    ELSE NULL
  END
`;

export function textoIndicaSimRuim(texto) {
  const t = String(texto || '');
  return PADROES_SIM_INDICA_PROBLEMA.some((re) => re.test(t));
}

/** Flag do banco ou texto de achado. Flag falsa não anula um texto que já é achado. */
export function perguntaSimIndicaProblema(pergunta) {
  if (pergunta?.sim_indica_problema === true) return true;
  return textoIndicaSimRuim(pergunta?.texto);
}
