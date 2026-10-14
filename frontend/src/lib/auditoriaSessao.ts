const STORAGE_KEY = 'auditoria_sessao_id';

export function getAuditoriaSessaoId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setAuditoriaSessaoId(id: number) {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* ignore */
  }
}

export function clearAuditoriaSessaoId() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
