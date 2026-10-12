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

/** Sincroniza cache local com a foto da sessão (login /me / edição). */
export function sincronizarFotoPerfilSessao(idUsuario: number, avatarUrl?: string | null) {
  if (!idUsuario) return;
  if (avatarUrl) setFotoPerfil(idUsuario, avatarUrl);
  else removerFotoPerfil(idUsuario);
  notificarFotoPerfilAtualizada();
}

/** Redimensiona e comprime a foto para data URL JPEG (~160px). */
export function redimensionarFotoPerfil(file: File, maxLado = 160, qualidade = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione uma imagem (JPEG, PNG ou WebP).'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Erro ao processar a foto.'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem.'));
    };
    img.src = url;
  });
}
