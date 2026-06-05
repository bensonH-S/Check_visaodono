import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authMiddleware, signToken } from '../auth.js';

const router = Router();

function mapUsuario(row) {
  return {
    id_usuario: row.id_usuario,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil,
    cargo: row.cargo,
    avatar_inicial: row.avatar_inicial,
    id_loja: row.id_loja,
    loja_nome: row.loja_nome ?? null,
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    const senha = req.body.senha;
    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
    }

    const { rows } = await pool.query(
      `SELECT u.*, l.name AS loja_nome
       FROM usuarios u
       LEFT JOIN lojas l ON l.id_loja = u.id_loja
       WHERE LOWER(u.email) = $1 AND u.ativo = TRUE`,
      [email],
    );
    const user = rows[0];
    if (!user?.senha_hash) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const usuario = mapUsuario(user);
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
      `SELECT u.*, l.name AS loja_nome
       FROM usuarios u
       LEFT JOIN lojas l ON l.id_loja = u.id_loja
       WHERE u.id_usuario = $1 AND u.ativo = TRUE`,
      [req.user.sub],
    );
    if (!rows[0]) return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    res.json(mapUsuario(rows[0]));
  } catch (e) {
    next(e);
  }
});

export default router;
