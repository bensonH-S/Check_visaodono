/**
 * Janela de compra Platlog, tirada da planilha de entregas do Grupo Alvim.
 * Pedido fecha às 11h do dia em que a loja pede.
 * A entrega é sempre 7 dias depois do pedido, no mesmo dia da semana.
 * A cobertura vai até a entrega do pedido seguinte, que é quando o próximo caminhão repõe.
 */

const HORA_LIMITE_MIN = 11 * 60;
export const PRAZO_ENTREGA_DIAS = 7;

const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** @type {Array<{ bk: string, loja: string, regional: string, pedido: string, recebe: string }>} */
const LINHAS = [
  { bk: '23194', loja: 'Caldas', regional: 'Barbara', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Quinta' },
  { bk: '31782', loja: 'Ponte Alta', regional: 'Barbara', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Sabado' },
  { bk: '30769', loja: 'Recanto', regional: 'Barbara', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Sabado' },
  { bk: '31614', loja: 'Samambaia', regional: 'Barbara', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Sabado' },
  { bk: '19929', loja: 'PLK', regional: 'Barbara', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Sabado' },
  { bk: '21583', loja: 'Plaza', regional: 'Barbara', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Sabado' },
  { bk: '27984', loja: 'Planaltina', regional: 'Plinio', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Quinta' },
  { bk: '30784', loja: 'Sobradinho', regional: 'Plinio', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Quinta' },
  { bk: '31608', loja: 'Noroeste', regional: 'Plinio', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Quinta' },
  { bk: '23531', loja: '707', regional: 'Plinio', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Quinta' },
  { bk: '19929', loja: '201', regional: 'Plinio', pedido: 'Terça e Quinta', recebe: 'Segunda-feira e Quinta' },
  { bk: '33104', loja: 'São Sebastião', regional: 'Plinio', pedido: 'Terça e Quinta', recebe: 'Terça-feira e Sexta' },
  { bk: '32338', loja: 'Unaí', regional: 'Plinio', pedido: 'Terça e Quinta', recebe: 'Quarta-feira e Sábado' },
  { bk: '32555', loja: 'Estrutural', regional: 'Fagno', pedido: 'Segunda e Quarta', recebe: 'Terça e Sexta' },
  { bk: '25261', loja: 'Venâncio', regional: 'Fagno', pedido: 'Terça e Quinta', recebe: 'Terça e Sexta' },
  { bk: '30797', loja: 'Terraço', regional: 'Fagno', pedido: 'Segunda e Quarta', recebe: 'Segunda e Quinta' },
  { bk: '23240', loja: 'Sudoeste', regional: 'Fagno', pedido: 'Segunda e Quarta', recebe: 'Segunda e Quinta' },
  { bk: '18915', loja: 'Asa Sul', regional: 'Fagno', pedido: 'Terça e Quinta', recebe: 'Terça e Sexta' },
  { bk: '20415', loja: 'Lago Sul', regional: 'Fagno', pedido: 'Terça e Quinta', recebe: 'Terça e Sexta' },
  { bk: '24820', loja: 'Ceilândia', regional: 'Fagno', pedido: 'Terça e Quinta', recebe: 'Terça e Sexta' },
];

function semAcento(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function diasDaSemana(texto) {
  const limpo = semAcento(texto);
  const mapa = [
    ['segunda', 1],
    ['terca', 2],
    ['quarta', 3],
    ['quinta', 4],
    ['sexta', 5],
    ['sabado', 6],
    ['domingo', 0],
  ];
  const achados = [];
  for (const [nome, dow] of mapa) {
    if (limpo.includes(nome)) achados.push(dow);
  }
  return achados.sort((a, b) => a - b);
}

function leadDias(pedido, entrega) {
  let d = entrega - pedido;
  if (d <= 0) d += 7;
  return d;
}

function permutacoes(lista) {
  if (lista.length <= 1) return [lista];
  const out = [];
  lista.forEach((item, i) => {
    const resto = [...lista.slice(0, i), ...lista.slice(i + 1)];
    for (const p of permutacoes(resto)) out.push([item, ...p]);
  });
  return out;
}

function semCruzar(pares) {
  const ord = [...pares].sort((a, b) => a.pedido - b.pedido);
  for (let i = 0; i < ord.length; i++) {
    const atual = ord[i].pedido + ord[i].lead;
    const prox = ord[(i + 1) % ord.length];
    let entregaProx = prox.pedido + prox.lead;
    if (i === ord.length - 1) entregaProx += 7;
    if (entregaProx <= atual) return false;
  }
  return true;
}

/** Casa dias da planilha. O pedido não usa mais isto: a entrega é sempre 7 dias depois. */
export function parearEntregas(pedidos, recebimentos) {
  const peds = [...pedidos].sort((a, b) => a - b);
  const recs = [...recebimentos].sort((a, b) => a - b);
  let melhor = null;
  for (const ordem of permutacoes(recs)) {
    const pares = peds.map((pedido, i) => ({
      pedido,
      entrega: ordem[i],
      lead: leadDias(pedido, ordem[i]),
    }));
    if (!semCruzar(pares)) continue;
    const total = pares.reduce((s, p) => s + p.lead, 0);
    const max = Math.max(...pares.map((p) => p.lead));
    if (!melhor || total < melhor.total || (total === melhor.total && max < melhor.max)) {
      melhor = { pares, total, max };
    }
  }
  return melhor ? melhor.pares : null;
}

function relogioSP(agora) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const partes = Object.fromEntries(fmt.formatToParts(agora).map((p) => [p.type, p.value]));
  const iso = `${partes.year}-${partes.month}-${partes.day}`;
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const minutos = Number(partes.hour) * 60 + Number(partes.minute);
  return { iso, dow, minutos };
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function diffDias(de, ate) {
  const [y1, m1, d1] = de.split('-').map(Number);
  const [y2, m2, d2] = ate.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

function juntarDias(dows) {
  return [...dows].sort((a, b) => a - b).map((d) => NOME_DIA[d]).join(' e ');
}

export function agendaDaLoja({ bk, nome } = {}) {
  const chave = String(bk || '').replace(/\D/g, '');
  const hits = LINHAS.filter((l) => l.bk === chave);
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0];
  const n = semAcento(nome);
  if (n.includes('plk')) return hits.find((h) => semAcento(h.loja).includes('plk')) || null;
  if (n.includes('201')) return hits.find((h) => h.loja.includes('201')) || null;
  return null;
}

function proximaDataPedido(isoHoje, dowHoje, minutos, pedidos, incluirHoje) {
  for (let i = 0; i < 8; i += 1) {
    const iso = addDays(isoHoje, i);
    const dow = (dowHoje + i) % 7;
    if (!pedidos.includes(dow)) continue;
    if (i === 0 && !incluirHoje) continue;
    if (i === 0 && minutos > HORA_LIMITE_MIN) continue;
    return iso;
  }
  return null;
}

function entregaDoPedido(isoPedido) {
  return addDays(isoPedido, PRAZO_ENTREGA_DIAS);
}

/**
 * @param {{ bk: string, loja: string, pedido: string, recebe: string }} agenda
 * @param {Date} [agora]
 */
export function calcularJanelaCompra(agenda, agora = new Date()) {
  const pedidos = diasDaSemana(agenda.pedido);
  if (!pedidos.length) return null;
  const rel = relogioSP(agora);
  const aberta = pedidos.includes(rel.dow) && rel.minutos <= HORA_LIMITE_MIN;
  const proximo = proximaDataPedido(rel.iso, rel.dow, rel.minutos, pedidos, true);
  if (!proximo) return null;
  const entregaDeste = entregaDoPedido(proximo);
  const seguintePedido = proximaDataPedido(proximo, diasDaSemanaISO(proximo), 0, pedidos, false);
  const entregaSeguinte = seguintePedido ? entregaDoPedido(seguintePedido) : null;
  if (!entregaDeste || !entregaSeguinte) return null;
  const dias = diffDias(rel.iso, entregaSeguinte);
  if (!(dias > 0)) return null;
  return {
    conhecida: true,
    loja: agenda.loja,
    regional: agenda.regional,
    dias_pedido: juntarDias(pedidos),
    dias_entrega: juntarDias(pedidos),
    prazo_entrega_dias: PRAZO_ENTREGA_DIAS,
    pares: pedidos.map((pedido) => ({
      pedido: NOME_DIA[pedido],
      entrega: NOME_DIA[pedido],
      lead_dias: PRAZO_ENTREGA_DIAS,
    })),
    hora_limite: '11:00',
    janela_aberta: aberta,
    proximo_pedido: proximo,
    entrega_deste: entregaDeste,
    entrega_seguinte: entregaSeguinte,
    dias_ate_entrega_seguinte: dias,
  };
}

function diasDaSemanaISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function janelaDaLoja({ bk, nome } = {}, agora = new Date()) {
  const agenda = agendaDaLoja({ bk, nome });
  if (!agenda) return null;
  return calcularJanelaCompra(agenda, agora);
}
