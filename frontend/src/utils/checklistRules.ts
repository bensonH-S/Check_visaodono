import type { Pergunta } from '../api/client';

/**
 * Sim = está ok / dentro do padrão → foto só se marcar Não (evidência do problema).
 * Ex.: hortifruti, carnes, limpeza, iluminação funcionando.
 */
const FOTO_QUANDO_NAO = new Set([
  '09', '10', '13', '15', '16', '17', '18', '29',
]);

/**
 * Sim = há problema / risco → foto só se marcar Sim.
 * Ex.: manutenção, danos, risco, desperdício, contaminação, pragas.
 */
const FOTO_QUANDO_SIM = new Set([
  '27', '30', '32', '36', '37',
]);

/** Foto opcional mesmo quando exibida (não bloqueia avançar). */
const FOTO_OPCIONAL = new Set(['26', '37']);

export function maxFotos(p: Pergunta): number {
  if (p.codigo === '26') return 5;
  return 1;
}

export function permiteMultiplasFotos(p: Pergunta): boolean {
  return p.codigo === '26';
}

function usaEstrelasFoto(p: Pergunta) {
  return p.tipo_resposta === 'estrelas_foto' && p.requer_foto;
}

function usaSimNaoFoto(p: Pergunta) {
  return p.tipo_resposta === 'sim_nao_foto' && p.requer_foto;
}

/** Exibir bloco de foto na UI. */
export function exibeFoto(p: Pergunta, resposta?: 'Sim' | 'Não' | 'N/A'): boolean {
  if (!p.requer_foto && p.codigo !== '26') return false;

  if (p.codigo === '26') return true;

  if (usaEstrelasFoto(p)) return true;

  if (!usaSimNaoFoto(p) && !permiteMultiplasFotos(p)) return false;

  if (FOTO_QUANDO_NAO.has(p.codigo)) return resposta === 'Não';
  if (FOTO_QUANDO_SIM.has(p.codigo)) return resposta === 'Sim';

  return false;
}

/** Foto obrigatória para avançar. */
export function exigeFoto(
  p: Pergunta,
  resposta?: 'Sim' | 'Não' | 'N/A',
  fotos: string[] = []
): boolean {
  if (!exibeFoto(p, resposta)) return false;
  if (FOTO_OPCIONAL.has(p.codigo)) return false;
  return fotos.length === 0;
}

/** Campo "o que foi observado". */
export function exibeObservacao(p: Pergunta, resposta?: 'Sim' | 'Não' | 'N/A'): boolean {
  if (p.codigo === '37') return resposta === 'Sim';
  return resposta === 'Não' && p.requer_obs_em_nao;
}

export function exigeObservacao(
  p: Pergunta,
  resposta?: 'Sim' | 'Não' | 'N/A',
  obs?: string
): boolean {
  if (!exibeObservacao(p, resposta)) return false;
  if (p.codigo === '37') return false;
  return resposta === 'Não' && !obs?.trim();
}

/** Ao mudar Sim/Não, limpar foto se não for mais exibir. */
export function deveLimparFotos(p: Pergunta, novaResposta?: 'Sim' | 'Não' | 'N/A'): boolean {
  return !exibeFoto(p, novaResposta);
}

export function deveLimparObservacao(
  p: Pergunta,
  novaResposta?: 'Sim' | 'Não' | 'N/A'
): boolean {
  return !exibeObservacao(p, novaResposta);
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

/** Caminhos /api/uploads ou data URLs para exibir no preview. */
export function urlFoto(src: string): string {
  if (src.startsWith('data:') || src.startsWith('http')) return src;
  if (src.startsWith('/')) return src;
  return src;
}

export function serializeFotos(fotos: string[]): string | null {
  const limpas = fotos.filter(Boolean);
  if (!limpas.length) return null;
  if (limpas.length === 1) return limpas[0];
  return JSON.stringify(limpas);
}
