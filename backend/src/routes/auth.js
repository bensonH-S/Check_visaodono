import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authMiddleware, signToken } from '../auth.js';
import { carregarLojasDetalhe, carregarRegioesAtuacaoTecnico } from '../lojasUsuario.js';
import { acessoTodasLojas, carregarPermissoesUsuario, temPermissao } from '../permissoes.js';
import { tiposChecklistDoUsuario } from '../checklistTipos.js';
import { logger } from '../logger.js';
import { auditar } from '../auditoriaHelpers.js';
import { gpsCapturaHabilitadaUsuario } from '../gpsTecnicos.js';

const router = Router();

function precisaRegioesAtuacaoSessao(row, permissoes) {
  const userCtx = { sub: row.id_usuario, perfil: row.perfil, permissoes, cargo_aprovacao: row.cargo_aprovacao };
  if (temPermissao(userCtx, 'chamados.assumir') || temPermissao(userCtx, 'frota.regioes') || temPermissao(userCtx, 'frota.mapa.ver') || temPermissao(userCtx, 'escalas.visitas.ver')) return true;
  const cargo = String(row.cargo_aprovacao || row.perfil || '').toLowerCase();
  return cargo === 'supervisor_regional' || cargo === 'regional' || cargo === 'supervisor';
}

async function mapUsuario(row) {
  const permissoes = await carregarPermissoesUsuario(row.id_usuario);
  const userCtx = { sub: row.id_usuario, perfil: row.perfil, permissoes, cargo_aprovacao: row.cargo_aprovacao };
  const [lojas, tiposChecklist, regioesAtuacao, gpsCapturaHabilitada] = await Promise.all([
    carregarLojasDetalhe(userCtx),
    temPermissao(userCtx, 'checklist.ver') || temPermissao(userCtx, 'checklist.executar')
      ? tiposChecklistDoUsuario(row.id_usuario)
      : Promise.resolve([]),
    precisaRegioesAtuacaoSessao(row, permissoes)
      ? carregarRegioesAtuacaoTecnico(row.id_usuario)
      : Promise.resolve([]),
    gpsCapturaHabilitadaUsuario(row.id_usuario),
  ]);
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
    tipos_checklist: tiposChecklist.map((t) => ({
      id_tipo_checklist: t.id_tipo_checklist,
      codigo: t.codigo,
      nome: t.nome,
    })),
    regioes_atuacao: regioesAtuacao,
    gps_captura_habilitada: gpsCapturaHabilitada,
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
    if (!user) {
      logger.warn('auth', 'Login falhou — e-mail não cadastrado', { email });
      await auditar(null, {
        modulo: 'auth',
        acao: 'login_falha',
        entidade: 'sessao',
        descricao: `Tentativa de acesso com e-mail não cadastrado (${email})`,
        detalhes: { motivo: 'email_nao_cadastrado', email },
      });
      return res.status(401).json({
        error: 'E-mail não cadastrado. Entre em contato com o suporte de TI.',
      });
    }
    if (!user.senha_hash) {
      logger.warn('auth', 'Login falhou — usuário sem senha', { email, idUsuario: user.id_usuario });
      await auditar(null, {
        idUsuario: user.id_usuario,
        modulo: 'auth',
        acao: 'login_falha',
        entidade: 'sessao',
        idReferencia: user.id_usuario,
        descricao: `Tentativa de acesso sem senha configurada: ${user.nome} (${email})`,
        detalhes: { motivo: 'sem_senha', email },
      });
      return res.status(401).json({
        error: 'Acesso ainda não configurado. Entre em contato com o suporte de TI.',
      });
    }
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) {
      logger.warn('auth', 'Login falhou — senha incorreta', { email, idUsuario: user.id_usuario });
      await auditar(null, {
        idUsuario: user.id_usuario,
        modulo: 'auth',
        acao: 'login_falha',
        entidade: 'sessao',
        idReferencia: user.id_usuario,
        descricao: `Senha incorreta no acesso de ${user.nome} (${email})`,
        detalhes: { motivo: 'senha_incorreta', email },
      });
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const usuario = await mapUsuario(user);
    logger.info('auth', 'Login OK', { email, idUsuario: user.id_usuario, perfil: user.perfil });
    await auditar(null, {
      idUsuario: user.id_usuario,
      modulo: 'auth',
      acao: 'login',
      entidade: 'sessao',
      idReferencia: user.id_usuario,
      descricao: `${user.nome} entrou no sistema`,
      detalhes: { email, origem: 'login' },
    });
    res.json({
      accessToken: signToken(usuario),
      usuario,
    });
  } catch (e) {
    const msg = String(e.message || '');
    if (msg.includes('usuario_permissoes') || msg.includes('permissoes') || msg.includes('does not exist')) {
      logger.error('auth', 'Login falhou — migrations incompletas', { email: req.body?.email, error: msg });
      return res.status(503).json({
        error: 'Sistema temporariamente indisponível. Tente novamente em instantes ou contate o suporte de TI.',
      });
    }
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

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_usuario, nome, email FROM usuarios WHERE id_usuario = $1`,
      [req.user.sub],
    );
    const u = rows[0];
    await auditar(req, {
      modulo: 'auth',
      acao: 'logout',
      entidade: 'sessao',
      idReferencia: req.user.sub,
      descricao: u ? `${u.nome} saiu do sistema` : 'Usuário saiu do sistema',
      detalhes: u ? { email: u.email } : null,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
