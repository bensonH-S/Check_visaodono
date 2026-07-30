/**
 * Pontuação Sim/Não do checklist.
 * Em perguntas com sim_indica_problema, "Não" é a resposta correta (100 pts).
 */

export const SQL_PONTUACAO_RESPOSTA = `
  CASE
    WHEN p.tipo_resposta IN ('estrelas', 'estrelas_foto') AND r.nota_estrelas IS NOT NULL
      THEN (r.nota_estrelas::numeric / 5.0) * 100
    WHEN r.resposta = 'N/A' THEN NULL
    WHEN COALESCE(p.sim_indica_problema, FALSE) AND r.resposta = 'Não' THEN 100
    WHEN COALESCE(p.sim_indica_problema, FALSE) AND r.resposta = 'Sim' THEN 0
    WHEN r.resposta = 'Sim' THEN 100
    WHEN r.resposta = 'Não' THEN 0
    ELSE NULL
  END
`;

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

/** Preferir a flag do banco; fallback por texto para respostas antigas. */
export function perguntaSimIndicaProblema(pergunta) {
  if (pergunta?.sim_indica_problema === true) return true;
  if (pergunta?.sim_indica_problema === false) return false;
  return textoIndicaSimRuim(pergunta?.texto);
}
