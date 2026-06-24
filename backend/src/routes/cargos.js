import { Router } from 'express';
import { pool } from '../db.js';
import { requirePermissao } from '../permissoes.js';

const router = Router();

function slugCodigo(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

async function codigoDisponivel(codigo, ignorarId = null) {
  const params = [codigo];
  let sql = 'SELECT id_cargo FROM cargos WHERE codigo = $1';
  if (ignorarId) {
    params.push(ignorarId);
    sql += ' AND id_cargo <> $2';
  }
  const { rows } = await pool.query(sql, params);
  return !rows.length;
}

router.get('/', async (req, res, next) => {
  try {
    const aprovador = req.query.aprovador === '1';
    const params = [];
    let filtro = 'WHERE ativo = TRUE';
    if (aprovador) filtro += ' AND aprovador = TRUE';
    const { rows } = await pool.query(
      `SELECT id_cargo, nome, codigo, aprovador, ativo, descricao
       FROM cargos ${filtro}
       ORDER BY nome`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/gestao', requirePermissao('configuracoes.ver'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_cargo, nome, codigo, aprovador, ativo, descricao, created_at
       FROM cargos
       ORDER BY ativo DESC, nome`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/gestao', requirePermissao('configuracoes.ver'), async (req, res, next) => {
  try {
    const nome = String(req.body?.nome || '').trim();
    const descricao = req.body?.descricao != null ? String(req.body.descricao).trim() || null : null;
    const aprovador = !!req.body?.aprovador;
    const ativo = req.body?.ativo !== false;
    if (nome.length < 2) {
      return res.status(400).json({ error: 'Informe o nome do cargo (mín. 2 caracteres)' });
    }

    let codigo = slugCodigo(req.body?.codigo || nome);
    if (!codigo) codigo = `cargo_${Date.now()}`;
    let tentativa = codigo;
    let i = 2;
    while (!(await codigoDisponivel(tentativa))) {
      tentativa = `${codigo}_${i++}`;
    }

    const { rows } = await pool.query(
      `INSERT INTO cargos (nome, codigo, aprovador, ativo, descricao)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_cargo, nome, codigo, aprovador, ativo, descricao, created_at`,
      [nome, tentativa, aprovador, ativo, descricao],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Já existe um cargo com este código' });
    next(e);
  }
});

router.patch('/gestao/:id', requirePermissao('configuracoes.ver'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { nome, descricao, aprovador, ativo } = req.body;

    const atual = await pool.query('SELECT id_cargo FROM cargos WHERE id_cargo = $1', [id]);
    if (!atual.rows[0]) return res.status(404).json({ error: 'Cargo não encontrado' });

    const sets = [];
    const vals = [];
    let i = 1;

    if (nome !== undefined) {
      const n = String(nome).trim();
      if (n.length < 2) return res.status(400).json({ error: 'Nome do cargo inválido' });
      sets.push(`nome = $${i++}`);
      vals.push(n);
    }
    if (descricao !== undefined) {
      sets.push(`descricao = $${i++}`);
      vals.push(descricao != null ? String(descricao).trim() || null : null);
    }
    if (aprovador !== undefined) {
      sets.push(`aprovador = $${i++}`);
      vals.push(!!aprovador);
    }
    if (ativo !== undefined) {
      sets.push(`ativo = $${i++}`);
      vals.push(!!ativo);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });

    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE cargos SET ${sets.join(', ')} WHERE id_cargo = $${i}
       RETURNING id_cargo, nome, codigo, aprovador, ativo, descricao, created_at`,
      vals,
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/gestao/:id', requirePermissao('configuracoes.ver'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT id_cargo, nome, codigo FROM cargos WHERE id_cargo = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cargo não encontrado' });

    const codigo = rows[0].codigo;
    const { rows: refs } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM usuarios WHERE cargo_aprovacao = $1) AS usuarios,
         (SELECT COUNT(*)::int FROM manut_chamados WHERE aprovacao_destino = $1) AS chamados`,
      [codigo],
    );
    const { usuarios, chamados } = refs[0];
    if (usuarios > 0 || chamados > 0) {
      const partes = [];
      if (usuarios > 0) partes.push(`${usuarios} usuário(s)`);
      if (chamados > 0) partes.push(`${chamados} chamado(s)`);
      return res.status(409).json({
        error: `Não é possível excluir: cargo vinculado a ${partes.join(' e ')}. Desative o cargo em vez de excluir.`,
      });
    }

    await pool.query('DELETE FROM cargos WHERE id_cargo = $1', [id]);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export async function validarCodigoCargo(codigo, { exigirAprovador = false } = {}) {
  if (!codigo) return null;
  const c = String(codigo).trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT codigo, aprovador FROM cargos WHERE codigo = $1 AND ativo = TRUE`,
    [c],
  );
  if (!rows[0]) return { error: 'Cargo inválido ou inativo' };
  if (exigirAprovador && !rows[0].aprovador) {
    return { error: 'Este cargo não pode aprovar orçamentos' };
  }
  return rows[0].codigo;
}

export async function nomeCargo(codigo) {
  if (!codigo) return '';
  const { rows } = await pool.query('SELECT nome FROM cargos WHERE codigo = $1', [codigo]);
  return rows[0]?.nome || codigo;
}

export default router;
