import { pool } from '../db.js';
import {
  calcularKmPercorridoGps,
  combinarVeiculosComRastreamento,
  fulltrackRastreamentoAtivo,
  historicoVeiculoFulltrack,
} from './fulltrackFleet.js';

/** Referência para interpretar leitura absoluta ou KM rodado desde a última base. */
export function kmBaseVeiculo(veiculo) {
  const ini = Number(veiculo?.km_inicial);
  const atual = Number(veiculo?.km_atual);
  return Math.max(Number.isFinite(ini) ? ini : 0, Number.isFinite(atual) ? atual : 0);
}

export function kmRodadosVeiculo(veiculo) {
  const ini = Number(veiculo?.km_inicial);
  const atual = Number(veiculo?.km_atual);
  const kmIni = Number.isFinite(ini) ? ini : 0;
  const kmAtual = Number.isFinite(atual) ? atual : kmIni;
  return Math.max(0, kmAtual - kmIni);
}

export function enriquecerKmVeiculo(veiculo) {
  if (!veiculo) return veiculo;
  const kmInicial = Number.isFinite(Number(veiculo.km_inicial)) ? Number(veiculo.km_inicial) : 0;
  const kmAtual = Number.isFinite(Number(veiculo.km_atual)) ? Number(veiculo.km_atual) : kmInicial;
  const kmAssuncao =
    veiculo.km_assuncao != null && Number.isFinite(Number(veiculo.km_assuncao))
      ? Number(veiculo.km_assuncao)
      : null;
  const proximaKm =
    veiculo.proxima_manutencao_km != null && Number.isFinite(Number(veiculo.proxima_manutencao_km))
      ? Number(veiculo.proxima_manutencao_km)
      : null;
  return {
    ...veiculo,
    km_inicial: kmInicial,
    km_atual: Math.max(kmInicial, kmAtual),
    km_rodados: Math.max(0, kmAtual - kmInicial),
    km_assuncao: kmAssuncao,
    proxima_manutencao_km: proximaKm,
  };
}

/**
 * Se o valor informado for menor que a base, trata como KM rodado e soma à base.
 * Caso contrário, usa o hodômetro absoluto informado.
 */
export function resolverKmOdometro(kmInformado, kmReferencia) {
  const km = Number(kmInformado);
  const ref = Math.max(0, Number(kmReferencia) || 0);
  if (!Number.isFinite(km) || km < 0) return null;
  if (km >= ref) return Math.round(km);
  return Math.round(ref + km);
}

/** Atualiza km_atual = maior leitura entre KM inicial e registros de uso. */
export async function sincronizarKmAtualVeiculo(idVeiculo, client = pool) {
  const q = client.query.bind(client);
  const { rows } = await q(
    `UPDATE frota_veiculos v
     SET km_atual = GREATEST(
       COALESCE(v.km_inicial, 0),
       COALESCE(v.km_atual, 0),
       COALESCE((SELECT MAX(a.km_atual) FROM frota_abastecimentos a WHERE a.id_veiculo = v.id_veiculo), 0),
       COALESCE((SELECT MAX(m.km) FROM frota_manutencoes_veiculo m WHERE m.id_veiculo = v.id_veiculo), 0),
       COALESCE((
         SELECT MAX(GREATEST(COALESCE(a2.km_inicio, 0), COALESCE(a2.km_fim, 0)))
         FROM frota_assuncoes a2
         WHERE a2.id_veiculo = v.id_veiculo
       ), 0)
     ),
     updated_at = NOW()
     WHERE v.id_veiculo = $1
     RETURNING km_atual, km_inicial`,
    [idVeiculo],
  );
  return rows[0] || null;
}

/**
 * KM atual = KM informado na atribuição + KM rodado no GPS desde então.
 * O odômetro absoluto do rastreador nem sempre bate com o painel do carro.
 */
export async function sincronizarKmAtualComGpsDesdeAssuncao(client = pool) {
  if (!fulltrackRastreamentoAtivo()) return;

  const q = client.query.bind(client);
  const { rows } = await q(
    `SELECT v.id_veiculo, v.placa, v.km_inicial, v.km_atual, a.km_inicio, a.data_inicio
     FROM frota_veiculos v
     JOIN frota_assuncoes a ON a.id_veiculo = v.id_veiculo AND a.data_fim IS NULL
     WHERE v.ativo = TRUE
       AND v.id_usuario_responsavel IS NOT NULL
       AND a.km_inicio IS NOT NULL
       AND a.data_inicio IS NOT NULL`,
  );
  if (!rows.length) return;

  const comGps = await combinarVeiculosComRastreamento(rows);
  const porId = new Map(comGps.map((g) => [g.id_veiculo, g]));
  const agoraUnix = Math.floor(Date.now() / 1000);
  const maxJanelaSeg = 30 * 24 * 60 * 60;

  await Promise.all(
    rows.map(async (v) => {
      const g = porId.get(v.id_veiculo);
      if (!g?.id_rastreamento) return;

      const inicioMs = new Date(v.data_inicio).getTime();
      if (!Number.isFinite(inicioMs)) return;
      const beginUnix = Math.max(Math.floor(inicioMs / 1000), agoraUnix - maxJanelaSeg);

      try {
        const pontos = await historicoVeiculoFulltrack(g.id_rastreamento, beginUnix, agoraUnix);
        const kmGps = calcularKmPercorridoGps(pontos);
        if (!Number.isFinite(kmGps) || kmGps < 0) return;

        // Se km_inicio parece odômetro real (>= km_inicial), usa ele; senão
        // corrige digitação relativa/baixa (ex.: "10") com a base do cadastro.
        const kmInicio = Number(v.km_inicio) || 0;
        const kmInicial = Number(v.km_inicial) || 0;
        const kmAtualDb = Number(v.km_atual) || 0;
        const baseAbs =
          kmInicio >= kmInicial && kmInicio > 0
            ? kmInicio
            : Math.max(kmInicial, kmAtualDb, kmInicio);
        const kmNovo = Math.round(baseAbs + kmGps);
        if (kmNovo <= 0) return;

        await q(
          `UPDATE frota_veiculos
           SET km_atual = GREATEST(COALESCE(km_atual, 0), COALESCE(km_inicial, 0), $2::int),
               updated_at = NOW()
           WHERE id_veiculo = $1`,
          [v.id_veiculo, kmNovo],
        );
      } catch {
        /* ignora falha pontual do rastreador */
      }
    }),
  );
}
