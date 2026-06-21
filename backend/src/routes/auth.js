import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authMiddleware, signToken } from '../auth.js';
import { carregarLojasDetalhe } from '../lojasUsuario.js';
import { acessoTodasLojas, carregarPermissoesUsuario } from '../permissoes.js';
import { logger } from '../logger.js';

const router = Router();

async function mapUsuario(row) {
  const permissoes = await carregarPermissoesUsuario(row.id_usuario);
  const userCtx = { sub: row.id_usuario, perfil: row.perfil, permissoes };
  const lojas = await carregarLojasDetalhe(userCtx);
  return {
    id_usuario: row.id_usuario,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil,
    cargo: row.cargo_nome || row.cargo,
    cargo_aprovacao: row.cargo_aprovacao || null,
    cargo_nome: row.cargo_nome || null,
    avatar_inicial: row.avatar_inicial,
    lojas,
    permissoes,
    acesso_todas_lojas: acessoTodasLojas(userCtx),
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = req.body.senha;
    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM usuarios WHERE LOWER(email) = $1 AND ativo = TRUE`,
      [email],
    );
    const user = rows[0];
    if (!user?.senha_hash) {
      logger.warn('auth', 'Login falhou — usuário não encontrado', { email });
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) {
      logger.warn('auth', 'Login falhou — senha incorreta', { email, idUsuario: user.id_usuario });
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const usuario = await mapUsuario(user);
    logger.info('auth', 'Login OK', { email, idUsuario: user.id_usuario, perfil: user.perfil });
    res.json({
      accessToken: signToken(usuario),
      usuario,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.*, cg.nome AS cargo_nome
       FROM usuarios u
       LEFT JOIN cargos cg ON cg.codigo = u.cargo_aprovacao
       WHERE u.id_usuario = $1 AND u.ativo = TRUE`,
      [req.user.sub],
    );
    if (!rows[0]) return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    res.json(await mapUsuario(rows[0]));
  } catch (e) {
    next(e);
  }
});

export default router;
