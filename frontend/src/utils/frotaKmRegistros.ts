import type {
  FrotaAbastecimentoPortal,
  FrotaAssuncao,
  FrotaManutencaoPortal,
} from '../api/client';
import { rotuloMarcaModelo } from '../constants/frotaVeiculo';

export type VeiculoResumoKm = {
  marca?: string | null;
  modelo?: string | null;
};

export type RegistroKmFrota = {
  id: string;
  tipo: 'assuncao' | 'abastecimento' | 'manutencao';
  data: string;
  km: number | null;
  detalhe: string;
  usuario: string;
  placa: string;
  veiculo: string;
  id_veiculo: number;
};

export const ROTULO_TIPO_KM: Record<RegistroKmFrota['tipo'], string> = {
  assuncao: 'Atribuição',
  abastecimento: 'Abastecimento',
  manutencao: 'Manutenção',
};

function rotuloVeiculo(idVeiculo: number, veiculosPorId?: Map<number, VeiculoResumoKm>) {
  const v = veiculosPorId?.get(idVeiculo);
  return v ? rotuloMarcaModelo(v.marca, v.modelo) : '—';
}

function pushAssuncao(
  lista: RegistroKmFrota[],
  a: FrotaAssuncao,
  veiculosPorId?: Map<number, VeiculoResumoKm>,
) {
  const veiculo = rotuloVeiculo(a.id_veiculo, veiculosPorId);
  lista.push({
    id: `a-${a.id_assuncao}-inicio`,
    tipo: 'assuncao',
    data: a.data_inicio,
    km: a.km_inicio,
    detalhe: a.data_fim ? 'Veículo atribuído' : 'Atribuição em andamento',
    usuario: a.nome_usuario,
    placa: a.placa,
    veiculo,
    id_veiculo: a.id_veiculo,
  });

  if (a.data_fim) {
    lista.push({
      id: `a-${a.id_assuncao}-fim`,
      tipo: 'assuncao',
      data: a.data_fim,
      km: a.km_fim,
      detalhe: 'Atribuição encerrada - carro devolvido',
      usuario: a.nome_usuario,
      placa: a.placa,
      veiculo,
      id_veiculo: a.id_veiculo,
    });
  }
}

export function montarRegistrosKm(
  assuncoes: FrotaAssuncao[],
  abastecimentos: FrotaAbastecimentoPortal[],
  manutencoes: FrotaManutencaoPortal[],
  idVeiculo?: number,
  veiculosPorId?: Map<number, VeiculoResumoKm>,
): RegistroKmFrota[] {
  const lista: RegistroKmFrota[] = [];

  for (const a of assuncoes) {
    if (idVeiculo != null && a.id_veiculo !== idVeiculo) continue;
    pushAssuncao(lista, a, veiculosPorId);
  }

  for (const a of abastecimentos) {
    if (idVeiculo != null && a.id_veiculo !== idVeiculo) continue;
    lista.push({
      id: `b-${a.id_abastecimento}`,
      tipo: 'abastecimento',
      data: a.data_abastecimento,
      km: a.km_atual,
      detalhe: `R$ ${a.valor_abastecido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      usuario: a.nome_usuario,
      placa: a.placa,
      veiculo: rotuloVeiculo(a.id_veiculo, veiculosPorId),
      id_veiculo: a.id_veiculo,
    });
  }

  for (const m of manutencoes) {
    if (idVeiculo != null && m.id_veiculo !== idVeiculo) continue;
    lista.push({
      id: `m-${m.id_manutencao}`,
      tipo: 'manutencao',
      data: m.data_manutencao,
      km: m.km,
      detalhe: m.descricao,
      usuario: m.nome_usuario,
      placa: m.placa,
      veiculo: rotuloVeiculo(m.id_veiculo, veiculosPorId),
      id_veiculo: m.id_veiculo,
    });
  }

  return lista.sort((x, y) => new Date(y.data).getTime() - new Date(x.data).getTime());
}
