import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { syncUsuarioLojas, carregarLojasDetalhe } from '../lojasUsuario.js';
import {
  CATALOGO_PERMISSOES,
  acessoTodasLojas,
  carregarPermissoesUsuario,
  requirePermissao,
  normalizarPermissoes,
  permissoesPadraoTi,
  resolverPermissoesUsuario,
  syncUsuarioPermissoes,
} from '../permissoes.js';

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
  const permissoes = await carregarPermissoesUsuario(row.id_usuario);
  const userCtx = { sub: row.id_usuario, perfil: row.perfil, permissoes };
  const lojas = await carregarLojasDetalhe(userCtx);
  return {
    id_usuario: row.id_usuario,
    nome: row.nome,
    email: row.email,
    cargo: row.cargo,
    avatar_inicial: row.avatar_inicial,
    perfil: row.perfil,
    lojas,
    lojas_ids: lojas.map((l) => l.id_loja),
    permissoes,
    ativo: row.ativo,
    acesso_todas_lojas: acessoTodasLojas(userCtx),
  };
}

const SQL_USUARIO = `SELECT id_usuario, nome, email, cargo, avatar_inicial, perfil::text AS perfil, ativo FROM usuarios`;

router.get('/permissoes/catalogo', requirePermissao('usuarios.gerenciar'), (_req, res) => {
  res.json(CATALOGO_PERMISSOES);
});

router.get('/', requirePermissao('usuarios.listar'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`${SQL_USUARIO} WHERE ativo = TRUE ORDER BY nome`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/gestao', requirePermissao('usuarios.gerenciar'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`${SQL_USUARIO} ORDER BY ativo DESC, nome`);
    res.json(await Promise.all(rows.map(mapUsuarioGestao)));
  } catch (e) {
    next(e);
  }
});

router.get('/gestao/:id', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`${SQL_USUARIO} WHERE id_usuario = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(await mapUsuarioGestao(rows[0]));
  } catch (e) {
    next(e);
  }
});

function validarLojas(permissoes, lojasIds) {
  if (acessoTodasLojas({ permissoes })) return null;
  const ids = [...new Set((lojasIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return 'Selecione ao menos uma loja (ou marque "Acesso a todas as lojas")';
  return null;
}

router.post('/gestao', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const { nome, email, senha, perfil, lojas_ids, permissoes, ativo } = req.body;
    const emailNorm = String(email || '').trim().toLowerCase();

    if (!nome?.trim() || !emailNorm || !senha || senha.length < 6) {
      return res.status(400).json({ error: 'Nome, e-mail e senha (mín. 6) são obrigatórios' });
    }
    if (!PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }

    const perms = resolverPermissoesUsuario(perfil, permissoes);
    const errLojas = validarLojas(perms, lojas_ids);
    if (errLojas) return res.status(400).json({ error: errLojas });

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, cargo, avatar_inicial, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, $5, $6::perfil_usuario, COALESCE($7, TRUE))
       RETURNING id_usuario, nome, email, cargo, avatar_inicial, perfil::text AS perfil, ativo`,
      [nome.trim(), emailNorm, perfil, iniciais(nome), hash, perfil, ativo],
    );

    await syncUsuarioPermissoes(rows[0].id_usuario, perms);
    await syncUsuarioLojas(rows[0].id_usuario, lojas_ids, acessoTodasLojas({ permissoes: perms }));
    res.status(201).json(await mapUsuarioGestao(rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado' });
    next(e);
  }
});

router.patch('/gestao/:id', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nome, email, senha, perfil, lojas_ids, permissoes, ativo } = req.body;

    const atual = await pool.query(
      'SELECT id_usuario, perfil::text AS perfil FROM usuarios WHERE id_usuario = $1',
      [id],
    );
    if (!atual.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (Number(req.user.sub) === id && ativo === false) {
      return res.status(400).json({ error: 'Você não pode desativar seu próprio usuário' });
    }

    if (perfil && !PERFIS_VALIDOS.includes(perfil)) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }

    const perfilEfetivo = perfil || atual.rows[0].perfil;
    const virouTi = perfil === 'ti' && atual.rows[0].perfil !== 'ti';
    const permsAtuais =
      permissoes !== undefined
        ? resolverPermissoesUsuario(perfilEfetivo, permissoes)
        : virouTi
          ? permissoesPadraoTi()
          : await carregarPermissoesUsuario(id);

    if (lojas_ids !== undefined || permissoes !== undefined || virouTi) {
      let idsValidar = lojas_ids;
      if (idsValidar === undefined) {
        const { rows: atuais } = await pool.query(
          'SELECT id_loja FROM usuario_lojas WHERE id_usuario = $1',
          [id],
        );
        idsValidar = atuais.map((r) => r.id_loja);
      }
      const errLojas = validarLojas(permsAtuais, idsValidar);
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

    if (permissoes !== undefined || virouTi) {
      await syncUsuarioPermissoes(id, permsAtuais);
    }

    if (lojas_ids !== undefined || permissoes !== undefined || virouTi) {
      const perms = permsAtuais;
      let idsLoja = lojas_ids;
      if (idsLoja === undefined) {
        const { rows: atuais } = await pool.query(
          'SELECT id_loja FROM usuario_lojas WHERE id_usuario = $1',
          [id],
        );
        idsLoja = atuais.map((r) => r.id_loja);
      }
      await syncUsuarioLojas(id, idsLoja, acessoTodasLojas({ permissoes: perms }));
    }

    const { rows } = await pool.query(`${SQL_USUARIO} WHERE id_usuario = $1`, [id]);
    res.json(await mapUsuarioGestao(rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado' });
    next(e);
  }
});

export default router;
