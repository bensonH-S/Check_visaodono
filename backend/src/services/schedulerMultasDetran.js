/**
 * Scheduler: consulta Infosimples DETRAN-DF 1x/dia às 17:00 (America/Sao_Paulo)
 * e grava o resultado em frota_multas_detran para a tela do portal.
 */
import { pool } from '../db.js';
import { logger } from '../logger.js';
import {
  consultarIpvaSefazDf,
  consultarLicenciamentoDetranDf,
  consultarMultasDetranDf,
  fonteMultasConfigurada,
} from './detranDfMultas.js';

const HORA_SYNC = (process.env.MULTAS_DETRAN_SYNC_HORA || '17:00').slice(0, 5);
const DELAY_ENTRE_VEICULOS_MS = Number(process.env.MULTAS_DETRAN_SYNC_DELAY_MS || 800);

let timer = null;
let rodando = false;
let rodandoDebitos = false;

function agoraSP() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    dia: `${parts.year}-${parts.month}-${parts.day}`,
    hm: `${parts.hour}:${parts.minute}`,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Já existe sync ok/parcial/erro/rodando para o dia (SP)? Evita reconsultar e gastar saldo. */
async function syncDoDiaExiste(dataRef) {
  const { rows } = await pool.query(
    `SELECT id_sync, status FROM frota_multas_detran_sync
     WHERE data_ref = $1::date AND status IN ('ok', 'parcial', 'erro', 'rodando')
     ORDER BY id_sync DESC LIMIT 1`,
    [dataRef],
  );
  return rows[0] || null;
}

/**
 * Executa a varredura Infosimples e substitui o cache.
 * @param {{ forcar?: boolean }} opts
 */
export async function executarSyncMultasDetran(opts = {}) {
  if (rodando) {
    return { ok: false, motivo: 'ja_rodando' };
  }
  if (!fonteMultasConfigurada()) {
    logger.warn('detran-df', 'Sync ignorado: nenhuma fonte de multas configurada (INFOSIMPLES_TOKEN / DETRAN_DF_USER_KEY)');
    return { ok: false, motivo: 'sem_config' };
  }

  const { dia } = agoraSP();
  if (!opts.forcar) {
    const existente = await syncDoDiaExiste(dia);
    if (existente) {
      if (existente.status === 'rodando') {
        return { ok: false, motivo: 'ja_rodando', id_sync: existente.id_sync };
      }
      logger.info('detran-df', `Sync do dia ${dia} já existe (id=${existente.id_sync}) — não gasta saldo`);
      return { ok: true, motivo: 'ja_existe', id_sync: existente.id_sync, data_ref: dia };
    }
  }

  rodando = true;
  let idSync = null;
  const avisos = [];
  let fonte = 'infosimples';
  let qtdMultas = 0;

  try {
    let queryVeiculos = `SELECT id_veiculo, placa, renavam, modelo
       FROM frota_veiculos
       WHERE ativo = TRUE AND renavam IS NOT NULL AND BTRIM(renavam) <> ''`;
    const params = [];
    if (Array.isArray(opts.veiculoIds) && opts.veiculoIds.length > 0) {
      queryVeiculos += ` AND id_veiculo = ANY($1::int[])`;
      params.push(opts.veiculoIds);
    }
    queryVeiculos += ` ORDER BY placa LIMIT 120`;

    const { rows: veiculos } = await pool.query(queryVeiculos, params);

    const ins = await pool.query(
      `INSERT INTO frota_multas_detran_sync (data_ref, status, fonte, qtd_veiculos)
       VALUES ($1::date, 'rodando', $2, $3)
       ON CONFLICT (data_ref) DO UPDATE
         SET iniciado_em = NOW(),
             finalizado_em = NULL,
             status = 'rodando',
             fonte = EXCLUDED.fonte,
             qtd_veiculos = EXCLUDED.qtd_veiculos,
             qtd_multas = 0,
             avisos = '[]'::jsonb
       RETURNING id_sync`,
      [dia, fonte, veiculos.length],
    );
    idSync = ins.rows[0].id_sync;

    // Obtém todos os autos de infração já existentes para não duplicá-los
    const { rows: existentes } = await pool.query(`SELECT auto FROM frota_multas_detran`);
    const autosExistentes = new Set(existentes.map((r) => r.auto).filter(Boolean));

    const novas = [];
    for (let i = 0; i < veiculos.length; i++) {
      const v = veiculos[i];
      try {
        const r = await consultarMultasDetranDf({ placa: v.placa, renavam: v.renavam });
        fonte = r.fonte || fonte;
        for (const m of r.multas) {
          if (autosExistentes.has(m.auto)) {
            // Atualiza campos enriquecidos sem alterar status/valor já tratados no portal
            await pool.query(
              `UPDATE frota_multas_detran
               SET hora_multa = COALESCE($2, hora_multa),
                   natureza = COALESCE($3, natureza),
                   velocidade_aferida = COALESCE($4, velocidade_aferida),
                   velocidade_permitida = COALESCE($5, velocidade_permitida),
                   pontos = COALESCE($6, pontos),
                   orgao = COALESCE($7, orgao),
                   local_infracao = COALESCE($8, local_infracao),
                   descricao = COALESCE($9, descricao),
                   modelo = COALESCE($10, modelo),
                   responsavel_infracao = COALESCE($11, responsavel_infracao),
                   data_notificacao_autuacao = COALESCE($12::date, data_notificacao_autuacao)
               WHERE auto = $1`,
              [
                m.auto,
                m.hora_infracao,
                m.natureza,
                m.velocidade_aferida,
                m.velocidade_permitida,
                m.pontos,
                m.orgao,
                m.local,
                m.descricao,
                v.modelo || null,
                m.responsavel_infracao,
                m.data_notificacao_autuacao,
              ],
            );
            continue;
          }
          novas.push([
            idSync,
            v.id_veiculo,
            v.placa,
            v.modelo || null,
            m.auto,
            m.descricao,
            m.local,
            m.valor,
            m.valor_desconto,
            m.data_infracao,
            m.hora_infracao,
            m.data_vencimento,
            m.orgao,
            m.pontos,
            m.natureza,
            m.velocidade_aferida,
            m.velocidade_permitida,
            m.responsavel_infracao,
            m.data_notificacao_autuacao,
            r.fonte || 'infosimples',
          ]);
          if (m.auto) autosExistentes.add(m.auto);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha na consulta';
        avisos.push(`${v.placa}: ${msg}`);
        logger.warn('detran-df', `sync ${v.placa}: ${msg}`);
      }
      if (i < veiculos.length - 1) await sleep(DELAY_ENTRE_VEICULOS_MS);
    }

    if (novas.length) {
      // insert em lotes
      for (const row of novas) {
        await pool.query(
          `INSERT INTO frota_multas_detran
             (id_sync, id_veiculo, placa, modelo, auto, descricao, local_infracao,
              valor, valor_desconto, data_multa, hora_multa, data_vencimento, orgao, pontos,
              natureza, velocidade_aferida, velocidade_permitida, responsavel_infracao,
              data_notificacao_autuacao, fonte)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12::date,$13,$14,$15,$16,$17,$18,$19::date,$20)`,
          row,
        );
      }
    }
    qtdMultas = novas.length;

    const status = avisos.length && novas.length === 0 && veiculos.length > 0
      ? 'erro'
      : avisos.length
        ? 'parcial'
        : 'ok';

    await pool.query(
      `UPDATE frota_multas_detran_sync
       SET finalizado_em = NOW(),
           status = $2,
           fonte = $3,
           qtd_multas = $4,
           avisos = $5::jsonb
       WHERE id_sync = $1`,
      [idSync, status, fonte, qtdMultas, JSON.stringify(avisos)],
    );

    logger.info(
      'detran-df',
      `Sync multas ${dia} concluído: ${veiculos.length} veículo(s), ${qtdMultas} multa(s), status=${status}`,
    );
    return {
      ok: status !== 'erro',
      id_sync: idSync,
      data_ref: dia,
      qtd_veiculos: veiculos.length,
      qtd_multas: qtdMultas,
      qtd_debitos: 0,
      avisos,
      status,
      fonte,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error('detran-df', `Sync falhou: ${msg}`);
    if (idSync) {
      await pool.query(
        `UPDATE frota_multas_detran_sync
         SET finalizado_em = NOW(), status = 'erro', avisos = $2::jsonb
         WHERE id_sync = $1`,
        [idSync, JSON.stringify([msg])],
      ).catch(() => {});
    }
    return { ok: false, motivo: 'erro', error: msg, id_sync: idSync };
  } finally {
    rodando = false;
  }
}

/**
 * Sync independente de débitos: IPVA (SEFAZ-DF) + Licenciamento (DETRAN-DF).
 * Não altera o cache de multas.
 */
export async function executarSyncDebitosDetran(opts = {}) {
  if (rodandoDebitos) {
    return { ok: false, motivo: 'ja_rodando' };
  }
  if (!fonteMultasConfigurada()) {
    return { ok: false, motivo: 'sem_config' };
  }

  rodandoDebitos = true;
  const avisos = [];
  let qtdIpva = 0;
  let qtdLic = 0;
  let fonte = 'infosimples';

  try {
    let queryVeiculos = `SELECT id_veiculo, placa, renavam, modelo
       FROM frota_veiculos
       WHERE ativo = TRUE AND renavam IS NOT NULL AND BTRIM(renavam) <> ''`;
    const params = [];
    if (Array.isArray(opts.veiculoIds) && opts.veiculoIds.length > 0) {
      queryVeiculos += ` AND id_veiculo = ANY($1::int[])`;
      params.push(opts.veiculoIds);
    }
    queryVeiculos += ` ORDER BY placa LIMIT 120`;

    const { rows: veiculos } = await pool.query(queryVeiculos, params);

    const tiposRaw = Array.isArray(opts.tipos) ? opts.tipos : ['IPVA', 'Licenciamento'];
    const fazerIpva = tiposRaw.includes('IPVA');
    const fazerLic = tiposRaw.includes('Licenciamento');
    if (!fazerIpva && !fazerLic) {
      return { ok: false, motivo: 'sem_tipos', avisos: ['Selecione IPVA e/ou Licenciamento'] };
    }

    const anoAtual = new Date().getFullYear();
    const anosIpvaSel = (
      Array.isArray(opts.anosIpva) && opts.anosIpva.length
        ? opts.anosIpva
        : [anoAtual]
    )
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 2020 && n <= anoAtual);
    const anosIpvaUnicos = [...new Set(anosIpvaSel.length ? anosIpvaSel : [anoAtual])];
    const anosIpvaSet = new Set(anosIpvaUnicos.map(String));
    // Infosimples: anos_anteriores = anoAtual - menorAno; valor 1 costuma retornar 612
    let anosAnterioresIpva = Math.max(0, anoAtual - Math.min(...anosIpvaUnicos));
    if (anosAnterioresIpva === 1) anosAnterioresIpva = 2;

    for (let i = 0; i < veiculos.length; i++) {
      const v = veiculos[i];

      if (fazerIpva) {
        try {
          const ipva = await consultarIpvaSefazDf({
            placa: v.placa,
            renavam: v.renavam,
            anosAnteriores: anosAnterioresIpva,
          });
          fonte = ipva.fonte || fonte;
          const debitosFiltrados = (ipva.debitos || []).filter((d) => {
            if (!d?.ano_referencia) return false;
            return anosIpvaSet.has(String(d.ano_referencia).replace(/\D/g, '').slice(0, 4));
          });

          // Incremental: não apaga o que já existe; só grava o que falta
          const { rows: existentesIpva } = await pool.query(
            `SELECT id_debito_detran, chave_unica, ano_referencia, cota, boleto,
                    valor_total, valor_original, valor_mora, valor_multa, valor_outros, status
             FROM frota_debitos_detran
             WHERE id_veiculo = $1 AND tipo = 'IPVA'`,
            [v.id_veiculo],
          );
          const porChave = new Map(
            existentesIpva.filter((r) => r.chave_unica).map((r) => [r.chave_unica, r]),
          );
          const porAnoCota = new Map(
            existentesIpva.map((r) => [
              `${String(r.ano_referencia || '')}|${String(r.cota || '')}`,
              r,
            ]),
          );

          for (const d of debitosFiltrados) {
            try {
              const chave = d.chave_unica || null;
              const chaveAnoCota = `${String(d.ano_referencia || '')}|${String(d.cota || '')}`;
              const existente = (chave && porChave.get(chave)) || porAnoCota.get(chaveAnoCota) || null;

              if (existente) {
                // Completa só campos vazios; não sobrescreve status manual (ex.: Paga)
                const { rowCount } = await pool.query(
                  `UPDATE frota_debitos_detran SET
                     boleto = COALESCE(boleto, $2),
                     valor_total = COALESCE(valor_total, $3),
                     valor_original = COALESCE(valor_original, $4),
                     valor_mora = COALESCE(valor_mora, $5),
                     valor_multa = COALESCE(valor_multa, $6),
                     valor_outros = COALESCE(valor_outros, $7),
                     razao_social = COALESCE(razao_social, $8),
                     modelo = COALESCE(modelo, $9),
                     chave_unica = COALESCE(chave_unica, $10),
                     fonte = COALESCE(fonte, $11)
                   WHERE id_debito_detran = $1
                     AND (
                       (boleto IS NULL AND $2::text IS NOT NULL) OR
                       (valor_total IS NULL AND $3::numeric IS NOT NULL) OR
                       (valor_original IS NULL AND $4::numeric IS NOT NULL) OR
                       (valor_mora IS NULL AND $5::numeric IS NOT NULL) OR
                       (valor_multa IS NULL AND $6::numeric IS NOT NULL) OR
                       (valor_outros IS NULL AND $7::numeric IS NOT NULL) OR
                       (razao_social IS NULL AND $8::text IS NOT NULL) OR
                       (chave_unica IS NULL AND $10::text IS NOT NULL)
                     )`,
                  [
                    existente.id_debito_detran,
                    d.boleto || null,
                    d.valor_total,
                    d.valor_original,
                    d.valor_mora,
                    d.valor_multa,
                    d.valor_outros,
                    d.razao_social || ipva.razao_social || null,
                    v.modelo || ipva.modelo || null,
                    chave,
                    ipva.fonte || 'infosimples-sefaz-ipva',
                  ],
                );
                if (rowCount) qtdIpva += 1;
                continue;
              }

              await pool.query(
                `INSERT INTO frota_debitos_detran
                   (id_sync, id_veiculo, placa, modelo, tipo, ano_referencia, data_validade,
                    data_vencimento, valor_total, valor_original, valor_pago, valor_multa,
                    valor_mora, valor_outros, valor_diferenca, boleto, status, cota, chave_unica,
                    fonte, razao_social)
                 VALUES (NULL,$1,$2,$3,$4,$5,$6::date,$7::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
                [
                  v.id_veiculo,
                  v.placa,
                  v.modelo || ipva.modelo || null,
                  d.tipo,
                  d.ano_referencia,
                  d.data_validade,
                  d.data_vencimento,
                  d.valor_total,
                  d.valor_original,
                  d.valor_pago,
                  d.valor_multa,
                  d.valor_mora,
                  d.valor_outros,
                  d.valor_diferenca,
                  d.boleto,
                  d.status || 'Em Aberto',
                  d.cota,
                  d.chave_unica,
                  ipva.fonte || 'infosimples-sefaz-ipva',
                  d.razao_social || ipva.razao_social || null,
                ],
              );
              qtdIpva += 1;
              if (chave) porChave.set(chave, { chave_unica: chave });
              porAnoCota.set(chaveAnoCota, { chave_unica: chave });
            } catch (eIns) {
              const msgIns = eIns instanceof Error ? eIns.message : 'Falha ao gravar IPVA';
              if (/duplicate|unique|uq_frota_debitos/i.test(msgIns)) continue;
              avisos.push(`${v.placa} (IPVA): ${msgIns}`);
              logger.warn('detran-df', `insert IPVA ${v.placa}: ${msgIns}`);
            }
          }
        } catch (eIpva) {
          const msg = eIpva instanceof Error ? eIpva.message : 'Falha IPVA';
          avisos.push(`${v.placa} (IPVA): ${msg}`);
          logger.warn('detran-df', `sync IPVA ${v.placa}: ${msg}`);
        }
      }

      if (fazerLic) {
        try {
          const lic = await consultarLicenciamentoDetranDf({ placa: v.placa, renavam: v.renavam });

          const { rows: existentesLic } = await pool.query(
            `SELECT id_debito_detran, chave_unica, ano_referencia, data_vencimento,
                    valor_total, valor_original, status
             FROM frota_debitos_detran
             WHERE id_veiculo = $1 AND tipo = 'Licenciamento'`,
            [v.id_veiculo],
          );
          const porChaveLic = new Map(
            existentesLic.filter((r) => r.chave_unica).map((r) => [r.chave_unica, r]),
          );
          const porAnoVenc = new Map(
            existentesLic.map((r) => [
              `${String(r.ano_referencia || '')}|${String(r.data_vencimento || '').slice(0, 10)}`,
              r,
            ]),
          );

          for (const d of lic.debitos || []) {
            try {
              const chave = d.chave_unica || null;
              const chaveNat = `${String(d.ano_referencia || '')}|${String(d.data_vencimento || '').slice(0, 10)}`;
              const existente = (chave && porChaveLic.get(chave)) || porAnoVenc.get(chaveNat) || null;

              if (existente) {
                const { rowCount } = await pool.query(
                  `UPDATE frota_debitos_detran SET
                     valor_total = COALESCE(valor_total, $2),
                     valor_original = COALESCE(valor_original, $3),
                     valor_pago = COALESCE(valor_pago, $4),
                     valor_multa = COALESCE(valor_multa, $5),
                     valor_mora = COALESCE(valor_mora, $6),
                     valor_outros = COALESCE(valor_outros, $7),
                     data_validade = COALESCE(data_validade, $8::date),
                     data_vencimento = COALESCE(data_vencimento, $9::date),
                     chave_unica = COALESCE(chave_unica, $10),
                     fonte = COALESCE(fonte, $11)
                   WHERE id_debito_detran = $1
                     AND (
                       (valor_total IS NULL AND $2::numeric IS NOT NULL) OR
                       (valor_original IS NULL AND $3::numeric IS NOT NULL) OR
                       (data_validade IS NULL AND $8::date IS NOT NULL) OR
                       (data_vencimento IS NULL AND $9::date IS NOT NULL) OR
                       (chave_unica IS NULL AND $10::text IS NOT NULL)
                     )`,
                  [
                    existente.id_debito_detran,
                    d.valor_total,
                    d.valor_original,
                    d.valor_pago,
                    d.valor_multa,
                    d.valor_mora,
                    d.valor_outros,
                    d.data_validade,
                    d.data_vencimento,
                    chave,
                    lic.fonte || 'infosimples-detran-licenciamento',
                  ],
                );
                if (rowCount) qtdLic += 1;
                continue;
              }

              await pool.query(
                `INSERT INTO frota_debitos_detran
                   (id_sync, id_veiculo, placa, modelo, tipo, ano_referencia, data_validade,
                    data_vencimento, valor_total, valor_original, valor_pago, valor_multa,
                    valor_mora, valor_outros, valor_diferenca, boleto, status, cota, chave_unica,
                    fonte, razao_social)
                 VALUES (NULL,$1,$2,$3,$4,$5,$6::date,$7::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
                [
                  v.id_veiculo,
                  v.placa,
                  v.modelo || null,
                  d.tipo,
                  d.ano_referencia,
                  d.data_validade,
                  d.data_vencimento,
                  d.valor_total,
                  d.valor_original,
                  d.valor_pago,
                  d.valor_multa,
                  d.valor_mora,
                  d.valor_outros,
                  d.valor_diferenca,
                  null,
                  d.status || 'Em Aberto',
                  d.cota,
                  d.chave_unica,
                  lic.fonte || 'infosimples-detran-licenciamento',
                  d.razao_social || null,
                ],
              );
              qtdLic += 1;
              if (chave) porChaveLic.set(chave, { chave_unica: chave });
              porAnoVenc.set(chaveNat, { chave_unica: chave });
            } catch (eIns) {
              const msgIns = eIns instanceof Error ? eIns.message : 'Falha ao gravar licenciamento';
              if (/duplicate|unique|uq_frota_debitos/i.test(msgIns)) continue;
              avisos.push(`${v.placa} (Licenciamento): ${msgIns}`);
              logger.warn('detran-df', `insert licenciamento ${v.placa}: ${msgIns}`);
            }
          }
        } catch (eLic) {
          const msg = eLic instanceof Error ? eLic.message : 'Falha licenciamento';
          avisos.push(`${v.placa} (Licenciamento): ${msg}`);
          logger.warn('detran-df', `sync licenciamento ${v.placa}: ${msg}`);
        }
      }

      if (i < veiculos.length - 1) await sleep(DELAY_ENTRE_VEICULOS_MS);
    }

    const qtdDebitos = qtdIpva + qtdLic;
    const status =
      avisos.length && qtdDebitos === 0 && veiculos.length > 0
        ? 'erro'
        : avisos.length
          ? 'parcial'
          : 'ok';

    logger.info(
      'detran-df',
      `Sync débitos concluído: ${veiculos.length} veículo(s), ${qtdIpva} IPVA, ${qtdLic} licenciamento(s), status=${status}`,
    );
    return {
      ok: status !== 'erro',
      qtd_veiculos: veiculos.length,
      qtd_debitos: qtdDebitos,
      qtd_ipva: qtdIpva,
      qtd_licenciamento: qtdLic,
      avisos,
      status,
      fonte,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error('detran-df', `Sync débitos falhou: ${msg}`);
    return { ok: false, motivo: 'erro', error: msg, avisos };
  } finally {
    rodandoDebitos = false;
  }
}

async function tick() {
  try {
    const { hm, dia } = agoraSP();
    if (hm < HORA_SYNC) return;
    const existente = await syncDoDiaExiste(dia);
    if (existente) return;
    // Consulta automática desativada conforme solicitação do usuário.
    logger.info('detran-df', `Sync automático do dia ${dia} ignorado (Infosimples ativo apenas manualmente)`);
  } catch (e) {
    logger.error('detran-df', `tick sync: ${e instanceof Error ? e.message : e}`);
  }
}

export function iniciarSchedulerMultasDetran() {
  if (timer) return;
  logger.info('detran-df', `Scheduler multas DETRAN-DF ativo — horário ${HORA_SYNC} (America/Sao_Paulo)`);
  // verifica a cada 30s para pegar o minuto certo
  timer = setInterval(() => void tick(), 30000);
  // primeira checagem após boot
  setTimeout(() => void tick(), 15000);
}

/** Lê o cache para o portal (sem chamar Infosimples). */
export async function listarMultasDetranCache({ idVeiculo = null } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (idVeiculo && Number.isFinite(idVeiculo)) {
    params.push(idVeiculo);
    where += ` AND m.id_veiculo = $${params.length}`;
  }

  const { rows: syncRows } = await pool.query(
    `SELECT id_sync, data_ref, iniciado_em, finalizado_em, status, fonte,
            qtd_veiculos, qtd_multas, avisos
     FROM frota_multas_detran_sync
     WHERE status IN ('ok', 'parcial', 'erro')
     ORDER BY data_ref DESC, id_sync DESC
     LIMIT 1`,
  );
  const sync = syncRows[0] || null;

  const { rows: multas } = await pool.query(
    `SELECT m.id_multa_detran, m.id_veiculo, m.placa, m.modelo, m.auto, m.descricao,
            m.local_infracao, m.valor, m.valor_desconto, m.data_multa, m.hora_multa,
            m.data_vencimento, m.orgao, m.pontos, m.natureza, m.velocidade_aferida,
            m.velocidade_permitida, m.responsavel_infracao, m.data_notificacao_autuacao,
            m.fonte, m.consultado_em, m.status` +
    ` FROM frota_multas_detran m
      ${where}
      ORDER BY m.data_multa DESC NULLS LAST, m.id_multa_detran DESC
      LIMIT 500`,
    params,
  );

  const { dia } = agoraSP();

  // Auto-corrige status vencido no banco de dados
  for (const m of multas) {
    if ((m.status === 'Em Aberto' || !m.status) && m.data_vencimento) {
      const venc = String(m.data_vencimento).slice(0, 10);
      if (venc && venc < dia) {
        m.status = 'Vencida';
        pool.query(
          `UPDATE frota_multas_detran SET status = 'Vencida' WHERE id_multa_detran = $1`,
          [m.id_multa_detran],
        ).catch((err) => logger.error('detran-df', `Erro ao auto-corrigir status para vencido: ${err.message}`));
      }
    }
  }

  const jaHoje = sync && String(sync.data_ref).slice(0, 10) === dia;

  return {
    fonte: sync?.fonte || 'cache',
    consultado_em: sync?.finalizado_em || sync?.iniciado_em || null,
    data_ref: sync?.data_ref || null,
    status_sync: sync?.status || null,
    proxima_consulta: jaHoje ? `Amanhã às ${HORA_SYNC}` : `Hoje às ${HORA_SYNC}`,
    horario_sync: HORA_SYNC,
    qtd_veiculos: sync?.qtd_veiculos ?? 0,
    avisos: Array.isArray(sync?.avisos) ? sync.avisos : [],
    multas: multas.map((m) => ({
      id_multa_detran: m.id_multa_detran,
      id_veiculo: m.id_veiculo,
      placa: m.placa,
      modelo: m.modelo,
      auto: m.auto,
      descricao: m.descricao,
      local_infracao: m.local_infracao,
      valor: m.valor != null ? Number(m.valor) : null,
      valor_desconto: m.valor_desconto != null ? Number(m.valor_desconto) : null,
      data_multa: m.data_multa,
      hora_multa: m.hora_multa || null,
      data_vencimento: m.data_vencimento,
      orgao: m.orgao,
      pontos: m.pontos,
      natureza: m.natureza || null,
      velocidade_aferida: m.velocidade_aferida != null ? Number(m.velocidade_aferida) : null,
      velocidade_permitida: m.velocidade_permitida != null ? Number(m.velocidade_permitida) : null,
      responsavel_infracao: m.responsavel_infracao || null,
      data_notificacao_autuacao: m.data_notificacao_autuacao || null,
      fonte: m.fonte || 'infosimples',
      status: m.status || 'Em Aberto',
    })),
    veiculos: [],
  };
}

/** Lê o cache de débitos IPVA/Licenciamento (sem Infosimples). */
export async function listarDebitosDetranCache({ idVeiculo = null } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (idVeiculo && Number.isFinite(idVeiculo)) {
    params.push(idVeiculo);
    where += ` AND d.id_veiculo = $${params.length}`;
  }

  const { rows: syncMeta } = await pool.query(
    `SELECT MAX(consultado_em) AS consultado_em
     FROM frota_debitos_detran
     ${where.replace(/d\./g, '')}`,
    params,
  );

  const { rows: debitos } = await pool.query(
    `SELECT d.id_debito_detran, d.id_veiculo, d.placa, d.modelo, d.tipo, d.ano_referencia,
            d.data_validade, d.data_vencimento, d.valor_total, d.valor_original, d.valor_pago,
            d.valor_multa, d.valor_mora, d.valor_outros, d.valor_diferenca, d.boleto,
            d.status, d.cota, d.fonte, d.consultado_em, d.razao_social
     FROM frota_debitos_detran d
     ${where}
     ORDER BY d.ano_referencia DESC NULLS LAST, d.tipo, d.id_debito_detran DESC
     LIMIT 500`,
    params,
  );

  const num = (v) => (v != null ? Number(v) : null);

  return {
    fonte: 'cache',
    consultado_em: syncMeta[0]?.consultado_em || null,
    data_ref: null,
    status_sync: null,
    avisos: [],
    debitos: debitos.map((d) => ({
      id_debito_detran: d.id_debito_detran,
      id_veiculo: d.id_veiculo,
      placa: d.placa,
      modelo: d.modelo,
      tipo: d.tipo,
      ano_referencia: d.ano_referencia,
      data_validade: d.data_validade,
      data_vencimento: d.data_vencimento,
      valor_total: num(d.valor_total),
      valor_original: num(d.valor_original),
      valor_pago: num(d.valor_pago),
      valor_multa: num(d.valor_multa),
      valor_mora: num(d.valor_mora),
      valor_outros: num(d.valor_outros),
      valor_diferenca: num(d.valor_diferenca),
      boleto: d.boleto || null,
      status: d.status || 'Em Aberto',
      cota: d.cota || null,
      razao_social: d.razao_social || null,
      fonte: d.fonte || 'infosimples',
    })),
  };
}
