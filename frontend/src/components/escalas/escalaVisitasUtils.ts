export const DIAS_ABREV = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
export const DIAS_LONGO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function segundaFeiraAtual() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Próxima segunda-feira — semana que o time monta na escala. */
export function segundaFeiraSubsequente() {
  return addDaysIso(segundaFeiraAtual(), 7);
}

export function fmtDataCurta(iso: string) {
  const [, m, dd] = iso.split('-');
  return `${dd}/${m}`;
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

export function nomesMontadaPorRegiao(st: {
  pessoas?: Array<{ nome: string }>;
  nome_submetido_por?: string | null;
  nome_ultimo_envio?: string | null;
}): string | null {
  const daGrade = [...new Set((st.pessoas ?? []).map((p) => primeiroNome(p.nome)).filter(Boolean))];
  if (daGrade.length) return daGrade.join(', ');
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
  }>,
  regionais: Array<{ id_usuario: number; nome: string; todas_lojas?: boolean }>,
  idUsuarioFiltro?: number | null,
): CardAprovacaoEscala[] {
  const idsTodas = new Set(
    regionais.filter((r) => pessoaVisitaTodasLojas(r.nome, r.todas_lojas)).map((r) => Number(r.id_usuario)),
  );
  const nomePorId = new Map(regionais.map((r) => [Number(r.id_usuario), r.nome]));

  const globais = new Map<
    number,
    { nome: string; ids: number[]; idsAprovar: number[]; status: CardAprovacaoEscala['status']; id_envio: number | null }
  >();
  const regioes: CardAprovacaoEscala[] = [];

  const filtrado =
    idUsuarioFiltro == null
      ? statusPorRegiao
      : statusPorRegiao.filter(
          (st) =>
            (st.pessoas ?? []).some((p) => Number(p.id_usuario) === Number(idUsuarioFiltro)) ||
            Number(st.submetido_por) === Number(idUsuarioFiltro),
        );

  for (const st of filtrado) {
    const pessoas = st.pessoas ?? [];
    const regionaisNaRegiao = pessoas.filter((p) => !idsTodas.has(Number(p.id_usuario)));
    const globaisNaRegiao = pessoas.filter((p) => idsTodas.has(Number(p.id_usuario)));
    const pendenteOuAprovado = st.status === 'pendente_aprovacao' || st.status === 'aprovado';

    const idsGlobaisCard =
      globaisNaRegiao.length > 0
        ? globaisNaRegiao.map((p) => Number(p.id_usuario))
        : st.submetido_por != null && idsTodas.has(Number(st.submetido_por)) && regionaisNaRegiao.length === 0
          ? [Number(st.submetido_por)]
          : [];

    for (const id of idsGlobaisCard) {
      const nome = globaisNaRegiao.find((p) => Number(p.id_usuario) === id)?.nome || nomePorId.get(id) || 'Escala';
      const atual = globais.get(id) || {
        nome,
        ids: [],
        idsAprovar: [],
        status: st.status,
        id_envio: st.id_envio ?? null,
      };
      if (!atual.ids.includes(st.id_regiao)) atual.ids.push(st.id_regiao);
      if (pendenteOuAprovado && regionaisNaRegiao.length === 0 && !atual.idsAprovar.includes(st.id_regiao)) {
        atual.idsAprovar.push(st.id_regiao);
      }
      if (st.status === 'pendente_aprovacao') atual.status = 'pendente_aprovacao';
      else if (atual.status !== 'pendente_aprovacao' && st.status === 'aprovado') atual.status = 'aprovado';
      globais.set(id, atual);
    }

    if (regionaisNaRegiao.length > 0 || (st.submetido_por != null && !idsTodas.has(Number(st.submetido_por)))) {
      regioes.push({
        key: `regiao-${st.id_regiao}`,
        tipo: 'regiao',
        titulo: st.nome_regiao,
        montadaPor: nomesMontadaPorRegiao(st),
        status: st.status,
        ids_regiao: [st.id_regiao],
        ids_regiao_aprovar: st.status === 'pendente_aprovacao' ? [st.id_regiao] : [],
        id_regiao: st.id_regiao,
        id_envio: st.id_envio ?? null,
        nome_regiao: st.nome_regiao,
      });
    }
  }

  const cardsPessoa: CardAprovacaoEscala[] = [...globais.entries()]
    .filter(([, g]) => g.status === 'pendente_aprovacao' || g.status === 'aprovado')
    .map(([id, g]) => ({
    key: `pessoa-${id}`,
    tipo: 'pessoa',
    titulo: primeiroNome(g.nome),
    montadaPor: primeiroNome(g.nome),
    status: g.status,
    ids_regiao: g.ids,
    ids_regiao_aprovar: g.idsAprovar,
    id_usuario: id,
    id_envio: g.id_envio,
  }));

  return [...cardsPessoa, ...regioes];
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
