/** Dia civil em America/Sao_Paulo. */
export function partesContagemSp(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(agora);
  const ler = (tipo) => partes.find((p) => p.type === tipo)?.value || '';
  const dia = Number(ler('day'));
  return {
    data: `${ler('year')}-${ler('month')}-${String(dia).padStart(2, '0')}`,
    dia,
    segunda: ler('weekday') === 'Mon',
    dia1: dia === 1,
  };
}

/**
 * Qual contagem pode ser iniciada.
 * Dia 1: só a mensal (a lista dela não muda).
 * Segunda que não é dia 1: só a semanal.
 * Nos outros dias: só a diária. A mensal não abre.
 */
export function agendaContagem(agora = new Date()) {
  const p = partesContagemSp(agora);
  if (p.dia1) {
    return { ...p, tipo: 'completa', diaria: false, semanal: false, mensal: true };
  }
  if (p.segunda) {
    return { ...p, tipo: 'critica_semanal', diaria: false, semanal: true, mensal: false };
  }
  return { ...p, tipo: 'diaria', diaria: true, semanal: false, mensal: false };
}

export function assertTipoContagemNaAgenda(tipoContagem, agora = new Date()) {
  const agenda = agendaContagem(agora);
  if (tipoContagem === 'diaria' && !agenda.diaria) {
    const err = new Error(
      agenda.dia1
        ? 'No dia 1 a contagem diária não abre.'
        : 'Na segunda a contagem diária não abre. Abra a semanal.',
    );
    err.status = 400;
    throw err;
  }
  if (tipoContagem === 'critica_semanal' && !agenda.semanal) {
    const err = new Error(
      agenda.dia1
        ? 'No dia 1 a contagem semanal não abre.'
        : 'A contagem semanal só abre na segunda-feira.',
    );
    err.status = 400;
    throw err;
  }
  if (tipoContagem === 'completa' && !agenda.mensal) {
    const err = new Error(
      agenda.segunda
        ? 'Na segunda a contagem mensal não abre. Abra a semanal.'
        : 'A contagem mensal só abre no dia 1.',
    );
    err.status = 400;
    throw err;
  }
}

let timer = null;
let ultimoDia = '';

export async function aplicarAgendaContagem(agora = new Date()) {
  const agenda = agendaContagem(agora);
  if (agenda.data === ultimoDia) return { agenda, gravou: false };
  const { pool } = await import('../db.js');
  const { rows } = await pool.query('SELECT id_loja FROM lojas');
  for (const loja of rows) {
    await pool.query(
      `INSERT INTO estoque_contagem_agenda (id_loja, data_agenda, tipo, diaria, semanal, mensal)
       VALUES ($1, $2::date, $3, $4, $5, $6)
       ON CONFLICT (id_loja, data_agenda) DO UPDATE SET
         tipo = EXCLUDED.tipo,
         diaria = EXCLUDED.diaria,
         semanal = EXCLUDED.semanal,
         mensal = EXCLUDED.mensal,
         aplicado_em = NOW()`,
      [loja.id_loja, agenda.data, agenda.tipo, agenda.diaria, agenda.semanal, agenda.mensal],
    );
  }
  ultimoDia = agenda.data;
  return { agenda, gravou: true, lojas: rows.length };
}

export function iniciarAgendaContagem() {
  if (timer) return;
  const tick = () => {
    void aplicarAgendaContagem().catch((e) => {
      console.error('[contagem-agenda]', e.message);
    });
  };
  tick();
  timer = setInterval(tick, 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
}
