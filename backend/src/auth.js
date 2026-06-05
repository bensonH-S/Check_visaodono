import jwt from 'jsonwebtoken';

export const PERFIS = ['administrador', 'coordenador', 'gerente', 'tecnico'];
export const PERFIS_ABREM_CHAMADO = ['gerente', 'coordenador', 'administrador'];
export const PERFIS_VER_TUDO = ['administrador', 'coordenador'];
export const PERFIS_GESTAO = ['administrador', 'coordenador'];

const SECRET = process.env.JWT_SECRET || 'vision-check-dev-secret-altere-em-producao';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id_usuario,
      email: user.email,
      perfil: user.perfil,
      id_loja: user.id_loja ?? null,
    },
    SECRET,
    { expiresIn: EXPIRES },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user?.perfil || !roles.includes(req.user.perfil)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

export function podeAbrirChamado(perfil) {
  return PERFIS_ABREM_CHAMADO.includes(perfil);
}

export function veTodasLojas(perfil) {
  return PERFIS_VER_TUDO.includes(perfil);
}
