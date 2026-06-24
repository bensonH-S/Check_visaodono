import jwt from 'jsonwebtoken';

export const PERFIS = ['administrador', 'coordenador', 'gerente', 'tecnico'];

const SECRET = process.env.JWT_SECRET || 'vision-check-dev-secret-altere-em-producao';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id_usuario,
      email: user.email,
      perfil: user.perfil,
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
