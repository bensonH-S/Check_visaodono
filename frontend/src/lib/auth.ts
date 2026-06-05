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
  acesso_todas_lojas?: boolean;
};

const PERFIS_ABREM_CHAMADO: PerfilUsuario[] = ['gerente', 'coordenador', 'administrador'];
const PERFIS_CHECKLIST: PerfilUsuario[] = ['gerente', 'coordenador', 'administrador'];
const PERFIS_GESTAO: PerfilUsuario[] = ['administrador', 'coordenador', 'ti'];
const PERFIS_GERENCIA_USUARIOS: PerfilUsuario[] = ['ti'];

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUsuario(): UsuarioSessao | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('usuario');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsuarioSessao;
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

export function podeAbrirChamado(perfil: string) {
  return PERFIS_ABREM_CHAMADO.includes(perfil as PerfilUsuario);
}

export function podeFazerChecklist(perfil: string) {
  return PERFIS_CHECKLIST.includes(perfil as PerfilUsuario);
}

export function podeVerGestao(perfil: string) {
  return PERFIS_GESTAO.includes(perfil as PerfilUsuario);
}

export function podeGerenciarUsuarios(perfil: string) {
  return PERFIS_GERENCIA_USUARIOS.includes(perfil as PerfilUsuario);
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
