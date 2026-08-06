/**
 * Scheduler: consulta Infosimples DETRAN-DF 1x/dia às 17:00 (America/Sao_Paulo)
 * e grava o resultado em frota_multas_detran para a tela do portal.
 */
import { pool } from '../db.js';
import { logger } from '../logger.js';
import { consultarMultasDetranDf, fonteMultasConfigurada } from './detranDfMultas.js';

const HORA_SYNC = (process.env.MULTAS_DETRAN_SYNC_HORA || '17:00').slice(0, 5);
const DELAY_ENTRE_VEICULOS_MS = Number(process.env.MULTAS_DETRAN_SYNC_DELAY_MS || 800);

let timer = null;
let rodando = false;

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
    const autosExistentes = new Set(existentes.map((r) => r.auto));

    const novas = [];
    for (let i = 0; i < veiculos.length; i++) {
      const v = veiculos[i];
      try {
        const r = await consultarMultasDetranDf({ placa: v.placa, renavam: v.renavam });
        fonte = r.fonte || fonte;
        for (const m of r.multas) {
          if (autosExistentes.has(m.auto)) {
            continue; // Já cadastrada anteriormente, evita sobrescrever
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
            m.data_vencimento,
            m.orgao,
            m.pontos,
            r.fonte || 'infosimples',
          ]);
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
              valor, valor_desconto, data_multa, data_vencimento, orgao, pontos, fonte)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14)`,
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
      `Sync ${dia} concluído: ${veiculos.length} veículo(s), ${qtdMultas} multa(s), status=${status}`,
    );
    return {
      ok: status !== 'erro',
      id_sync: idSync,
      data_ref: dia,
      qtd_veiculos: veiculos.length,
      qtd_multas: qtdMultas,
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
            m.local_infracao, m.valor, m.valor_desconto, m.data_multa, m.data_vencimento,
            m.orgao, m.pontos, m.fonte, m.consultado_em, m.status` +
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
      data_vencimento: m.data_vencimento,
      orgao: m.orgao,
      pontos: m.pontos,
      fonte: m.fonte || 'infosimples',
      status: m.status || 'Em Aberto',
    })),
    veiculos: [],
  };
}
