import { pool } from '../db.js';

/** Referência para interpretar leitura absoluta ou KM rodado desde a última base. */
export function kmBaseVeiculo(veiculo) {
  const ini = Number(veiculo?.km_inicial);
  const atual = Number(veiculo?.km_atual);
  return Math.max(Number.isFinite(ini) ? ini : 0, Number.isFinite(atual) ? atual : 0);
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
