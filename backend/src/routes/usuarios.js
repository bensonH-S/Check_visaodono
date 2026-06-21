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
import { validarCodigoCargo, nomeCargo } from './cargos.js';
import { normalizarTelefoneBr } from '../utils/telefone.js';

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
    cargo_aprovacao: row.cargo_aprovacao || null,
    cargo_nome: row.cargo_nome || null,
    avatar_inicial: row.avatar_inicial,
    perfil: row.perfil,
    lojas,
    lojas_ids: lojas.map((l) => l.id_loja),
    permissoes,
    ativo: row.ativo,
    acesso_todas_lojas: acessoTodasLojas(userCtx),
    telefone_whatsapp: row.telefone_whatsapp || null,
    notifica_whatsapp: row.notifica_whatsapp !== false,
  };
}

const SQL_USUARIO = `
  SELECT u.id_usuario, u.nome, u.email, u.cargo, u.cargo_aprovacao, u.avatar_inicial,
         u.perfil::text AS perfil, u.ativo, u.telefone_whatsapp, u.notifica_whatsapp,
         cg.nome AS cargo_nome
  FROM usuarios u
  LEFT JOIN cargos cg ON cg.codigo = u.cargo_aprovacao`;

router.get('/permissoes/catalogo', requirePermissao('usuarios.gerenciar'), (_req, res) => {
  res.json(CATALOGO_PERMISSOES);
});

router.get('/', requirePermissao('usuarios.listar'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`${SQL_USUARIO} WHERE u.ativo = TRUE ORDER BY nome`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/gestao', requirePermissao('usuarios.gerenciar'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`${SQL_USUARIO} ORDER BY u.ativo DESC, nome`);
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

function perfilInternoDoCargo(codigo) {
  return PERFIS_VALIDOS.includes(codigo) ? codigo : 'gerente';
}

async function resolverCargoUsuario(cargoCodigo, permissoes, { obrigatorio = false } = {}) {
  const exigirAprovador = (permissoes || []).includes('chamados.aprovar');
  if (!cargoCodigo) {
    if (obrigatorio || exigirAprovador) {
      return { error: 'Selecione o perfil' };
    }
    return { codigo: null, nome: null };
  }
  const validado = await validarCodigoCargo(cargoCodigo, { exigirAprovador: false });
  if (!validado || typeof validado === 'object') {
    return { error: validado?.error || 'Perfil inválido ou inativo' };
  }
  if (exigirAprovador) {
    const { rows } = await pool.query(
      'SELECT aprovador FROM cargos WHERE codigo = $1 AND ativo = TRUE',
      [validado],
    );
    if (!rows[0]?.aprovador) {
      return {
        error: 'Usuários que aprovam orçamentos precisam de um perfil aprovador (ex.: Financeiro, Diretor)',
      };
    }
  }
  const nome = await nomeCargo(validado);
  return {
    codigo: validado,
    nome: nome || validado,
    perfil: perfilInternoDoCargo(validado),
  };
}

function validarLojas(permissoes, lojasIds) {
  if (acessoTodasLojas({ permissoes })) return null;
  const ids = [...new Set((lojasIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return 'Selecione ao menos uma loja (ou marque "Acesso a todas as lojas")';
  return null;
}

router.post('/gestao', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const {
      nome,
      email,
      senha,
      lojas_ids,
      permissoes,
      ativo,
      cargo_aprovacao,
      telefone_whatsapp,
      notifica_whatsapp,
    } = req.body;
    const emailNorm = String(email || '').trim().toLowerCase();

    if (!nome?.trim() || !emailNorm || !senha || senha.length < 6) {
      return res.status(400).json({ error: 'Nome, e-mail e senha (mín. 6) são obrigatórios' });
    }

    const permsProv = resolverPermissoesUsuario('gerente', permissoes);
    const cargoRes = await resolverCargoUsuario(cargo_aprovacao, permsProv, { obrigatorio: true });
    if (cargoRes.error) return res.status(400).json({ error: cargoRes.error });

    const perms = resolverPermissoesUsuario(cargoRes.perfil, permissoes);
    const errLojas = validarLojas(perms, lojas_ids);
    if (errLojas) return res.status(400).json({ error: errLojas });

    const telWpp = telefone_whatsapp !== undefined ? normalizarTelefoneBr(telefone_whatsapp) : null;
    if (telefone_whatsapp && !telWpp) {
      return res.status(400).json({ error: 'WhatsApp inválido. Use DDD + número (ex.: 61999998888)' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, cargo, cargo_aprovacao, avatar_inicial, senha_hash, perfil, ativo, telefone_whatsapp, notifica_whatsapp)
       VALUES ($1, $2, $3, $4, $5, $6, $7::perfil_usuario, COALESCE($8, TRUE), $9, COALESCE($10, TRUE))
       RETURNING id_usuario, nome, email, cargo, cargo_aprovacao, avatar_inicial, perfil::text AS perfil, ativo`,
      [
        nome.trim(),
        emailNorm,
        cargoRes.nome,
        cargoRes.codigo,
        iniciais(nome),
        hash,
        cargoRes.perfil,
        ativo,
        telWpp,
        notifica_whatsapp,
      ],
    );

    const idNovo = rows[0].id_usuario;
    await syncUsuarioPermissoes(idNovo, perms);
    await syncUsuarioLojas(idNovo, lojas_ids, acessoTodasLojas({ permissoes: perms }));
    const { rows: completo } = await pool.query(`${SQL_USUARIO} WHERE u.id_usuario = $1`, [idNovo]);
    res.status(201).json(await mapUsuarioGestao(completo[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado' });
    next(e);
  }
});

router.patch('/gestao/:id', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      nome,
      email,
      senha,
      lojas_ids,
      permissoes,
      ativo,
      cargo_aprovacao,
      telefone_whatsapp,
      notifica_whatsapp,
    } = req.body;

    const atual = await pool.query(
      `SELECT id_usuario, perfil::text AS perfil, cargo_aprovacao
       FROM usuarios WHERE id_usuario = $1`,
      [id],
    );
    if (!atual.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (Number(req.user.sub) === id && ativo === false) {
      return res.status(400).json({ error: 'Você não pode desativar seu próprio usuário' });
    }

    const cargoCodigoEfetivo =
      cargo_aprovacao !== undefined ? cargo_aprovacao : atual.rows[0].cargo_aprovacao;
    const perfilEfetivo = cargoCodigoEfetivo
      ? perfilInternoDoCargo(cargoCodigoEfetivo)
      : atual.rows[0].perfil;
    const virouTi =
      cargo_aprovacao === 'ti' && atual.rows[0].cargo_aprovacao !== 'ti';
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
    if (ativo !== undefined) {
      sets.push(`ativo = $${i++}`);
      vals.push(!!ativo);
    }
    if (senha && senha.length >= 6) {
      const hash = await bcrypt.hash(senha, 10);
      sets.push(`senha_hash = $${i++}`);
      vals.push(hash);
    }
    if (cargo_aprovacao !== undefined) {
      const cargoRes = await resolverCargoUsuario(cargo_aprovacao, permsAtuais, { obrigatorio: true });
      if (cargoRes.error) return res.status(400).json({ error: cargoRes.error });
      sets.push(`cargo_aprovacao = $${i++}`);
      vals.push(cargoRes.codigo);
      sets.push(`cargo = $${i++}`);
      vals.push(cargoRes.nome);
      sets.push(`perfil = $${i++}::perfil_usuario`);
      vals.push(cargoRes.perfil);
    } else if (permissoes !== undefined && permsAtuais.includes('chamados.aprovar')) {
      const cargoRes = await resolverCargoUsuario(atual.rows[0].cargo_aprovacao, permsAtuais);
      if (cargoRes.error) return res.status(400).json({ error: cargoRes.error });
    }

    if (telefone_whatsapp !== undefined) {
      const telWpp = telefone_whatsapp ? normalizarTelefoneBr(telefone_whatsapp) : null;
      if (telefone_whatsapp && !telWpp) {
        return res.status(400).json({ error: 'WhatsApp inválido. Use DDD + número (ex.: 61999998888)' });
      }
      sets.push(`telefone_whatsapp = $${i++}`);
      vals.push(telWpp);
    }
    if (notifica_whatsapp !== undefined) {
      sets.push(`notifica_whatsapp = $${i++}`);
      vals.push(!!notifica_whatsapp);
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

    const { rows } = await pool.query(`${SQL_USUARIO} WHERE u.id_usuario = $1`, [id]);
    res.json(await mapUsuarioGestao(rows[0]));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado' });
    next(e);
  }
});

router.delete('/gestao/:id', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });

    if (Number(req.user.sub) === id) {
      return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
    }

    const { rows } = await pool.query(
      'SELECT id_usuario, nome FROM usuarios WHERE id_usuario = $1',
      [id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

    const { rows: refs } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM visitas WHERE id_usuario = $1) AS visitas,
         (SELECT COUNT(*)::int FROM manut_chamados WHERE id_solicitante = $1 OR id_tecnico = $1) AS chamados`,
      [id],
    );
    const { visitas, chamados } = refs[0];
    if (visitas > 0 || chamados > 0) {
      const partes = [];
      if (visitas > 0) partes.push(`${visitas} visita(s)`);
      if (chamados > 0) partes.push(`${chamados} chamado(s)`);
      return res.status(409).json({
        error: `Não é possível excluir: usuário vinculado a ${partes.join(' e ')}. Desative o usuário em vez de excluir.`,
      });
    }

    await pool.query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
