function inicioPeriodoBrasilia(dataStr) {
  return `${dataStr}T00:00:00-03:00`;
}

function fimPeriodoBrasilia(dataStr) {
  return `${dataStr}T23:59:59.999-03:00`;
}

export async function listarAssuncoesVeiculoPeriodo(pool, idVeiculo, dataInicio, dataFim) {
  const inicio = dataInicio || dataFim;
  const fim = dataFim || dataInicio;
  const { rows } = await pool.query(
    `SELECT a.id_assuncao, a.id_usuario, a.data_inicio, a.data_fim, u.nome AS nome_tecnico
     FROM frota_assuncoes a
     JOIN usuarios u ON u.id_usuario = a.id_usuario
     WHERE a.id_veiculo = $1
       AND a.data_inicio <= $3::timestamptz
       AND (a.data_fim IS NULL OR a.data_fim >= $2::timestamptz)
     ORDER BY a.data_inicio ASC`,
    [idVeiculo, inicioPeriodoBrasilia(inicio), fimPeriodoBrasilia(fim)],
  );
  return rows;
}

export function tecnicoNaData(assuncoes, atualizadoEm) {
  if (!atualizadoEm || !assuncoes?.length) return null;
  const t = new Date(atualizadoEm).getTime();
  if (!Number.isFinite(t)) return null;

  for (const a of assuncoes) {
    const ini = new Date(a.data_inicio).getTime();
    const fim = a.data_fim ? new Date(a.data_fim).getTime() : Number.POSITIVE_INFINITY;
    if (t >= ini && t <= fim) {
      return { id_usuario: a.id_usuario, nome_tecnico: a.nome_tecnico };
    }
  }
  return null;
}

export function enriquecerComTecnico(item, assuncoes) {
  const tecnico = tecnicoNaData(assuncoes, item.atualizado_em);
  return {
    ...item,
    id_usuario_tecnico: tecnico?.id_usuario ?? null,
    nome_tecnico: tecnico?.nome_tecnico ?? null,
  };
}

export function enriquecerRegistrosVelocidade(registros = [], assuncoes = []) {
  return registros.map((r) => enriquecerComTecnico(r, assuncoes));
}

export function enriquecerRotasComTecnicoExcesso(rotas = [], limiteKmh, assuncoes = []) {
  const limite = Number(limiteKmh) || 80;
  return rotas.map((rota) => {
    const primeiroExcesso = (rota.pontos ?? []).find((p) => (Number(p.velocidade) || 0) > limite);
    const tecnico = primeiroExcesso ? tecnicoNaData(assuncoes, primeiroExcesso.atualizado_em) : null;
    return {
      ...rota,
      id_usuario_tecnico: tecnico?.id_usuario ?? null,
      nome_tecnico: tecnico?.nome_tecnico ?? null,
    };
  });
}
