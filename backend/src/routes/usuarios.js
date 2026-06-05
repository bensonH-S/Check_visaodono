import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireRoles, veTodasLojas } from '../auth.js';
import { syncUsuarioLojas, carregarLojasDetalhe } from '../lojasUsuario.js';

const router = Router();

const PERFIS_VALIDOS = ['administrador', 'coordenador', 'gerente', 'tecnico', 'ti'];

function iniciais(nome) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

async function mapUsuarioGestao(row) {
  const lojas = await carregarLojasDetalhe(row.perfil, row.id_usuario);
  return {
    id_usuario: row.id_usuario,
    nome: row.nome,
    email: row.email,
    cargo: row.cargo,
    avatar_inicial: row.avatar_inicial,
    perfil: row.perfil,
    lojas,
    lojas_ids: lojas.map((l) => l.id_loja),
    ativo: row.ativo,
    acesso_todas_lojas: veTodasLojas(row.perfil),
  };
}

const SQL_USUARIO = `SELECT id_usuario, nome, email, cargo, avatar_inicial, perfil::text AS perfil, ativo FROM usuarios`;

router.get('/', requireRoles('administrador', 'coordenador'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`${SQL_USUARIO} WHERE ativo = TRUE ORDER BY nome`);
    res.json(
      await Promise.all(
        rows.map(async (r) => ({
          id_usuario: r.id_usuario,
          nome: r.nome,
          email: r.email,
          cargo: r.cargo,
          avatar_inicial: r.avatar_inicial,
          perfil: r.perfil,
          ativo: r.ativo,
        })),
      ),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/gestao', requireRoles('ti'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`${SQL_USUARIO} ORDER BY ativo DESC, nome`);
    res.json(await Promise.all(rows.map(mapUsuarioGestao)));
  } catch (e) {
    next(e);
  }
});

router.get('/gestao/:id', requireRoles('ti'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${SQL_USUARIO} WHERE id_usuario = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(await mapUsuarioGestao(rows[0]));
  } catch (e) {
    next(e);
  }
});

function validarLojas(perfil, lojasIds) {
  if (veTodasLojas(perfil)) return null;
  const ids = [...new Set((lojasIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return 'Selecione ao menos uma loja para este perfil';
  return null;
}

router.post('/gestao', requireRoles('ti'), async (req, res, next) => {
  try {
    const { nome, email, senha, perfil, lojas_ids, ativo } = req.body;
    const emailNorm = String(email || '').trim().toLowerCase();

    if (!nome?.trim() || !emailNorm || !senha || senha.length < 6) {
      return res.status(400).json({ error: 'Nome, e-mail e senha (mín. 6) são obrigatórios' });
    }
    if (!PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }
    const errLojas = validarLojas(perfil, lojas_ids);
    if (errLojas) return res.status(400).json({ error: errLojas });

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, cargo, avatar_inicial, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, $5, $6::perfil_usuario, COALESCE($7, TRUE))
       RETURNING id_usuario, nome, email, cargo, avatar_inicial, perfil::text AS perfil, ativo`,
      [nome.trim(), emailNorm, perfil, iniciais(nome), hash, perfil, ativo],
    );

    await syncUsuarioLojas(rows[0].id_usuario, perfil, lojas_ids);
    res.status(201).json(await mapUsuarioGestao(rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado' });
    next(e);
  }
});

router.patch('/gestao/:id', requireRoles('ti'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nome, email, senha, perfil, lojas_ids, ativo } = req.body;

    const atual = await pool.query(
      'SELECT id_usuario, perfil::text AS perfil FROM usuarios WHERE id_usuario = $1',
      [id],
    );
    if (!atual.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (Number(req.user.sub) === id && ativo === false) {
      return res.status(400).json({ error: 'Você não pode desativar seu próprio usuário' });
    }

    const perfilFinal = perfil ?? atual.rows[0].perfil;
    if (perfil && !PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }
    if (lojas_ids !== undefined || perfil) {
      const errLojas = validarLojas(perfilFinal, lojas_ids);
      if (errLojas) return res.status(400).json({ error: errLojas });
    }

    const sets = [];
    const vals = [];
    let i = 1;

    if (nome?.trim()) {
      sets.push(`nome = $${i++}`);
      vals.push(nome.trim());
      sets.push(`avatar_inicial = $${i++}`);
      vals.push(iniciais(nome));
    }
    if (email) {
      sets.push(`email = $${i++}`);
      vals.push(String(email).trim().toLowerCase());
    }
    if (perfil) {
      sets.push(`perfil = $${i++}::perfil_usuario`);
      vals.push(perfil);
      sets.push(`cargo = $${i++}`);
      vals.push(perfil);
    }
    if (ativo !== undefined) {
      sets.push(`ativo = $${i++}`);
      vals.push(!!ativo);
    }
    if (senha && senha.length >= 6) {
      const hash = await bcrypt.hash(senha, 10);
      sets.push(`senha_hash = $${i++}`);
      vals.push(hash);
    }

    if (sets.length) {
      vals.push(id);
      await pool.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id_usuario = $${i}`, vals);
    }

    if (lojas_ids !== undefined || perfil) {
      const ids = lojas_ids !== undefined ? lojas_ids : undefined;
      if (ids !== undefined || perfil) {
        const { rows: u } = await pool.query(
          'SELECT perfil::text AS perfil FROM usuarios WHERE id_usuario = $1',
          [id],
        );
        const { rows: atuais } = await pool.query(
          'SELECT id_loja FROM usuario_lojas WHERE id_usuario = $1',
          [id],
        );
        await syncUsuarioLojas(
          id,
          u[0].perfil,
          ids !== undefined ? ids : atuais.map((r) => r.id_loja),
        );
      }
    }

    const { rows } = await pool.query(`${SQL_USUARIO} WHERE id_usuario = $1`, [id]);
    res.json(await mapUsuarioGestao(rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado' });
    next(e);
  }
});

export default router;
