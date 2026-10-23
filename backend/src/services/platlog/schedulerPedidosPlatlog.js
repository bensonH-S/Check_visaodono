/**
 * Lê os pedidos do eSupri de todas as lojas algumas vezes por dia (só consulta, nunca confirma).
 */
import { pool } from '../../db.js';
import { sincronizarPedidosPlatlog } from './syncPedidosPlatlog.js';

export const HORARIOS_PEDIDOS_ESUPRI = ['07:00', '11:00', '15:00', '19:00'];

let timer = null;
let rodando = false;
let ultimoSlotTentado = null;
let ultimaExecucao = null;

function agoraSP() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { dia: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

function slotAtual() {
  const { dia, hm } = agoraSP();
  const passou = HORARIOS_PEDIDOS_ESUPRI.filter((h) => h <= hm);
  return passou.length ? { dia, hm: passou[passou.length - 1] } : null;
}

/** Próximo horário de leitura (HH:MM, hoje ou amanhã). */
export function proximaLeituraPedidos() {
  const { hm } = agoraSP();
  return HORARIOS_PEDIDOS_ESUPRI.find((h) => h > hm) || HORARIOS_PEDIDOS_ESUPRI[0];
}

export function statusSchedulerPedidos() {
  return { rodando, ultima_execucao: ultimaExecucao, horarios: HORARIOS_PEDIDOS_ESUPRI, proxima: proximaLeituraPedidos() };
}

async function tick() {
  if (rodando) return;
  const slot = slotAtual();
  if (!slot) return;
  const chave = `${slot.dia} ${slot.hm}`;
  if (ultimoSlotTentado === chave) return;

  const inicioSlot = new Date(`${slot.dia}T${slot.hm}:00-03:00`);
  const { rows } = await pool.query(`SELECT MAX(sincronizado_em) AS em FROM estoque_pedido_platlog`);
  if (rows[0]?.em && new Date(rows[0].em) >= inicioSlot) {
    ultimoSlotTentado = chave;
    return;
  }

  ultimoSlotTentado = chave;
  rodando = true;
  const t0 = Date.now();
  console.log(`[esupri-pedidos-sched] leitura das ${slot.hm} começou`);
  try {
    const r = await sincronizarPedidosPlatlog({
      dias: 60,
      onLog: (m) => {
        if (/erro|pedidos no portal/i.test(m)) console.log(`[esupri-pedidos-sched] ${m}`);
      },
    });
    ultimaExecucao = { slot: chave, fim: new Date().toISOString(), ...r };
    console.log(
      `[esupri-pedidos-sched] fim em ${Math.round((Date.now() - t0) / 60000)} min: ${r.pedidos} pedidos, ${r.novos} novos, ${r.erros.length} erro(s)`,
    );
  } catch (e) {
    ultimaExecucao = { slot: chave, fim: new Date().toISOString(), erro: e.message };
    console.error('[esupri-pedidos-sched] falhou:', e.message);
  } finally {
    rodando = false;
  }
}

export function leituraPedidosEmAndamento() {
  return rodando;
}

export function iniciarSchedulerPedidosPlatlog() {
  if (timer) return timer;
  console.log(`[esupri-pedidos-sched] ativo: ${HORARIOS_PEDIDOS_ESUPRI.join(', ')} (catch-up se o horário já passou)`);
  setTimeout(() => void tick().catch((e) => console.error('[esupri-pedidos-sched]', e.message)), 90000);
  timer = setInterval(() => void tick().catch((e) => console.error('[esupri-pedidos-sched]', e.message)), 5 * 60000);
  return timer;
}
