import type { CategoriaChecklist } from '../api/client';
import { perguntaRespondida, type RespostaLocal } from '../components/checklist/ChecklistPerguntaCard';

export type FaseChecklist = 'setup' | 'iniciada' | 'perguntas';

export type ChecklistSessaoLocal = {
  visitaId: number;
  indiceSecao: number;
  fase: FaseChecklist;
  atualizadoEm: string;
};

const KEY_PREFIX = 'checklist_sessao_';

function chave(userId: number) {
  return `${KEY_PREFIX}${userId}`;
}

export function getSessaoChecklist(userId: number): ChecklistSessaoLocal | null {
  try {
    const raw = localStorage.getItem(chave(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChecklistSessaoLocal;
    if (!parsed?.visitaId || typeof parsed.indiceSecao !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function salvarSessaoChecklist(
  userId: number,
  data: Pick<ChecklistSessaoLocal, 'visitaId' | 'indiceSecao' | 'fase'>,
) {
  try {
    const payload: ChecklistSessaoLocal = {
      ...data,
      atualizadoEm: new Date().toISOString(),
    };
    localStorage.setItem(chave(userId), JSON.stringify(payload));
  } catch {
    /* quota / modo privado */
  }
}

export function limparSessaoChecklist(userId: number) {
  try {
    localStorage.removeItem(chave(userId));
  } catch {
    /* ignore */
  }
}

/** Seção com pergunta obrigatória ainda não respondida (inclui foto/obs. exigidas). */
export function secaoTemPendencia(
  checklist: CategoriaChecklist[],
  respostas: Record<number, RespostaLocal>,
  idx: number,
): boolean {
  const cat = checklist[idx];
  if (!cat) return false;
  return cat.perguntas.some(
    (p) => p.obrigatoria && !perguntaRespondida(p, respostas[p.id_pergunta]),
  );
}

/**
 * Abre na seção onde o usuário parou com respostas pendentes.
 * Prioriza o índice salvo no aparelho; se essa seção já estiver completa, avança
 * para a próxima pendente; sem índice salvo, usa a primeira seção incompleta.
 */
export function indiceSecaoParaRetomar(
  checklist: CategoriaChecklist[],
  respostas: Record<number, RespostaLocal>,
  salvo?: number,
): number {
  if (!checklist.length) return 0;

  const pendente = (i: number) => secaoTemPendencia(checklist, respostas, i);

  if (salvo != null && salvo >= 0 && salvo < checklist.length) {
    if (pendente(salvo)) return salvo;
    for (let i = salvo; i < checklist.length; i++) {
      if (pendente(i)) return i;
    }
    for (let i = 0; i < salvo; i++) {
      if (pendente(i)) return i;
    }
    return salvo;
  }

  for (let i = 0; i < checklist.length; i++) {
    if (pendente(i)) return i;
  }

  return Math.max(0, checklist.length - 1);
}
