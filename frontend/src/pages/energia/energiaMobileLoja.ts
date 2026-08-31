import { getUsuario, lojaEstoqueTravadaMobile } from '../../lib/auth';
import type { Loja } from '../../api/client';

/** Mesma chave da aba Estoque — a loja escolhida permanece ao trocar de aba. */
export const LOJA_STORAGE_KEY = 'estoque.id_loja';

export function nomeLoja(l: Loja) {
  return String(l.name || '').trim() || 'Loja';
}

export function rotuloLoja(l: Loja) {
  const nome = nomeLoja(l);
  return l.bk_number ? `${l.bk_number} · ${nome}` : nome;
}

export function idLojaInicialStorage(): number | '' {
  const u = getUsuario();
  if (lojaEstoqueTravadaMobile(u) && u?.lojas?.[0]?.id_loja) return u.lojas[0].id_loja;
  if (u?.lojas?.length === 1) return u.lojas[0].id_loja;
  const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
  return Number.isFinite(saved) && saved > 0 ? saved : '';
}

export function preferenciaLojaInicial(rows: Loja[]): number | null {
  if (!rows.length) return null;
  const user = getUsuario();
  const lojasUser = user?.lojas ?? [];
  if (lojaEstoqueTravadaMobile(user) && lojasUser.length) {
    const match = rows.find((l) => lojasUser.some((u) => u.id_loja === l.id_loja));
    if (match) return match.id_loja;
  }
  if (lojasUser.length === 1) {
    const match = rows.find((l) => l.id_loja === lojasUser[0].id_loja);
    if (match) return match.id_loja;
  }
  const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
  if (Number.isFinite(saved) && saved > 0 && rows.some((l) => l.id_loja === saved)) {
    return saved;
  }
  return rows[0].id_loja;
}

export function persistirLoja(id: number) {
  localStorage.setItem(LOJA_STORAGE_KEY, String(id));
}

export function travarScrollPagina(ativo: boolean) {
  const scrollEl = document.querySelector('.ck-visitas__scroll') as HTMLElement | null;
  if (!ativo) {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    if (scrollEl) scrollEl.style.overflow = '';
    return;
  }
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  if (scrollEl) scrollEl.style.overflow = 'hidden';
}
