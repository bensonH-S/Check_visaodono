/**
 * Scheduler diário do sync de fornecedor (Platlog catálogo / Coca NF).
 * Platlog: preços pelo catálogo Pedido eSupri (não NF-e).
 * Lê estoque_sync_fornecedor e dispara no horário (America/Sao_Paulo).
 */
import { pool } from '../../db.js';
import { syncNfeCoca } from '../brasal/syncNfeCoca.js';
import { syncPrecosCatalogoPlatlog } from './syncPrecosCatalogoPlatlog.js';

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

function timeToHm(t) {
  // pg pode devolver "06:00:00" ou Date
  if (t instanceof Date) {
    return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
  }
  const s = String(t || '').slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

async function marcarStatus(idSync, patch) {
  const campos = [];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    campos.push(`${k} = $${i++}`);
    vals.push(v);
  }
  campos.push(`atualizado_em = NOW()`);
  vals.push(idSync);
  await pool.query(
    `UPDATE estoque_sync_fornecedor SET ${campos.join(', ')} WHERE id_sync = $${i}`,
    vals,
  );
}

/**
 * Executa um sync configurado (manual ou agendado).
 */
export async function executarSyncFornecedor(row, { forcar = false } = {}) {
  const idSync = row.id_sync;
  const fornecedor = row.fornecedor;
  if (!['platlog', 'coca'].includes(fornecedor)) {
    throw Object.assign(new Error(`Fornecedor ${fornecedor} ainda não implementado`), {
      status: 501,
    });
  }

  let user = '';
  let pass = '';
  if (fornecedor === 'platlog') {
    user = process.env.ESUPRI_USER || '';
    pass = process.env.ESUPRI_PASS || '';
    if (!user || !pass) {
      throw Object.assign(new Error('ESUPRI_USER / ESUPRI_PASS ausentes no .env'), { status: 400 });
    }
  } else if (fornecedor === 'coca') {
    user = process.env.BRASAL_USER || '';
    pass = process.env.BRASAL_PASS || '';
    if (!user || !pass) {
      throw Object.assign(new Error('BRASAL_USER / BRASAL_PASS ausentes no .env'), { status: 400 });
    }
  }

  await marcarStatus(idSync, {
    ultimo_inicio: new Date(),
    ultimo_status: 'rodando',
    ultimo_erro: null,
  });

  try {
    const { dia } = agoraSP();

    if (fornecedor === 'coca') {
      const result = await syncNfeCoca({
        id_loja: row.id_loja,
        user,
        pass,
        limit: row.limite || 20,
        aplicar: true,
        registrar_entrada: false,
        pular_existentes: !forcar,
      });

      const aplicadas = result.processadas.filter((p) => p.aplicado).length;
      const erros = result.processadas.filter((p) => !p.ok).length;
      const status = erros && aplicadas ? 'parcial' : erros ? 'erro' : 'ok';

      await marcarStatus(idSync, {
        ultimo_fim: new Date(),
        ultimo_status: status,
        ultimo_erro: erros
          ? result.processadas
              .filter((p) => !p.ok)
              .map((p) => p.erro)
              .join('; ')
              .slice(0, 500)
          : null,
        ultimo_resumo: {
          baixadas: result.baixadas,
          aplicadas,
          erros,
          processadas: result.processadas.map((p) => ({
            nota: p.notaLabel,
            numero: p.numero,
            casados: p.casados,
            itens: p.itens,
            aplicado: p.aplicado,
            pulada: p.pulada,
            ok: p.ok,
          })),
        },
        ultima_execucao_dia: dia,
      });

      return { id_sync: idSync, status, result };
    }

    // Platlog: catálogo Pedido → preços (NF-e documentada em README; fora do scheduler)
    const result = await syncPrecosCatalogoPlatlog({
      id_loja: row.id_loja,
      user,
      pass,
      aplicar: true,
      headless: true,
    });

    const aplicadas = result.atualizados.length;
    const erros = result.erros.length;
    const status = erros && aplicadas ? 'parcial' : erros ? 'erro' : 'ok';

    await marcarStatus(idSync, {
      ultimo_fim: new Date(),
      ultimo_status: status,
      ultimo_erro: erros
        ? result.erros
            .map((e) => `${e.codigo}: ${e.erro}`)
            .join('; ')
            .slice(0, 500)
        : null,
      ultimo_resumo: {
        modo: 'catalogo_pedido',
        catalogo: result.catalogo_total,
        casados: result.casados.length,
        atualizados: aplicadas,
        faltando: result.faltando.length,
        erros,
      },
      ultima_execucao_dia: dia,
    });

    return { id_sync: idSync, status, result };
  } catch (e) {
    await marcarStatus(idSync, {
      ultimo_fim: new Date(),
      ultimo_status: 'erro',
      ultimo_erro: String(e.message || e).slice(0, 500),
    });
    throw e;
  }
}

async function tick() {
  if (rodando) return;
  const { dia, hm } = agoraSP();

  let rows;
  try {
    const r = await pool.query(
      `SELECT * FROM estoque_sync_fornecedor
       WHERE ativo = TRUE AND fornecedor IN ('platlog', 'coca')`,
    );
    rows = r.rows;
  } catch (e) {
    // tabela ainda não migrada
    if (e.code === '42P01') return;
    console.error('[platlog-sched] query falhou:', e.message);
    return;
  }

  for (const row of rows) {
    const alvo = timeToHm(row.horario);
    if (!alvo || alvo !== hm) continue;
    if (row.ultimo_status === 'rodando') continue;
    const jaHoje =
      row.ultima_execucao_dia && String(row.ultima_execucao_dia).slice(0, 10) === dia;
    if (jaHoje) continue;

    rodando = true;
    console.log(`[platlog-sched] disparo loja ${row.id_loja} às ${hm}`);
    try {
      await executarSyncFornecedor(row);
      console.log(`[platlog-sched] ok loja ${row.id_loja}`);
    } catch (e) {
      console.error(`[platlog-sched] erro loja ${row.id_loja}:`, e.message);
    } finally {
      rodando = false;
    }
  }
}

export function iniciarSchedulerPlatlog() {
  if (timer) return timer;
  console.log('[platlog-sched] Monitor ativo (checa a cada 60s, fuso America/Sao_Paulo)');
  // primeira checagem em 20s
  setTimeout(() => void tick(), 20000);
  timer = setInterval(() => void tick(), 60000);
  return timer;
}

export async function listarSyncFornecedor() {
  const { rows } = await pool.query(
    `SELECT s.*, l.name AS loja_nome, l.bk_number AS loja_codigo
     FROM estoque_sync_fornecedor s
     JOIN lojas l ON l.id_loja = s.id_loja
     ORDER BY s.fornecedor, l.name`,
  );
  return rows.map(mapRow);
}

export async function upsertSyncFornecedor({
  fornecedor,
  id_loja,
  ativo,
  horario,
  limite,
}) {
  const forn = String(fornecedor || '').toLowerCase();
  if (!['platlog', 'coca'].includes(forn)) {
    throw Object.assign(new Error('Fornecedor inválido'), { status: 400 });
  }
  const idLoja = Number(id_loja);
  if (!idLoja) throw Object.assign(new Error('Loja obrigatória'), { status: 400 });

  let hm = String(horario || '06:00').trim();
  if (/^\d{1}:\d{2}$/.test(hm)) hm = `0${hm}`;
  if (!/^\d{2}:\d{2}$/.test(hm)) {
    throw Object.assign(new Error('Horário inválido (use HH:MM)'), { status: 400 });
  }
  const lim = Number(limite);
  if (!Number.isFinite(lim) || lim < 1 || lim > 200) {
    throw Object.assign(new Error('Limite deve ser entre 1 e 200'), { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO estoque_sync_fornecedor (fornecedor, id_loja, ativo, horario, limite, atualizado_em)
     VALUES ($1, $2, $3, $4::time, $5, NOW())
     ON CONFLICT (fornecedor, id_loja) DO UPDATE SET
       ativo = EXCLUDED.ativo,
       horario = EXCLUDED.horario,
       limite = EXCLUDED.limite,
       atualizado_em = NOW()
     RETURNING *`,
    [forn, idLoja, !!ativo, hm, lim],
  );
  const { rows: joined } = await pool.query(
    `SELECT s.*, l.name AS loja_nome, l.bk_number AS loja_codigo
     FROM estoque_sync_fornecedor s
     JOIN lojas l ON l.id_loja = s.id_loja
     WHERE s.id_sync = $1`,
    [rows[0].id_sync],
  );
  return mapRow(joined[0]);
}

export async function obterSyncPorId(idSync) {
  const { rows } = await pool.query(
    `SELECT s.*, l.name AS loja_nome, l.bk_number AS loja_codigo
     FROM estoque_sync_fornecedor s
     JOIN lojas l ON l.id_loja = s.id_loja
     WHERE s.id_sync = $1`,
    [idSync],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

function mapRow(r) {
  return {
    id_sync: r.id_sync,
    fornecedor: r.fornecedor,
    id_loja: r.id_loja,
    loja_nome: r.loja_nome,
    loja_codigo: r.loja_codigo,
    ativo: !!r.ativo,
    horario: timeToHm(r.horario) || '06:00',
    limite: Number(r.limite) || 20,
    ultimo_inicio: r.ultimo_inicio,
    ultimo_fim: r.ultimo_fim,
    ultimo_status: r.ultimo_status,
    ultimo_resumo: r.ultimo_resumo,
    ultimo_erro: r.ultimo_erro,
    ultima_execucao_dia: r.ultima_execucao_dia
      ? String(r.ultima_execucao_dia).slice(0, 10)
      : null,
    atualizado_em: r.atualizado_em,
    credenciais_ok:
      r.fornecedor === 'platlog'
        ? Boolean(process.env.ESUPRI_USER && process.env.ESUPRI_PASS)
        : r.fornecedor === 'coca'
          ? Boolean(process.env.BRASAL_USER && process.env.BRASAL_PASS)
          : false,
  };
}
