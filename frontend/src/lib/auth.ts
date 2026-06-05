export type PerfilUsuario = 'administrador' | 'coordenador' | 'gerente' | 'tecnico' | 'ti';

export type LojaResumo = {
  id_loja: number;
  nome: string;
  codigo_bkn?: string | null;
};

export type UsuarioSessao = {
  id_usuario: number;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  cargo?: string;
  avatar_inicial?: string;
  lojas: LojaResumo[];
  permissoes: string[];
  acesso_todas_lojas?: boolean;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUsuario(): UsuarioSessao | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('usuario');
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as UsuarioSessao;
    if (!u.permissoes) u.permissoes = [];
    return u;
  } catch {
    return null;
  }
}

export function setSessao(accessToken: string, usuario: UsuarioSessao) {
  localStorage.setItem('token', accessToken);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}

export function temPermissao(codigo: string, usuario?: UsuarioSessao | null) {
  const u = usuario ?? getUsuario();
  return (u?.permissoes || []).includes(codigo);
}

export function labelPerfil(perfil: string) {
  const map: Record<string, string> = {
    administrador: 'Administrador',
    coordenador: 'Coordenador',
    gerente: 'Gerente',
    tecnico: 'Técnico',
    ti: 'TI',
  };
  return map[perfil] || perfil;
}
