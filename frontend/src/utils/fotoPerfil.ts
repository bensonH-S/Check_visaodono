const STORAGE_PREFIX = 'usuario_foto_perfil:';

export function chaveFotoPerfil(idUsuario: number) {
  return `${STORAGE_PREFIX}${idUsuario}`;
}

export function getFotoPerfil(idUsuario: number): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(chaveFotoPerfil(idUsuario));
}

export function setFotoPerfil(idUsuario: number, dataUrl: string) {
  localStorage.setItem(chaveFotoPerfil(idUsuario), dataUrl);
}

export function removerFotoPerfil(idUsuario: number) {
  localStorage.removeItem(chaveFotoPerfil(idUsuario));
}

export const FOTO_PERFIL_ATUALIZADA_EVENT = 'foto-perfil-atualizada';

export function notificarFotoPerfilAtualizada() {
  window.dispatchEvent(new CustomEvent(FOTO_PERFIL_ATUALIZADA_EVENT));
}
