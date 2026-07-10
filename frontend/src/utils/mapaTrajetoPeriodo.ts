import dayjs from 'dayjs';

export function periodoTrajetoCompleto(inicio: string, fim: string) {
  return !!(inicio && fim);
}

/** Usuário escolheu a data inicial e ainda vai escolher a final. */
export function selecionandoPeriodoTrajeto(inicio: string, fim: string) {
  return !!inicio && !fim;
}

/** Esconde chips de região individual — só “Todas”. */
export function ocultarRegioesIndividuaisTrajeto(inicio: string, fim: string) {
  if (selecionandoPeriodoTrajeto(inicio, fim)) return true;
  return modoHistoricoTrajeto(inicio, fim);
}

/** Período concluído e diferente de “só hoje” — sem veículos ao vivo no mapa. */
export function modoHistoricoTrajeto(inicio: string, fim: string) {
  if (!periodoTrajetoCompleto(inicio, fim)) return false;
  const hoje = dayjs().format('YYYY-MM-DD');
  return inicio !== hoje || fim !== hoje;
}

/** Trajeto filtrado é referente ao dia de hoje (ao vivo ou rota de hoje). */
export function trajetoReferenteHoje(inicio: string, fim: string) {
  if (!periodoTrajetoCompleto(inicio, fim)) return false;
  const hoje = dayjs().format('YYYY-MM-DD');
  return inicio === hoje && fim === hoje;
}
