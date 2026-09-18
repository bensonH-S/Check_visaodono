/**
 * Scheduler diário do sync de fornecedor (Platlog NF-e + catálogo / Coca NF).
 * Platlog: conta VERONICA no eSupri, filtro por loja. Coca: Conecta Brasal por loja.
 */
import { pool } from '../../db.js';
import {
  credenciaisOk,
  credencialBrasal,
  credencialPlatlog,
  findEsupriLojaByBk,
} from '../../config/fornecedoresLojas.js';
import { syncNfeCoca } from '../brasal/syncNfeCoca.js';
import { syncNfePlatlog } from './syncNfePlatlog.js';
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

async function bkNumberDaLoja(idLoja) {
  const { rows } = await pool.query(`SELECT bk_number FROM lojas WHERE id_loja = $1`, [idLoja]);
  return rows[0]?.bk_number ? String(rows[0].bk_number).replace(/\D/g, '') : '';
}

/**
 * Executa um sync configurado (manual ou agendado).
 */
export async function executarSyncFornecedor(row, { forcar = false, soNfe = false } = {}) {
  const idSync = row.id_sync;
  const fornecedor = row.fornecedor;
  if (!['platlog', 'coca'].includes(fornecedor)) {
    throw Object.assign(new Error(`Fornecedor ${fornecedor} ainda não implementado`), {
      status: 501,
    });
  }

  const bkNumber = await bkNumberDaLoja(row.id_loja);
  let user = '';
  let pass = '';
  let esupriLojaCodigo = '';
  if (fornecedor === 'platlog') {
    const cred = credencialPlatlog();
    user = cred.user;
    pass = cred.pass;
    if (!user || !pass) {
      throw Object.assign(new Error('Credencial eSupri ausente (.env ESUPRI_* ou JSON local)'), {
        status: 400,
      });
    }
    const esupri = findEsupriLojaByBk(bkNumber);
    if (!esupri?.esupri_codigo) {
      throw Object.assign(
        new Error(`Loja BK ${bkNumber || row.id_loja} sem código eSupri no mapeamento`),
        { status: 400 },
      );
    }
    esupriLojaCodigo = esupri.esupri_codigo;
  } else if (fornecedor === 'coca') {
    const cred = credencialBrasal(bkNumber);
    user = cred.user;
    pass = cred.pass;
    if (!user || !pass) {
      throw Object.assign(
        new Error(`Credencial Conecta Brasal ausente para a loja BK ${bkNumber || row.id_loja}`),
        { status: 400 },
      );
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

    const syncNfe = process.env.ESUPRI_SYNC_NFE !== '0';
    const syncCat = !soNfe && process.env.ESUPRI_SYNC_CATALOGO === '1';
    const nfeResult = syncNfe
      ? await syncNfePlatlog({
          id_loja: row.id_loja,
          user,
          pass,
          esupriLojaCodigo,
          limit: row.limite || 20,
          aplicar: true,
          registrar_entrada: false,
          pular_existentes: !forcar,
          headless: true,
        })
      : { baixadas: 0, processadas: [] };
    const catResult = syncCat
      ? await syncPrecosCatalogoPlatlog({
          id_loja: row.id_loja,
          user,
          pass,
          aplicar: true,
          headless: true,
        }).catch((e) => ({
          atualizados: [],
          erros: [{ codigo: 'catalogo', erro: String(e.message || e) }],
          casados: [],
          faltando: [],
          catalogo_total: 0,
        }))
      : { atualizados: [], erros: [], casados: [], faltando: [], catalogo_total: 0 };

    const aplicadasNfe = (nfeResult.processadas || []).filter((p) => p.aplicado).length;
    const errosNfe = (nfeResult.processadas || []).filter((p) => !p.ok).length;
    const aplicadasCat = catResult.atualizados?.length || 0;
    const errosCat = catResult.erros?.length || 0;
    const aplicadas = aplicadasNfe + aplicadasCat;
    const erros = errosNfe + errosCat;
    const status = erros && aplicadas ? 'parcial' : erros ? 'erro' : 'ok';

    await marcarStatus(idSync, {
      ultimo_fim: new Date(),
      ultimo_status: status,
      ultimo_erro: erros
        ? [
            ...((nfeResult.processadas || []).filter((p) => !p.ok).map((p) => p.erro) || []),
            ...(catResult.erros || []).map((e) => `${e.codigo}: ${e.erro}`),
          ]
            .filter(Boolean)
            .join('; ')
            .slice(0, 500)
        : null,
      ultimo_resumo: {
        modo: [syncNfe ? 'nfe' : null, syncCat ? 'catalogo_pedido' : null].filter(Boolean).join('+'),
        baixadas: nfeResult.baixadas || 0,
        aplicadas: aplicadasNfe,
        erros: errosNfe,
        catalogo: catResult.catalogo_total || 0,
        casados: catResult.casados?.length || 0,
        atualizados: aplicadasCat,
        faltando: catResult.faltando?.length || 0,
      },
      ultima_execucao_dia: dia,
    });

    return { id_sync: idSync, status, nfe: nfeResult, catalogo: catResult };
  } catch (e) {
    await marcarStatus(idSync, {
      ultimo_fim: new Date(),
      ultimo_status: 'erro',
      ultimo_erro: String(e.message || e).slice(0, 500),
    });
    throw e;
  }
}

function hmToMinutos(hm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hm || ''));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Já passou do horário de hoje e ainda não rodou — puxa a fila (não espera o minuto exato). */
function syncPendenteHoje(row, { dia, hm }) {
  if (row.ultimo_status === 'rodando') return false;
  const jaHoje =
    row.ultima_execucao_dia && String(row.ultima_execucao_dia).slice(0, 10) === dia;
  if (jaHoje) return false;
  const alvo = timeToHm(row.horario);
  const alvoMin = hmToMinutos(alvo);
  const agoraMin = hmToMinutos(hm);
  if (alvoMin == null || agoraMin == null) return false;
  return agoraMin >= alvoMin;
}

async function tick() {
  if (rodando) return;
  const { dia, hm } = agoraSP();

  let rows;
  try {
    const r = await pool.query(
      `SELECT * FROM estoque_sync_fornecedor
       WHERE ativo = TRUE AND fornecedor IN ('platlog', 'coca')
       ORDER BY horario, id_loja`,
    );
    rows = r.rows;
  } catch (e) {
    // tabela ainda não migrada
    if (e.code === '42P01') return;
    console.error('[platlog-sched] query falhou:', e.message);
    return;
  }

  const pendentes = rows.filter((row) => syncPendenteHoje(row, { dia, hm }));
  if (!pendentes.length) return;

  rodando = true;
  try {
    for (const row of pendentes) {
      console.log(`[platlog-sched] disparo loja ${row.id_loja} (${row.fornecedor}) às ${hm}`);
      try {
        await executarSyncFornecedor(row, { soNfe: true });
        console.log(`[platlog-sched] ok loja ${row.id_loja}`);
      } catch (e) {
        console.error(`[platlog-sched] erro loja ${row.id_loja}:`, e.message);
      }
    }
  } finally {
    rodando = false;
  }
}

export function iniciarSchedulerPlatlog() {
  if (timer) return timer;
  console.log('[platlog-sched] Monitor ativo (checa a cada 60s, catch-up se o horário já passou)');
  // primeira checagem em 20s
  setTimeout(() => void tick(), 20000);
  timer = setInterval(() => void tick(), 60000);
  return timer;
}

let lote = {
  rodando: false,
  fornecedor: null,
  inicio: null,
  fim: null,
  lojas_total: 0,
  lojas_ok: 0,
  lojas_erro: 0,
  loja_atual: null,
  mensagem: null,
};

export function statusLoteSync() {
  return { ...lote, em_andamento: rodando || lote.rodando };
}

export function syncFornecedorEmAndamento() {
  return rodando || lote.rodando;
}

/**
 * Puxão manual de todas as lojas (mesmo papel do CLI --todas).
 * Roda em sequência; o lock `rodando` impede o scheduler de cruzar.
 */
export async function rodarFilaSyncFornecedor({
  fornecedor = 'platlog',
  soNfe = true,
  forcar = false,
  somenteAtivos = true,
} = {}) {
  if (rodando || lote.rodando) {
    throw Object.assign(new Error('Sync já em andamento — aguarde terminar'), { status: 409 });
  }
  const forn = String(fornecedor || 'platlog').toLowerCase();
  if (!['platlog', 'coca'].includes(forn)) {
    throw Object.assign(new Error('Fornecedor inválido'), { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT * FROM estoque_sync_fornecedor
     WHERE fornecedor = $1 ${somenteAtivos ? 'AND ativo = TRUE' : ''}
     ORDER BY id_loja`,
    [forn],
  );
  if (!rows.length) {
    throw Object.assign(new Error('Nenhuma loja ativa para este fornecedor'), { status: 400 });
  }

  lote = {
    rodando: true,
    fornecedor: forn,
    inicio: new Date().toISOString(),
    fim: null,
    lojas_total: rows.length,
    lojas_ok: 0,
    lojas_erro: 0,
    loja_atual: rows[0]?.id_loja || null,
    mensagem: `Puxando 1 de ${rows.length}`,
  };
  rodando = true;

  try {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      lote.loja_atual = row.id_loja;
      lote.mensagem = `Puxando ${i + 1} de ${rows.length}`;
      console.log(`[platlog-sched] lote ${forn} loja ${row.id_loja} (${i + 1}/${rows.length})`);
      try {
        await executarSyncFornecedor(row, { forcar, soNfe });
        lote.lojas_ok += 1;
      } catch (e) {
        lote.lojas_erro += 1;
        console.error(`[platlog-sched] lote erro loja ${row.id_loja}:`, e.message);
      }
    }
    lote.mensagem =
      lote.lojas_erro === 0
        ? `Puxou corretamente: ${lote.lojas_ok} lojas`
        : `Terminou com falha: ${lote.lojas_ok} ok, ${lote.lojas_erro} com erro`;
  } finally {
    lote.rodando = false;
    lote.fim = new Date().toISOString();
    lote.loja_atual = null;
    rodando = false;
  }

  return { ...lote };
}

export function resumoPainelSync(itens) {
  const porForn = (forn) => {
    const lista = (itens || []).filter((i) => i.fornecedor === forn);
    const ativas = lista.filter((i) => i.ativo);
    const ok = ativas.filter((i) => i.ultimo_status === 'ok').length;
    const erro = ativas.filter((i) => i.ultimo_status === 'erro').length;
    const parcial = ativas.filter((i) => i.ultimo_status === 'parcial').length;
    const emCurso = ativas.filter((i) => i.ultimo_status === 'rodando').length;
    const nfes = ativas.reduce((s, i) => s + (Number(i.nfes_total) || 0), 0);
    const aplicadas = ativas.reduce(
      (s, i) => s + (Number(i.ultimo_resumo?.aplicadas) || 0),
      0,
    );
    const fins = ativas.map((i) => i.ultimo_fim).filter(Boolean).sort();
    const ultima = fins.length ? fins[fins.length - 1] : null;
    const total = ativas.length;
    let situacao = 'nunca';
    let texto = total ? 'Ainda não puxou NFs destas lojas.' : 'Nenhuma loja ativa.';
    if (emCurso || lote.rodando) {
      situacao = 'rodando';
      texto = lote.mensagem || 'Puxando notas…';
    } else if (total && ok === total) {
      situacao = 'ok';
      texto = `Puxou corretamente: ${ok} lojas · ${nfes} NFs no app`;
    } else if (erro || parcial) {
      situacao = 'erro';
      texto = `${ok}/${total} lojas ok · ${erro + parcial} com problema · ${nfes} NFs no app`;
    } else if (ok) {
      situacao = 'parcial';
      texto = `${ok}/${total} lojas puxaram · ${nfes} NFs no app`;
    }
    return {
      fornecedor: forn,
      lojas: total,
      ok,
      erro,
      parcial,
      rodando: emCurso,
      nfes_total: nfes,
      aplicadas_ultima: aplicadas,
      ultima,
      situacao,
      texto,
    };
  };
  return {
    platlog: porForn('platlog'),
    coca: porForn('coca'),
    lote: statusLoteSync(),
  };
}

export async function listarSyncFornecedor() {
  const { rows } = await pool.query(
    `SELECT s.*, l.name AS loja_nome, l.bk_number AS loja_codigo,
            (SELECT COUNT(*)::int FROM estoque_nfe n WHERE n.id_loja = s.id_loja) AS nfes_total
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
    credenciais_ok: credenciaisOk(r.fornecedor, r.loja_codigo),
    nfes_total: Number(r.nfes_total) || 0,
  };
}
