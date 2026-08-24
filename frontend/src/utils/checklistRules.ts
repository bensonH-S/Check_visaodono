import type { Pergunta } from '../api/client';

/** Máximo de fotos por pergunta no checklist. */
export const MAX_FOTOS_POR_PERGUNTA = 5;

const PADROES_SIM_INDICA_PROBLEMA = [
  /foi encontrad/i,
  /há presença/i,
  /ha presenca/i,
  /evidência de/i,
  /evidencia de/i,
  /possui alguma obstru/i,
  /existe vazamento/i,
  /há vazamento/i,
  /ha vazamento/i,
];

export function maxFotos(limite?: number): number {
  const n = Number(limite);
  if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), 10);
  return MAX_FOTOS_POR_PERGUNTA;
}

export function respostaSimNaoEscolhida(resposta?: 'Sim' | 'Não' | 'N/A'): boolean {
  return resposta === 'Sim' || resposta === 'Não';
}

/** Perguntas em que "Sim" = problema (ex.: obstrução na pia). */
export function simIndicaProblema(p: Pick<Pergunta, 'texto' | 'sim_indica_problema'>): boolean {
  if (p.sim_indica_problema === true) return true;
  if (p.sim_indica_problema === false) return false;
  return PADROES_SIM_INDICA_PROBLEMA.some((re) => re.test(p.texto || ''));
}

/** Resposta que gera perda de ponto / NC nesta pergunta. */
export function respostaIndicaProblema(
  p: Pick<Pergunta, 'texto' | 'sim_indica_problema'>,
  resposta?: 'Sim' | 'Não' | 'N/A',
): boolean {
  if (!resposta || resposta === 'N/A') return false;
  if (simIndicaProblema(p)) return resposta === 'Sim';
  return resposta === 'Não';
}

/** Obs só em Sim (mesa de sanduíches) — identifica pelo texto, não pelo código. */
export function isObsSomenteEmSim(p: Pergunta): boolean {
  return /mesa de preparação de sanduíches/i.test(p.texto || '');
}

/** Exibir bloco de foto na UI (somente após responder Sim/Não ou escolher estrelas). */
export function exibeFoto(
  p: Pergunta,
  resposta?: 'Sim' | 'Não' | 'N/A',
  notaEstrelas?: number,
): boolean {
  if (p.tipo_resposta === 'estrelas_foto') {
    return notaEstrelas != null && notaEstrelas >= 1;
  }

  if (p.tipo_resposta !== 'sim_nao_foto') return false;

  return respostaSimNaoEscolhida(resposta);
}

/** Foto obrigatória para avançar — só quando marcado na pergunta (requer_foto). */
export function exigeFoto(
  p: Pergunta,
  resposta?: 'Sim' | 'Não' | 'N/A',
  fotos: string[] = [],
  notaEstrelas?: number,
): boolean {
  if (!exibeFoto(p, resposta, notaEstrelas)) return false;
  if (!p.requer_foto) return false;
  return fotos.length === 0;
}

/** Campo de observação — opcional em todas; obrigatório só na resposta problemática quando requer_obs_em_nao. */
export function exibeObservacao(
  p: Pergunta,
  resposta?: 'Sim' | 'Não' | 'N/A',
  notaEstrelas?: number,
): boolean {
  if (p.tipo_resposta === 'estrelas' || p.tipo_resposta === 'estrelas_foto') {
    return notaEstrelas != null && notaEstrelas >= 1;
  }
  if (isObsSomenteEmSim(p)) return resposta === 'Sim';
  return respostaSimNaoEscolhida(resposta);
}

export function exigeObservacao(
  p: Pergunta,
  resposta?: 'Sim' | 'Não' | 'N/A',
  obs?: string
): boolean {
  if (!exibeObservacao(p, resposta)) return false;
  if (isObsSomenteEmSim(p)) return false;
  if (!p.requer_obs_em_nao) return false;
  if (!respostaIndicaProblema(p, resposta)) return false;
  return !obs?.trim();
}

/** Ao mudar Sim/Não, limpar foto se não for mais exibir. */
export function deveLimparFotos(p: Pergunta, novaResposta?: 'Sim' | 'Não' | 'N/A'): boolean {
  if (p.tipo_resposta === 'sim_nao_foto' && respostaSimNaoEscolhida(novaResposta)) {
    return false;
  }
  return !exibeFoto(p, novaResposta);
}

export function deveLimparObservacao(
  p: Pergunta,
  novaResposta?: 'Sim' | 'Não' | 'N/A',
  novaNota?: number,
): boolean {
  return !exibeObservacao(p, novaResposta, novaNota);
}

export function parseFotos(foto_url?: string): string[] {
  if (!foto_url) return [];
  const t = foto_url.trim();
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t) as unknown;
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [t];
    } catch {
      return [t];
    }
  }
  return [t];
}

/** Data URLs ou URLs da API para exibir no preview. */
export function urlFoto(src: string): string {
  if (src.startsWith('data:') || src.startsWith('http')) return src;
  if (src.startsWith('/')) return src;
  return src;
}

export function parseMidiaUrls(midia_urls?: string[]): string[] {
  return (midia_urls || []).filter(Boolean);
}

export function serializeFotos(fotos: string[]): string | null {
  const limpas = fotos.filter(Boolean);
  if (!limpas.length) return null;
  if (limpas.length === 1) return limpas[0];
  return JSON.stringify(limpas);
}
