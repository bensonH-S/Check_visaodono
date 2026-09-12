export const DIAS_ABREV = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
export const DIAS_LONGO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Data de hoje no fuso de Brasília (YYYY-MM-DD), sem depender do UTC do servidor. */
export function dataIsoBrasilia(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function segundaFeiraAtual() {
  const hoje = dataIsoBrasilia();
  const d = new Date(`${hoje}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysIso(hoje, diff);
}

/** Próxima segunda-feira — semana que o time monta na escala. */
export function segundaFeiraSubsequente() {
  return addDaysIso(segundaFeiraAtual(), 7);
}

export function fmtDataCurta(iso: string) {
  const [, m, dd] = iso.split('-');
  return `${dd}/${m}`;
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** “segunda-feira, 8 de setembro” */
export function fmtDataAgenda(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  });
}

export function fmtDiaCalendario(iso: string) {
  const [, m, dd] = iso.split('-');
  return {
    dia: String(Number(dd)),
    mes: MESES_ABREV[Number(m) - 1] || m,
  };
}

export function fmtSemanaCurta(semanaInicio: string) {
  return `${fmtDataCurta(semanaInicio)}–${fmtDataCurta(addDaysIso(semanaInicio, 6))}`;
}

export function tituloNotificacaoEscala(n: {
  tipo: string;
  mensagem: string;
  nome_regiao?: string | null;
  semana_inicio?: string | null;
}) {
  const semana = n.semana_inicio ? fmtSemanaCurta(n.semana_inicio) : '';
  const regiao = n.nome_regiao ? ` · ${n.nome_regiao}` : '';
  const periodo = semana ? ` · ${semana}` : '';
  if (n.tipo === 'aprovado') return `Escala aprovada${regiao}${periodo}`;
  if (n.tipo === 'recusado') {
    if (/excluíd/i.test(n.mensagem)) return `Escala excluída${regiao}${periodo}`;
    return `Escala recusada${regiao}${periodo}`;
  }
  if (n.tipo === 'pendente_aprovacao') return `Escala para aprovar${regiao}${periodo}`;
  return n.mensagem;
}

export function fmtEnvioQuando(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function diaIndexNaSemana(semanaInicio: string, iso = new Date().toISOString().slice(0, 10)) {
  for (let i = 0; i < 7; i += 1) {
    if (addDaysIso(semanaInicio, i) === iso) return i;
  }
  return null;
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

/** Parte comercial depois de "BURGER KING": "408 SUL", "201 NORTE", "LAGO SUL". */
export function nomeLocalLojaBk(nome?: string | null) {
  return String(nome || '')
    .replace(/^BURGER\s*KING\s*/i, '')
    .replace(/^BK\s+/i, '')
    .replace(/^[-–·:|]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function ehLojaDeliveryNome(nome?: string | null) {
  return /^deliv/i.test(String(nome || '').trim());
}

export function ehLojaPopeyes(nome?: string | null) {
  return /POPEYES|POPYES/i.test(String(nome || ''));
}

/** Rótulo interno da operação: "BK 408 SUL", "BK 201 NORTE". */
export function rotuloBkLoja(
  bk?: string | null,
  nome?: string | null,
  opts?: { delivery?: boolean },
) {
  const raw = String(nome || '').trim();
  if (opts?.delivery || ehLojaDeliveryNome(raw)) return raw || 'DELIVERY';
  if (ehLojaPopeyes(raw)) {
    const local = raw.replace(/^POPEYES\s*/i, '').replace(/^[-–·:|]+\s*/, '').trim();
    return local ? `POP ${local.toUpperCase()}` : 'POPEYES';
  }
  const local = nomeLocalLojaBk(raw);
  if (local) return local.startsWith('BK ') ? local : `BK ${local}`;
  const num = String(bk || '').trim();
  return num ? `BK ${num}` : raw || 'Loja';
}

export function nomesMontadaPorRegiao(st: {
  pessoas?: Array<{ nome: string }>;
  nome_submetido_por?: string | null;
  nome_ultimo_envio?: string | null;
}): string | null {
  // Só quem enviou/montou a escala — não quem tem visita na grade.
  if (st.nome_submetido_por) return primeiroNome(st.nome_submetido_por);
  if (st.nome_ultimo_envio) return primeiroNome(st.nome_ultimo_envio);
  return null;
}

const CHAVES_TODAS_LOJAS = ['igor', 'renato'];

function normNomePaleta(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Igor e Renato visitam a rede toda — um card, não um por região. */
export function pessoaVisitaTodasLojas(nome?: string | null, flag?: boolean | null) {
  if (flag === true) return true;
  const n = normNomePaleta(String(nome || ''));
  if (!n) return false;
  return CHAVES_TODAS_LOJAS.some((chave) => n === chave || n.startsWith(`${chave} `));
}

export type CardAprovacaoEscala = {
  key: string;
  tipo: 'regiao' | 'pessoa';
  titulo: string;
  montadaPor: string | null;
  status: 'rascunho' | 'pendente_aprovacao' | 'aprovado';
  ids_regiao: number[];
  ids_regiao_aprovar: number[];
  id_usuario?: number | null;
  id_regiao?: number | null;
  id_envio?: number | null;
  nome_regiao?: string | null;
};

export type EnvioAprovacaoEscala = {
  tipo?: string | null;
  id_regiao?: number | null;
  nome_regiao?: string | null;
  submetido_por?: number | null;
  nome_submetido_por?: string | null;
  id_envio?: number | null;
  status?: string | null;
  submetido_em?: string | null;
};

/**
 * Cards a partir do último envio por (pessoa, região) — sem sobrescrever.
 * Igor/Renato → 1 card; regional → 1 card da região dele.
 * Envios velhos de semana já montada (região ainda em rascunho) não entram.
 */
export function montarCardsAprovacaoEscala(
  statusPorRegiao: Array<{
    id_regiao: number;
    nome_regiao: string;
    status: 'rascunho' | 'pendente_aprovacao' | 'aprovado';
    submetido_por?: number | null;
    nome_submetido_por?: string | null;
    nome_ultimo_envio?: string | null;
    id_envio?: number | null;
    pessoas?: Array<{ id_usuario: number; nome: string }>;
  }> = [],
  regionais: Array<{ id_usuario: number; nome: string; todas_lojas?: boolean }> = [],
  idUsuarioFiltro?: number | null,
  envios: EnvioAprovacaoEscala[] = [],
): CardAprovacaoEscala[] {
  const idsTodas = new Set(
    regionais.filter((r) => pessoaVisitaTodasLojas(r.nome, r.todas_lojas)).map((r) => Number(r.id_usuario)),
  );
  const nomePorId = new Map(regionais.map((r) => [Number(r.id_usuario), r.nome]));
  const regioesEmFluxo = new Set(
    statusPorRegiao
      .filter((s) => s.status === 'pendente_aprovacao' || s.status === 'aprovado')
      .map((s) => Number(s.id_regiao)),
  );

  const latest = new Map<string, EnvioAprovacaoEscala>();
  const ordenados = [...envios]
    .filter((e) => String(e.tipo || 'regiao') !== 'delivery' && e.id_regiao != null && e.submetido_por != null)
    .sort((a, b) => {
      const ta = a.submetido_em ? Date.parse(String(a.submetido_em)) : 0;
      const tb = b.submetido_em ? Date.parse(String(b.submetido_em)) : 0;
      if (tb !== ta) return tb - ta;
      return Number(b.id_envio || 0) - Number(a.id_envio || 0);
    });
  for (const e of ordenados) {
    const chave = `${Number(e.submetido_por)}:${Number(e.id_regiao)}`;
    if (!latest.has(chave)) latest.set(chave, e);
  }

  const ultimos = [...latest.values()].filter((e) => {
    const st = String(e.status || 'pendente_aprovacao');
    if (st === 'devolvido' || st === 'rascunho') return false;
    if (st !== 'pendente_aprovacao' && st !== 'aprovado') return false;
    // Semana já montada / em uso: região ficou rascunho e o envio velho não pede aprovação.
    if (!regioesEmFluxo.has(Number(e.id_regiao))) return false;
    if (idUsuarioFiltro != null && Number(e.submetido_por) !== Number(idUsuarioFiltro)) return false;
    return true;
  });

  const globais = new Map<
    number,
    {
      nome: string;
      ids: number[];
      idsAprovar: number[];
      status: CardAprovacaoEscala['status'];
      id_envio: number | null;
    }
  >();
  const regioes: CardAprovacaoEscala[] = [];

  for (const e of ultimos) {
    const idUser = Number(e.submetido_por);
    const idRegiao = Number(e.id_regiao);
    const statusEnvio =
      String(e.status) === 'aprovado' ? ('aprovado' as const) : ('pendente_aprovacao' as const);
    const nome = e.nome_submetido_por || nomePorId.get(idUser) || 'Escala';

    if (idsTodas.has(idUser)) {
      const atual = globais.get(idUser) || {
        nome,
        ids: [],
        idsAprovar: [],
        status: statusEnvio,
        id_envio: e.id_envio != null ? Number(e.id_envio) : null,
      };
      if (!atual.ids.includes(idRegiao)) atual.ids.push(idRegiao);
      if (statusEnvio === 'pendente_aprovacao' && !atual.idsAprovar.includes(idRegiao)) {
        atual.idsAprovar.push(idRegiao);
      }
      if (statusEnvio === 'pendente_aprovacao') atual.status = 'pendente_aprovacao';
      else if (atual.status !== 'pendente_aprovacao') atual.status = 'aprovado';
      if (e.id_envio != null) atual.id_envio = Number(e.id_envio);
      globais.set(idUser, atual);
      continue;
    }

    regioes.push({
      key: `regiao-${idRegiao}-u${idUser}`,
      tipo: 'regiao',
      titulo: e.nome_regiao || `Região ${idRegiao}`,
      montadaPor: primeiroNome(nome),
      status: statusEnvio,
      ids_regiao: [idRegiao],
      ids_regiao_aprovar: statusEnvio === 'pendente_aprovacao' ? [idRegiao] : [],
      id_regiao: idRegiao,
      id_envio: e.id_envio != null ? Number(e.id_envio) : null,
      id_usuario: idUser,
      nome_regiao: e.nome_regiao ?? null,
    });
  }

  const cardsPessoa: CardAprovacaoEscala[] = [...globais.entries()].map(([id, g]) => ({
    key: `pessoa-${id}`,
    tipo: 'pessoa' as const,
    titulo: primeiroNome(g.nome),
    montadaPor: primeiroNome(g.nome),
    status: g.status,
    ids_regiao: g.ids,
    ids_regiao_aprovar: g.idsAprovar,
    id_usuario: id,
    id_envio: g.id_envio,
  }));

  const ordem = (c: CardAprovacaoEscala) =>
    (c.status === 'pendente_aprovacao' ? 0 : 1) * 10 + (c.tipo === 'pessoa' ? 0 : 1);
  return [...cardsPessoa, ...regioes].sort((a, b) => ordem(a) - ordem(b));
}

export type GrupoRegionaisEscala<T extends { grupo_nome?: string | null }> = {
  nome: string | null;
  items: T[];
};

/** Agrupa regionais já ordenados para legenda e seletor da escala. */
export function agruparRegionaisEscala<T extends { grupo_nome?: string | null }>(
  regionais: T[],
): GrupoRegionaisEscala<T>[] {
  const grupos: GrupoRegionaisEscala<T>[] = [];
  for (const regional of regionais) {
    const nome = regional.grupo_nome ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || ultimo.nome !== nome) {
      grupos.push({ nome, items: [regional] });
    } else {
      ultimo.items.push(regional);
    }
  }
  return grupos;
}
