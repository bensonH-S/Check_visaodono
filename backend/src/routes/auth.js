import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authMiddleware, signToken, veTodasLojas } from '../auth.js';
import { carregarLojasDetalhe } from '../lojasUsuario.js';

const router = Router();

async function mapUsuario(row) {
  const lojas = await carregarLojasDetalhe(row.perfil, row.id_usuario);
  return {
    id_usuario: row.id_usuario,
    nome: row.nome,
    email: row.email,
    perfil: row.perfil,
    cargo: row.cargo,
    avatar_inicial: row.avatar_inicial,
    lojas,
    acesso_todas_lojas: veTodasLojas(row.perfil),
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
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const usuario = await mapUsuario(user);
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
      `SELECT * FROM usuarios WHERE id_usuario = $1 AND ativo = TRUE`,
      [req.user.sub],
    );
    if (!rows[0]) return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    res.json(await mapUsuario(rows[0]));
  } catch (e) {
    next(e);
  }
});

export default router;
