/**
 * Chamados de manutenção — vision_check (manut_* + lojas/usuarios)
 */
import { Router } from 'express';
import { dispatchWhatsAppNotificacao } from '../services/whatsappNotificacoes.js';
import {
  sqlFiltroContextoNotificacoes,
  TIPOS_NOTIF_MOBILE_EXCLUIDOS,
} from '../notificacoesFiltro.js';
import multer from 'multer';
import { pool } from '../db.js';
import {
  encryptAnexo,
  decryptAnexo,
  midiaPermitida,
  midiaUrlAnexo,
} from '../fotos.js';
import { validarCodigoCargo, nomeCargo } from './cargos.js';

const ABERTOS = new Set(['aberto', 'em_atendimento', 'em_aprovacao', 'aprovado']);
const ENCERRADOS = new Set(['concluido', 'cancelado']);

let _temColunaAssumidoEm;

async function temColunaAssumidoEm() {
  if (_temColunaAssumidoEm !== undefined) return _temColunaAssumidoEm;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'manut_chamados' AND column_name = 'assumido_em'
       LIMIT 1`,
    );
    _temColunaAssumidoEm = rows.length > 0;
  } catch {
    _temColunaAssumidoEm = false;
  }
  return _temColunaAssumidoEm;
}

function sqlCampoAssumidoEm(colExiste) {
  return colExiste
    ? 'c.assumido_em'
    : `CASE WHEN c.status::text = 'em_atendimento' AND c.id_tecnico IS NOT NULL THEN c.updated_at END AS assumido_em`;
}

async function listarAtualizacoes(idChamado) {
  try {
    const { rows } = await pool.query(
      `SELECT a.id_atualizacao, a.texto, a.created_at, u.nome AS autor
       FROM manut_atualizacoes a
       JOIN usuarios u ON u.id_usuario = a.id_usuario
       WHERE a.id_chamado = $1
       ORDER BY a.created_at DESC`,
      [idChamado],
    );
    return rows;
  } catch (e) {
    if (e.code === '42P01') {
      console.warn('[manutencao] Tabela manut_atualizacoes ausente — execute: npm run migrate:atualizacoes');
      return [];
    }
    throw e;
  }
}

let _tabelaEventosChamadoOk;

async function ensureEventosChamadoTable() {
  if (_tabelaEventosChamadoOk) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manut_chamado_eventos (
        id_evento SERIAL PRIMARY KEY,
        id_chamado INT NOT NULL REFERENCES manut_chamados(id_chamado) ON DELETE CASCADE,
        tipo VARCHAR(40) NOT NULL,
        status_ref VARCHAR(40),
        id_usuario INT REFERENCES usuarios(id_usuario),
        texto TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_manut_eventos_chamado
        ON manut_chamado_eventos(id_chamado, created_at ASC);
    `);
    _tabelaEventosChamadoOk = true;
    return true;
  } catch (e) {
    console.error('[manutencao] Falha ao garantir tabela manut_chamado_eventos:', e.message);
    return false;
  }
}

async function registrarEventoChamado({ idChamado, tipo, idUsuario, statusRef, texto }) {
  await ensureEventosChamadoTable();
  try {
    await pool.query(
      `INSERT INTO manut_chamado_eventos (id_chamado, tipo, status_ref, id_usuario, texto)
       VALUES ($1, $2, $3, $4, $5)`,
      [idChamado, tipo, statusRef || null, idUsuario || null, texto || null],
    );
    return true;
  } catch (e) {
    console.error('[manutencao] Erro ao registrar evento do chamado:', e.message);
    return false;
  }
}

async function listarEventosChamado(idChamado) {
  await ensureEventosChamadoTable();
  try {
    const { rows } = await pool.query(
      `SELECT e.id_evento, e.tipo, e.status_ref, e.texto, e.created_at, u.nome AS autor
       FROM manut_chamado_eventos e
       LEFT JOIN usuarios u ON u.id_usuario = e.id_usuario
       WHERE e.id_chamado = $1
       ORDER BY e.created_at ASC`,
      [idChamado],
    );
    return rows;
  } catch {
    return [];
  }
}

const TIPOS_HISTORICO_APROVACAO = [
  'envio_aprovacao',
  'encaminhar_diretor',
  'aprovacao_diretor',
  'aprovacao',
  'recusa_aprovacao',
];

async function carregarHistoricoAprovacaoCards(idsChamado) {
  const ids = [...new Set((idsChamado || []).map(Number).filter(Boolean))];
  if (!ids.length) return new Map();
  await ensureEventosChamadoTable();
  try {
    const { rows } = await pool.query(
      `SELECT e.id_chamado, e.tipo, e.texto, e.created_at, u.nome AS autor
       FROM manut_chamado_eventos e
       LEFT JOIN usuarios u ON u.id_usuario = e.id_usuario
       WHERE e.id_chamado = ANY($1::int[])
         AND e.tipo = ANY($2::text[])
       ORDER BY e.created_at ASC`,
      [ids, TIPOS_HISTORICO_APROVACAO],
    );
    const map = new Map();
    for (const r of rows) {
      const id = Number(r.id_chamado);
      if (!map.has(id)) map.set(id, []);
      map.get(id).push({
        tipo: r.tipo,
        texto: r.texto,
        autor: r.autor,
        quando: r.created_at,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

function anexarHistoricoAprovacao(rows, historicoMap) {
  return rows.map((row) => ({
    ...row,
    historico_aprovacao: historicoMap.get(Number(row.id_chamado)) || [],
  }));
}

let _tabelaNotificacoesOk;

async function ensureNotificacoesTable() {
  if (_tabelaNotificacoesOk) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manut_notificacoes (
        id_notificacao SERIAL PRIMARY KEY,
        id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        id_chamado INT NOT NULL REFERENCES manut_chamados(id_chamado) ON DELETE CASCADE,
        tipo VARCHAR(40) NOT NULL DEFAULT 'resposta',
        mensagem TEXT NOT NULL,
        lida BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_manut_notif_usuario
        ON manut_notificacoes(id_usuario, lida, created_at DESC);
    `);
    _tabelaNotificacoesOk = true;
    return true;
  } catch (e) {
    console.error('[manutencao] Falha ao garantir tabela manut_notificacoes:', e.message);
    return false;
  }
}

let _tabelaEventosNotifOk;

async function ensureNotificacaoEventosTable() {
  if (_tabelaEventosNotifOk) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manut_notificacao_eventos (
        codigo VARCHAR(40) PRIMARY KEY,
        descricao TEXT NOT NULL,
        notifica_abrir BOOLEAN NOT NULL DEFAULT TRUE,
        notifica_ver BOOLEAN NOT NULL DEFAULT TRUE,
        ativo BOOLEAN NOT NULL DEFAULT TRUE
      );
      INSERT INTO manut_notificacao_eventos (codigo, descricao, notifica_abrir, notifica_ver) VALUES
        ('novo_chamado', 'Novo chamado aberto na loja', TRUE, TRUE),
        ('resposta', 'Nova mensagem no chamado', TRUE, TRUE),
        ('anexo', 'Fotos ou vídeos adicionados ao chamado', TRUE, TRUE),
        ('assumido', 'Chamado atribuído a técnico', TRUE, TRUE),
        ('fechamento', 'Chamado concluído ou cancelado', TRUE, TRUE),
        ('reabertura', 'Chamado reaberto', TRUE, TRUE),
        ('envio_aprovacao', 'Chamado enviado para aprovação de orçamento', TRUE, TRUE),
        ('aguardando_aprovacao', 'Solicitante aguardando aprovação do orçamento', TRUE, TRUE),
        ('encaminhar_diretor', 'Orçamento encaminhado ao Diretor', TRUE, TRUE),
        ('aprovacao_diretor', 'Orçamento aprovado pelo Diretor', TRUE, TRUE),
        ('aprovacao', 'Orçamento aprovado', TRUE, TRUE),
        ('recusa_aprovacao', 'Orçamento recusado', TRUE, TRUE)
      ON CONFLICT (codigo) DO NOTHING;
    `);
    _tabelaEventosNotifOk = true;
    return true;
  } catch (e) {
    console.error('[manutencao] Falha ao garantir tabela manut_notificacao_eventos:', e.message);
    return false;
  }
}

async function eventoNotificacaoAtivo(codigo) {
  await ensureNotificacaoEventosTable();
  try {
    const { rows } = await pool.query(
      `SELECT ativo FROM manut_notificacao_eventos WHERE codigo = $1`,
      [codigo],
    );
    return rows[0]?.ativo !== false;
  } catch {
    return true;
  }
}

async function criarNotificacao({ idUsuario, idChamado, tipo, mensagem, enviarPush = true }) {
  const uid = Number(idUsuario);
  if (!Number.isFinite(uid)) return false;
  await ensureNotificacoesTable();
  try {
    await pool.query(
      `INSERT INTO manut_notificacoes (id_usuario, id_chamado, tipo, mensagem)
       VALUES ($1, $2, $3, $4)`,
      [uid, idChamado, tipo, mensagem],
    );
    if (enviarPush) {
      const { enviarPushNotificacaoChamado } = await import('../pushNotifications.js');
      enviarPushNotificacaoChamado(uid, idChamado, tipo, mensagem).catch(() => {});
    }
    void dispatchWhatsAppNotificacao({ idUsuario: uid, idChamado, tipo, mensagem }).catch((e) =>
      console.error('[whatsapp]', e.message),
    );
    return true;
  } catch (e) {
    console.error('[manutencao] Erro ao criar notificação:', e.message);
    return false;
  }
}

async function coletarDestinatariosChamado(idChamado, idAutorNum) {
  const destinatarios = new Set();
  const { rows } = await pool.query(
    `SELECT id_solicitante, id_tecnico, id_loja, numero FROM manut_chamados WHERE id_chamado = $1`,
    [idChamado],
  );
  const c = rows[0];
  if (!c) return { destinatarios, numero: null };

  if (c.id_solicitante) destinatarios.add(Number(c.id_solicitante));
  if (c.id_tecnico) destinatarios.add(Number(c.id_tecnico));

  try {
    const { rows: autores } = await pool.query(
      `SELECT DISTINCT id_usuario FROM manut_atualizacoes WHERE id_chamado = $1`,
      [idChamado],
    );
    for (const r of autores) destinatarios.add(Number(r.id_usuario));
  } catch {
    /* tabela de atualizações pode não existir */
  }

  try {
    const { rows: equipe } = await pool.query(
      `SELECT DISTINCT up.id_usuario, up.codigo
       FROM usuario_permissoes up
       JOIN usuarios u ON u.id_usuario = up.id_usuario AND u.ativo = TRUE
       WHERE up.codigo IN ('chamados.ver', 'chamados.assumir', 'chamados.abrir')
         AND (
           EXISTS (
             SELECT 1 FROM usuario_permissoes up2
             WHERE up2.id_usuario = up.id_usuario AND up2.codigo = 'lojas.todas'
           )
           OR EXISTS (
             SELECT 1 FROM usuario_lojas ul
             WHERE ul.id_usuario = up.id_usuario AND ul.id_loja = $1
           )
         )`,
      [c.id_loja],
    );
    for (const r of equipe) destinatarios.add(Number(r.id_usuario));
  } catch {
    /* ignore */
  }

  destinatarios.delete(idAutorNum);
  return { destinatarios, numero: c.numero };
}

async function notificarEventoChamado(idChamado, idAutor, tipo, mensagem) {
  if (!(await eventoNotificacaoAtivo(tipo))) return 0;

  const idAutorNum = Number(idAutor);
  const { destinatarios, numero } = await coletarDestinatariosChamado(idChamado, idAutorNum);
  if (!numero) return 0;

  let enviadas = 0;
  for (const idUsuario of destinatarios) {
    if (!Number.isFinite(idUsuario)) continue;
    const ok = await criarNotificacao({ idUsuario, idChamado, tipo, mensagem, enviarPush: true });
    if (ok) enviadas += 1;
  }

  return enviadas;
}

async function normalizarDestinoAprovacao(valor) {
  const r = await validarCodigoCargo(valor, { exigirAprovador: true });
  if (!r || typeof r === 'object') return null;
  return r;
}

async function labelDestinoAprovacao(destino) {
  if (!destino) return '';
  return nomeCargo(destino);
}

function destinoPermiteCargo(aprovacaoDestino, cargoAprovacao) {
  if (!cargoAprovacao) return false;
  if (!aprovacaoDestino) return true;
  return aprovacaoDestino === cargoAprovacao;
}

async function carregarCargoAprovacao(idUsuario) {
  const { rows } = await pool.query(
    `SELECT u.cargo_aprovacao, c.aprovador, c.ativo
     FROM usuarios u
     LEFT JOIN cargos c ON c.codigo = u.cargo_aprovacao
     WHERE u.id_usuario = $1`,
    [idUsuario],
  );
  const codigo = rows[0]?.cargo_aprovacao;
  if (!codigo || !rows[0]?.aprovador || rows[0]?.ativo === false) return null;
  return codigo;
}

async function coletarAprovadoresChamado(idLoja, idAutorNum, destino) {
  const destinatarios = new Set();
  const dest = await normalizarDestinoAprovacao(destino);
  if (!dest) return destinatarios;
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT up.id_usuario
       FROM usuario_permissoes up
       JOIN usuarios u ON u.id_usuario = up.id_usuario AND u.ativo = TRUE
       WHERE up.codigo = 'chamados.aprovar'
         AND u.cargo_aprovacao = $2
         AND (
           EXISTS (
             SELECT 1 FROM usuario_permissoes up2
             WHERE up2.id_usuario = up.id_usuario AND up2.codigo = 'lojas.todas'
           )
           OR EXISTS (
             SELECT 1 FROM usuario_lojas ul
             WHERE ul.id_usuario = up.id_usuario AND ul.id_loja = $1
           )
         )`,
      [idLoja, dest],
    );
    for (const r of rows) destinatarios.add(Number(r.id_usuario));
  } catch {
    /* ignore */
  }
  destinatarios.delete(idAutorNum);
  return destinatarios;
}

async function notificarAprovadoresOrcamento(
  idChamado,
  idAutor,
  mensagem,
  destino,
  tipo = 'envio_aprovacao',
) {
  const idAutorNum = Number(idAutor);
  const { rows } = await pool.query(
    `SELECT id_loja, aprovacao_destino FROM manut_chamados WHERE id_chamado = $1`,
    [idChamado],
  );
  if (!rows[0]) return 0;

  const dest = (await normalizarDestinoAprovacao(destino)) || rows[0].aprovacao_destino;
  const aprovadores = await coletarAprovadoresChamado(rows[0].id_loja, idAutorNum, dest);
  let enviadas = 0;
  for (const idUsuario of aprovadores) {
    if (!Number.isFinite(idUsuario)) continue;
    const ok = await criarNotificacao({
      idUsuario,
      idChamado,
      tipo,
      mensagem,
    });
    if (ok) enviadas += 1;
  }
  return enviadas;
}

async function notificarSolicitanteChamado(idChamado, idAutor, tipo, mensagem) {
  if (!(await eventoNotificacaoAtivo(tipo))) return 0;

  const idAutorNum = Number(idAutor);
  const { rows } = await pool.query(
    `SELECT id_solicitante FROM manut_chamados WHERE id_chamado = $1`,
    [idChamado],
  );
  const idSolicitante = Number(rows[0]?.id_solicitante);
  if (!Number.isFinite(idSolicitante) || idSolicitante === idAutorNum) return 0;

  const ok = await criarNotificacao({
    idUsuario: idSolicitante,
    idChamado,
    tipo,
    mensagem,
  });
  return ok ? 1 : 0;
}

function sqlExcluirTiposNotificacaoCard(mobile = false) {
  if (mobile) {
    return ` AND n.tipo NOT IN ('${TIPOS_NOTIF_MOBILE_EXCLUIDOS.join("','")}')`;
  }
  return ` AND n.tipo <> 'envio_aprovacao'`;
}

async function filtroNotificacoesAprovacoes(idUsuario, contexto, params) {
  if (contexto !== 'aprovacoes') {
    return { filtroExtra: '', params, semAcesso: false };
  }
  const cargo = await carregarCargoAprovacao(idUsuario);
  if (!cargo) {
    return { filtroExtra: ' AND FALSE', params, semAcesso: true };
  }
  params.push(cargo);
  return {
    filtroExtra: ` AND c.aprovacao_destino = $${params.length}`,
    params,
    semAcesso: false,
  };
}

import { authMiddleware } from '../auth.js';
import { requirePermissao, attachPermissoesUsuario, temPermissao } from '../permissoes.js';
import { attachLojasUsuario, filtroSqlLojas, usuarioPodeLoja } from '../lojasUsuario.js';

const router = Router();

router.use(authMiddleware, attachPermissoesUsuario, attachLojasUsuario);

const MAX_MIDIA_BYTES = 50 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MIDIA_BYTES, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (midiaPermitida(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas imagens, vídeos e PDF são permitidos'));
  },
});

function calcularPrazoSla(abertoEm, slaHoras) {
  return new Date(abertoEm.getTime() + slaHoras * 60 * 60 * 1000);
}

const COL_CATEGORIA = `c.id_categoria, c.nome, c.sla_horas, c.id_sla,
  c.urgencia_padrao::text AS urgencia_padrao, c.ativo,
  s.nome AS sla_nome`;

async function dadosSla(idSla) {
  const { rows } = await pool.query(
    `SELECT horas, urgencia_padrao::text AS urgencia_padrao
     FROM manut_sla WHERE id_sla = $1 AND ativo = TRUE`,
    [idSla],
  );
  return rows[0] ?? null;
}

router.get('/sla', requirePermissao('usuarios.gerenciar', 'configuracoes.ver'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_sla, nome, horas, urgencia_padrao::text AS urgencia_padrao, ativo
       FROM manut_sla
       ORDER BY horas, nome`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/sla', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const { nome, horas, urgencia_padrao } = req.body;
    if (!nome?.trim() || !horas || Number(horas) <= 0 || !urgencia_padrao) {
      return res.status(400).json({ error: 'Informe nome, horas e urgência válidas' });
    }
    const { rows } = await pool.query(
      `INSERT INTO manut_sla (nome, horas, urgencia_padrao)
       VALUES ($1, $2, $3::manut_urgencia)
       RETURNING id_sla, nome, horas, urgencia_padrao::text AS urgencia_padrao, ativo`,
      [nome.trim(), Number(horas), urgencia_padrao],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/sla/:id', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const idSla = Number(req.params.id);
    const { nome, horas, urgencia_padrao, ativo } = req.body;
    const campos = [];
    const params = [];
    let i = 1;

    if (nome !== undefined) {
      if (!nome?.trim()) return res.status(400).json({ error: 'Nome inválido' });
      campos.push(`nome = $${i++}`);
      params.push(nome.trim());
    }
    if (horas !== undefined) {
      if (!horas || Number(horas) <= 0) return res.status(400).json({ error: 'Horas inválidas' });
      campos.push(`horas = $${i++}`);
      params.push(Number(horas));
    }
    if (urgencia_padrao !== undefined) {
      campos.push(`urgencia_padrao = $${i++}::manut_urgencia`);
      params.push(urgencia_padrao);
    }
    if (ativo !== undefined) {
      campos.push(`ativo = $${i++}`);
      params.push(!!ativo);
    }
    if (!campos.length) return res.status(400).json({ error: 'Nada para atualizar' });

    params.push(idSla);
    const { rows } = await pool.query(
      `UPDATE manut_sla SET ${campos.join(', ')} WHERE id_sla = $${i}
       RETURNING id_sla, nome, horas, urgencia_padrao::text AS urgencia_padrao, ativo`,
      params,
    );
    if (!rows.length) return res.status(404).json({ error: 'SLA não encontrado' });

    if (horas !== undefined) {
      await pool.query('UPDATE manut_categorias SET sla_horas = $1 WHERE id_sla = $2', [
        Number(horas),
        idSla,
      ]);
    }
    if (urgencia_padrao !== undefined) {
      await pool.query(
        'UPDATE manut_categorias SET urgencia_padrao = $1::manut_urgencia WHERE id_sla = $2',
        [urgencia_padrao, idSla],
      );
    }
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/sla/:id', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const idSla = Number(req.params.id);
    const uso = await pool.query(
      'SELECT COUNT(*)::int AS total FROM manut_categorias WHERE id_sla = $1',
      [idSla],
    );
    if (uso.rows[0].total > 0) {
      return res.status(400).json({ error: 'Este SLA está vinculado a categorias e não pode ser excluído' });
    }
    const { rowCount } = await pool.query('DELETE FROM manut_sla WHERE id_sla = $1', [idSla]);
    if (!rowCount) return res.status(404).json({ error: 'SLA não encontrado' });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.get('/categorias', requirePermissao('usuarios.gerenciar', 'configuracoes.ver'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COL_CATEGORIA}
       FROM manut_categorias c
       LEFT JOIN manut_sla s ON s.id_sla = c.id_sla
       ORDER BY c.nome`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/categorias', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const { nome, id_sla, ativo } = req.body;
    if (!nome?.trim() || !id_sla) {
      return res.status(400).json({ error: 'Informe nome e SLA' });
    }
    const sla = await dadosSla(id_sla);
    if (!sla) return res.status(400).json({ error: 'SLA não encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO manut_categorias (nome, sla_horas, id_sla, urgencia_padrao, ativo)
       VALUES ($1, $2, $3, $4::manut_urgencia, $5)
       RETURNING id_categoria, nome, sla_horas, id_sla, urgencia_padrao::text AS urgencia_padrao, ativo`,
      [nome.trim(), sla.horas, id_sla, sla.urgencia_padrao, ativo !== false],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Já existe uma categoria com este nome' });
    next(e);
  }
});

router.patch('/categorias/:id', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const idCategoria = Number(req.params.id);
    const { nome, id_sla, ativo } = req.body;
    const campos = [];
    const params = [];
    let i = 1;

    if (nome !== undefined) {
      if (!nome?.trim()) return res.status(400).json({ error: 'Nome inválido' });
      campos.push(`nome = $${i++}`);
      params.push(nome.trim());
    }
    if (id_sla !== undefined) {
      const sla = await dadosSla(id_sla);
      if (!sla) return res.status(400).json({ error: 'SLA não encontrado' });
      campos.push(`id_sla = $${i++}`);
      params.push(id_sla);
      campos.push(`sla_horas = $${i++}`);
      params.push(sla.horas);
      campos.push(`urgencia_padrao = $${i++}::manut_urgencia`);
      params.push(sla.urgencia_padrao);
    }
    if (ativo !== undefined) {
      campos.push(`ativo = $${i++}`);
      params.push(!!ativo);
    }
    if (!campos.length) return res.status(400).json({ error: 'Nada para atualizar' });

    params.push(idCategoria);
    const { rows } = await pool.query(
      `UPDATE manut_categorias SET ${campos.join(', ')} WHERE id_categoria = $${i}
       RETURNING id_categoria, nome, sla_horas, id_sla, urgencia_padrao::text AS urgencia_padrao, ativo`,
      params,
    );
    if (!rows.length) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Já existe uma categoria com este nome' });
    next(e);
  }
});

router.delete('/categorias/:id', requirePermissao('usuarios.gerenciar'), async (req, res, next) => {
  try {
    const idCategoria = Number(req.params.id);
    const uso = await pool.query(
      'SELECT COUNT(*)::int AS total FROM manut_chamados WHERE id_categoria = $1',
      [idCategoria],
    );
    if (uso.rows[0].total > 0) {
      await pool.query('UPDATE manut_categorias SET ativo = FALSE WHERE id_categoria = $1', [idCategoria]);
      return res.json({ inativada: true });
    }
    const { rowCount } = await pool.query('DELETE FROM manut_categorias WHERE id_categoria = $1', [idCategoria]);
    if (!rowCount) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.get('/formulario', requirePermissao('chamados.abrir', 'chamados.ver'), async (req, res, next) => {
  try {
    const params = [];
    const lojaFiltro = filtroSqlLojas(req.user, null, 'id_loja', params);

    const [cats, lojas] = await Promise.all([
      pool.query(
        `SELECT id_categoria, nome, sla_horas, urgencia_padrao::text AS urgencia_padrao
         FROM manut_categorias WHERE ativo = TRUE ORDER BY nome`,
      ),
      pool.query(
        `SELECT id_loja, name AS nome, bk_number AS codigo_bkn
         FROM lojas WHERE is_active = TRUE ${lojaFiltro} ORDER BY name`,
        params,
      ),
    ]);
    res.json({ categorias: cats.rows, lojas: lojas.rows });
  } catch (e) {
    next(e);
  }
});

function podeVerDetalheChamado(user, chamado, cargoAprovacao) {
  if (temPermissao(user, 'chamados.ver') || temPermissao(user, 'chamados.abrir')) return true;
  if (
    !temPermissao(user, 'chamados.aprovar') ||
    !['em_aprovacao', 'aprovado'].includes(chamado.status) ||
    !cargoAprovacao
  ) {
    return false;
  }
  if (destinoPermiteCargo(chamado.aprovacao_destino, cargoAprovacao)) return true;
  // Diretor que já avaliou e devolveu ao Financeiro
  if (cargoAprovacao === 'diretor' && chamado.aprovacao_diretor_ok) return true;
  // Financeiro que encaminhou e aguarda o Diretor
  if (
    cargoAprovacao === 'financeiro' &&
    chamado.aprovacao_destino === 'diretor' &&
    !chamado.aprovacao_diretor_ok
  ) {
    return true;
  }
  return false;
}

const SQL_LISTA_ORCAMENTOS = `
  SELECT c.id_chamado, c.numero, c.titulo, c.status::text AS status,
         c.urgencia::text AS urgencia, c.tipo_chamado::text AS tipo_chamado,
         c.aprovacao_destino, c.aprovacao_diretor_ok,
         c.prazo_sla, c.aberto_em, c.fechado_em,
         c.id_loja,
         cat.nome AS categoria,
         l.name AS loja,
         (SELECT COUNT(*)::int FROM manut_anexos a WHERE a.id_chamado = c.id_chamado) AS total_fotos
  FROM manut_chamados c
  JOIN manut_categorias cat ON cat.id_categoria = c.id_categoria
  JOIN lojas l ON l.id_loja = c.id_loja
  WHERE c.tipo_chamado = 'orcamento'::manut_tipo_chamado
    AND c.status = $STATUS$::manut_status_chamado
    FILTRO_LOJAS
    FILTRO_DESTINO
  ORDER BY c.updated_at DESC`;

router.get(
  '/chamados/aprovacoes',
  requirePermissao('chamados.aprovar'),
  async (req, res, next) => {
    try {
      const cargo = await carregarCargoAprovacao(req.user.sub);
      if (!cargo) {
        return res.json({ pendentes: [], aprovados: [] });
      }

      const paramsP = [];
      const filtroP = filtroSqlLojas(req.user, 'c', 'id_loja', paramsP);
      paramsP.push(cargo);
      const idxDestP = paramsP.length;
      const sqlPendentes = SQL_LISTA_ORCAMENTOS
        .replace('$STATUS$', "'em_aprovacao'")
        .replace('FILTRO_LOJAS', filtroP)
        .replace('FILTRO_DESTINO', ` AND (c.aprovacao_destino = $${idxDestP} OR c.aprovacao_destino IS NULL)`);

      const paramsA = [];
      const filtroA = filtroSqlLojas(req.user, 'c', 'id_loja', paramsA);
      paramsA.push(cargo);
      const idxDestA = paramsA.length;
      const sqlAprovados = SQL_LISTA_ORCAMENTOS
        .replace('$STATUS$', "'aprovado'")
        .replace('FILTRO_LOJAS', filtroA)
        .replace('FILTRO_DESTINO', ` AND (c.aprovacao_destino = $${idxDestA} OR c.aprovacao_destino IS NULL)`);

      const [pendentes, aprovados] = await Promise.all([
        pool.query(sqlPendentes, paramsP),
        pool.query(sqlAprovados, paramsA),
      ]);

      const ids = [
        ...pendentes.rows.map((r) => r.id_chamado),
        ...aprovados.rows.map((r) => r.id_chamado),
      ];
      const historicoMap = await carregarHistoricoAprovacaoCards(ids);

      res.json({
        pendentes: anexarHistoricoAprovacao(pendentes.rows, historicoMap),
        aprovados: anexarHistoricoAprovacao(aprovados.rows, historicoMap),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get('/chamados', requirePermissao('chamados.ver', 'chamados.abrir'), async (req, res, next) => {
  try {
    const params = [];
    const filtro = filtroSqlLojas(req.user, 'c', 'id_loja', params);
    const idUsuario = Number(req.user.sub);
    params.push(idUsuario);
    const idxUser = params.length;
    const mobile = req.query.mobile === '1' || req.query.mobile === 'true';
    const filtroNotifCard = sqlExcluirTiposNotificacaoCard(mobile);

    await ensureNotificacoesTable();

    const { rows } = await pool.query(
      `SELECT c.id_chamado, c.numero, c.titulo, c.status::text AS status,
              c.urgencia::text AS urgencia, c.tipo_chamado::text AS tipo_chamado,
              c.prazo_sla, c.aberto_em, c.fechado_em,
              c.id_loja,
              cat.nome AS categoria,
              l.name AS loja,
              (SELECT COUNT(*)::int FROM manut_anexos a WHERE a.id_chamado = c.id_chamado) AS total_fotos,
              COALESCE((
                SELECT COUNT(*)::int FROM manut_notificacoes n
                WHERE n.id_chamado = c.id_chamado AND n.id_usuario = $${idxUser}
                  AND n.lida = FALSE${filtroNotifCard}
              ), 0) AS notificacoes_nao_lidas
       FROM manut_chamados c
       JOIN manut_categorias cat ON cat.id_categoria = c.id_categoria
       JOIN lojas l ON l.id_loja = c.id_loja
       WHERE 1=1 ${filtro}
       ORDER BY
         CASE c.urgencia::text
           WHEN 'critica' THEN 4 WHEN 'alta' THEN 3 WHEN 'media' THEN 2 ELSE 1
         END DESC,
         c.prazo_sla ASC`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get(
  '/chamados/:idChamado',
  requirePermissao('chamados.ver', 'chamados.abrir', 'chamados.aprovar'),
  async (req, res, next) => {
  try {
    const idChamado = Number(req.params.idChamado);
    const colAssumido = await temColunaAssumidoEm();
    const campoAssumido = sqlCampoAssumidoEm(colAssumido);
    const { rows } = await pool.query(
      `SELECT c.id_chamado, c.numero, c.titulo, c.descricao, c.status::text AS status,
              c.urgencia::text AS urgencia, c.tipo_chamado::text AS tipo_chamado,
              c.aprovacao_destino, c.aprovacao_diretor_ok,
              c.prazo_sla, c.aberto_em, c.fechado_em,
              ${campoAssumido}, c.local_detalhe, c.id_loja, c.id_solicitante, c.id_tecnico,
              cat.nome AS categoria,
              l.name AS loja,
              u.nome AS solicitante,
              ut.nome AS tecnico
       FROM manut_chamados c
       JOIN manut_categorias cat ON cat.id_categoria = c.id_categoria
       JOIN lojas l ON l.id_loja = c.id_loja
       JOIN usuarios u ON u.id_usuario = c.id_solicitante
       LEFT JOIN usuarios ut ON ut.id_usuario = c.id_tecnico
       WHERE c.id_chamado = $1`,
      [idChamado],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
    if (!usuarioPodeLoja(req.user, rows[0].id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const cargoAprovacao = await carregarCargoAprovacao(req.user.sub);
    if (!podeVerDetalheChamado(req.user, rows[0], cargoAprovacao)) {
      return res.status(403).json({ error: 'Sem permissão para ver este chamado' });
    }

    const [anexos, atualizacoes, eventos] = await Promise.all([
      pool.query(
        `SELECT id_anexo, tipo_mime, nome_arquivo, created_at
         FROM manut_anexos WHERE id_chamado = $1 ORDER BY created_at ASC`,
        [idChamado],
      ),
      listarAtualizacoes(idChamado),
      listarEventosChamado(idChamado),
    ]);

    res.json({
      ...rows[0],
      anexos: anexos.rows.map((a) => ({
        ...a,
        media_url: midiaUrlAnexo(a.id_anexo),
      })),
      atualizacoes,
      eventos,
    });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/chamados/:idChamado/atualizacoes',
  requirePermissao('chamados.abrir', 'chamados.ver', 'chamados.assumir'),
  async (req, res, next) => {
  try {
    const idChamado = Number(req.params.idChamado);
    const texto = String(req.body?.texto || '').trim();
    if (texto.length < 3) {
      return res.status(400).json({ error: 'Informe pelo menos 3 caracteres' });
    }

    const chamado = await pool.query(
      `SELECT id_loja, status::text AS status, numero FROM manut_chamados WHERE id_chamado = $1`,
      [idChamado],
    );
    if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
    if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (!ABERTOS.has(chamado.rows[0].status)) {
      return res.status(400).json({ error: 'Chamado encerrado não aceita novas informações' });
    }

    const duplicada = await pool.query(
      `SELECT id_atualizacao, texto, created_at
       FROM manut_atualizacoes
       WHERE id_chamado = $1 AND id_usuario = $2 AND texto = $3
         AND created_at > NOW() - INTERVAL '60 seconds'
       ORDER BY created_at DESC
       LIMIT 1`,
      [idChamado, req.user.sub, texto],
    ).catch(() => ({ rows: [] }));

    if (duplicada.rows[0]) {
      const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [req.user.sub]);
      return res.status(201).json({
        ...duplicada.rows[0],
        autor: autor.rows[0]?.nome || 'Usuário',
        notificacoes_enviadas: 0,
      });
    }

    let rows;
    try {
      ({ rows } = await pool.query(
        `INSERT INTO manut_atualizacoes (id_chamado, id_usuario, texto)
         VALUES ($1, $2, $3)
         RETURNING id_atualizacao, texto, created_at`,
        [idChamado, req.user.sub, texto],
      ));
    } catch (e) {
      if (e.code === '42P01') {
        return res.status(503).json({
          error: 'Histórico de atualizações indisponível. Execute: npm run migrate:atualizacoes',
        });
      }
      throw e;
    }

    const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [req.user.sub]);
    const autorNome = autor.rows[0]?.nome || 'Usuário';

    const notificacoesEnviadas = await notificarEventoChamado(
      idChamado,
      req.user.sub,
      'resposta',
      `Nova mensagem no chamado #${chamado.rows[0].numero} — ${autorNome}`,
    );

    res.status(201).json({
      ...rows[0],
      autor: autorNome,
      notificacoes_enviadas: notificacoesEnviadas,
    });
  } catch (e) {
    next(e);
  }
},
);

router.post('/chamados', requirePermissao('chamados.abrir'), async (req, res, next) => {
  try {
    const { titulo, descricao, id_categoria, id_loja, local_detalhe, urgencia, tipo_chamado } =
      req.body;

    if (!titulo || !descricao || !id_categoria || !id_loja) {
      return res.status(400).json({ error: 'Campos obrigatórios incompletos' });
    }
    if (!usuarioPodeLoja(req.user, id_loja)) {
      return res.status(403).json({ error: 'Loja não vinculada ao seu usuário' });
    }

    const { rows: catRows } = await pool.query(
      `SELECT sla_horas, urgencia_padrao::text AS urgencia_padrao
       FROM manut_categorias WHERE id_categoria = $1 AND ativo`,
      [id_categoria],
    );
    if (!catRows.length) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    const cat = catRows[0];
    const abertoEm = new Date();
    const urg = urgencia || cat.urgencia_padrao;
    const prazoSla = calcularPrazoSla(abertoEm, cat.sla_horas);
    const tipo = tipo_chamado === 'orcamento' ? 'orcamento' : 'normal';

    const { rows } = await pool.query(
      `INSERT INTO manut_chamados (
        titulo, descricao, urgencia, id_categoria, id_loja, id_solicitante,
        local_detalhe, aberto_em, prazo_sla, tipo_chamado
      ) VALUES ($1,$2,$3::manut_urgencia,$4,$5,$6,$7,$8,$9,$10::manut_tipo_chamado)
      RETURNING id_chamado, numero`,
      [
        titulo,
        descricao,
        urg,
        id_categoria,
        id_loja,
        req.user.sub,
        local_detalhe || null,
        abertoEm,
        prazoSla,
        tipo,
      ],
    );

    const { id_chamado, numero } = rows[0];
    const lojaRow = await pool.query('SELECT name FROM lojas WHERE id_loja = $1', [id_loja]);
    const nomeLoja = lojaRow.rows[0]?.name || 'Loja';
    await notificarEventoChamado(
      id_chamado,
      req.user.sub,
      'novo_chamado',
      `Novo Chamado #${numero} - Aberto (${nomeLoja})`,
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.get(
  '/anexos/:idAnexo/media',
  requirePermissao('chamados.ver', 'chamados.abrir', 'chamados.aprovar'),
  async (req, res, next) => {
  try {
    const idAnexo = Number(req.params.idAnexo);
    const { rows } = await pool.query(
      `SELECT a.arquivo_url, a.tipo_mime, c.id_loja
       FROM manut_anexos a
       JOIN manut_chamados c ON c.id_chamado = a.id_chamado
       WHERE a.id_anexo = $1`,
      [idAnexo],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Anexo não encontrado' });
    if (!usuarioPodeLoja(req.user, rows[0].id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const buffer = decryptAnexo(rows[0].arquivo_url);
    res.setHeader('Content-Type', rows[0].tipo_mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

router.post('/chamados/:id/fotos', upload.array('fotos', 10), async (req, res, next) => {
  try {
    const idChamado = Number(req.params.id);
    const idUsuario = req.user.sub;
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: 'Envie pelo menos uma foto ou vídeo' });
    }

    const chamado = await pool.query(
      `SELECT id_loja, status::text AS status, numero FROM manut_chamados WHERE id_chamado = $1`,
      [idChamado],
    );
    if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
    if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
      return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
    }
    if (!ABERTOS.has(chamado.rows[0].status)) {
      return res.status(400).json({ error: 'Chamado encerrado não aceita novos anexos' });
    }

    const anexos = [];
    for (const file of files) {
      const criptografado = encryptAnexo(file.buffer);
      const { rows } = await pool.query(
        `INSERT INTO manut_anexos (id_chamado, id_usuario, nome_arquivo, arquivo_url, tipo_mime)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id_anexo, tipo_mime`,
        [idChamado, idUsuario, file.originalname || 'anexo', criptografado, file.mimetype],
      );
      anexos.push({
        id_anexo: rows[0].id_anexo,
        tipo_mime: rows[0].tipo_mime,
        media_url: midiaUrlAnexo(rows[0].id_anexo),
      });
    }

    const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [idUsuario]);
    const autorNome = autor.rows[0]?.nome || 'Usuário';
    const qtd = files.length;
    await notificarEventoChamado(
      idChamado,
      idUsuario,
      'anexo',
      `${autorNome} adicionou ${qtd} anexo(s) no chamado #${chamado.rows[0].numero}`,
    );

    res.status(201).json(anexos);
  } catch (e) {
    next(e);
  }
});

router.patch('/chamados/:id/assumir', requirePermissao('chamados.assumir'), async (req, res, next) => {
  try {
    const idChamado = Number(req.params.id);
    const idTecnico = req.body.id_tecnico ?? req.user.sub;

    const chamado = await pool.query(
      `SELECT id_loja, id_solicitante, numero FROM manut_chamados WHERE id_chamado = $1`,
      [idChamado],
    );
    if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
    if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
      return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
    }

    const tecnico = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [idTecnico]);
    const tecnicoNome = tecnico.rows[0]?.nome || 'Técnico';
    const colAssumido = await temColunaAssumidoEm();
    const setAssumido = colAssumido ? 'assumido_em = NOW(),' : '';

    const { rows } = await pool.query(
      `UPDATE manut_chamados
       SET id_tecnico = $1, status = 'em_atendimento', ${setAssumido} updated_at = NOW()
       WHERE id_chamado = $2
       RETURNING id_chamado, status::text AS status`,
      [idTecnico, idChamado],
    );

    await notificarEventoChamado(
      idChamado,
      idTecnico,
      'assumido',
      `${tecnicoNome} atribuiu o chamado #${chamado.rows[0].numero}`,
    );

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/chamados/:id/enviar-aprovacao',
  requirePermissao('chamados.assumir', 'chamados.ver'),
  async (req, res, next) => {
    try {
      const idChamado = Number(req.params.id);
      const observacao = String(req.body?.observacao || '').trim();
      const destino = await normalizarDestinoAprovacao(req.body?.destino);
      if (!destino) {
        return res.status(400).json({ error: 'Informe o destino da aprovação (cargo aprovador válido)' });
      }

      const chamado = await pool.query(
        `SELECT id_loja, status::text AS status, numero, tipo_chamado::text AS tipo_chamado
         FROM manut_chamados WHERE id_chamado = $1`,
        [idChamado],
      );
      if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
      if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
        return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
      }
      if (!['aberto', 'em_atendimento'].includes(chamado.rows[0].status)) {
        return res.status(400).json({ error: 'Chamado não pode ser enviado para aprovação neste status' });
      }

      const aprovadores = await coletarAprovadoresChamado(
        chamado.rows[0].id_loja,
        Number(req.user.sub),
        destino,
      );
      const destinoLabel = await labelDestinoAprovacao(destino);
      const aviso = !aprovadores.size
        ? `Nenhum usuário ${destinoLabel} cadastrado para esta loja. O orçamento ficará pendente até haver um aprovador.`
        : null;

      const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [req.user.sub]);
      const autorNome = autor.rows[0]?.nome || 'Usuário';
      const numero = chamado.rows[0].numero;

      if (observacao.length >= 3) {
        try {
          await pool.query(
            `INSERT INTO manut_atualizacoes (id_chamado, id_usuario, texto)
             VALUES ($1, $2, $3)`,
            [idChamado, req.user.sub, observacao],
          );
        } catch (e) {
          if (e.code !== '42P01') throw e;
        }
      }

      const { rows } = await pool.query(
        `UPDATE manut_chamados
         SET status = 'em_aprovacao'::manut_status_chamado,
             tipo_chamado = 'orcamento'::manut_tipo_chamado,
             aprovacao_destino = $2,
             aprovacao_diretor_ok = FALSE,
             updated_at = NOW()
         WHERE id_chamado = $1
         RETURNING id_chamado, status::text AS status, tipo_chamado::text AS tipo_chamado,
                   aprovacao_destino, aprovacao_diretor_ok`,
        [idChamado, destino],
      );

      const textoEvento =
        observacao.length >= 3
          ? observacao
          : `Enviado para aprovação do ${destinoLabel}`;

      await registrarEventoChamado({
        idChamado,
        tipo: 'envio_aprovacao',
        idUsuario: req.user.sub,
        statusRef: 'em_aprovacao',
        texto: textoEvento,
      });
      await notificarAprovadoresOrcamento(
        idChamado,
        req.user.sub,
        `#${numero} · Orçamento pendente de aprovação (${destinoLabel}) — ${autorNome}`,
        destino,
        'envio_aprovacao',
      );
      await notificarSolicitanteChamado(
        idChamado,
        req.user.sub,
        'aguardando_aprovacao',
        `Chamado #${numero} - aguardando aprovação do Orçamento`,
      );

      res.json({ ...rows[0], aviso });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/chamados/:id/encaminhar-diretor',
  requirePermissao('chamados.aprovar'),
  async (req, res, next) => {
    try {
      const idChamado = Number(req.params.id);
      const observacao = String(req.body?.observacao || '').trim();

      const chamado = await pool.query(
        `SELECT id_loja, status::text AS status, numero, aprovacao_destino, aprovacao_diretor_ok
         FROM manut_chamados WHERE id_chamado = $1`,
        [idChamado],
      );
      if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
      if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
        return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
      }
      if (chamado.rows[0].status !== 'em_aprovacao') {
        return res.status(400).json({ error: 'Chamado não está aguardando aprovação' });
      }

      const cargoAprovacao = await carregarCargoAprovacao(req.user.sub);
      if (cargoAprovacao !== 'financeiro') {
        return res.status(403).json({ error: 'Somente o Financeiro pode encaminhar ao Diretor' });
      }
      if (chamado.rows[0].aprovacao_destino !== 'financeiro') {
        return res.status(400).json({ error: 'Este orçamento não está com o Financeiro' });
      }
      if (chamado.rows[0].aprovacao_diretor_ok) {
        return res.status(400).json({ error: 'O Diretor já avaliou este orçamento' });
      }

      const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [req.user.sub]);
      const autorNome = autor.rows[0]?.nome || 'Financeiro';
      const numero = chamado.rows[0].numero;
      const textoEvento =
        observacao.length >= 3
          ? `${observacao}\n\nEncaminhado ao Diretor para avaliação.`
          : 'Encaminhado ao Diretor para avaliação.';

      if (observacao.length >= 3) {
        try {
          await pool.query(
            `INSERT INTO manut_atualizacoes (id_chamado, id_usuario, texto)
             VALUES ($1, $2, $3)`,
            [idChamado, req.user.sub, observacao],
          );
        } catch (e) {
          if (e.code !== '42P01') throw e;
        }
      }

      const { rows } = await pool.query(
        `UPDATE manut_chamados
         SET aprovacao_destino = 'diretor',
             updated_at = NOW()
         WHERE id_chamado = $1
         RETURNING id_chamado, status::text AS status, tipo_chamado::text AS tipo_chamado,
                   aprovacao_destino, aprovacao_diretor_ok`,
        [idChamado],
      );

      await registrarEventoChamado({
        idChamado,
        tipo: 'encaminhar_diretor',
        idUsuario: req.user.sub,
        statusRef: 'em_aprovacao',
        texto: textoEvento,
      });
      await notificarAprovadoresOrcamento(
        idChamado,
        req.user.sub,
        `#${numero} · Orçamento encaminhado ao Diretor para avaliação — ${autorNome}`,
        'diretor',
        'encaminhar_diretor',
      );

      res.json(rows[0]);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/chamados/:id/aprovar',
  requirePermissao('chamados.aprovar'),
  async (req, res, next) => {
    try {
      const idChamado = Number(req.params.id);
      const observacao = String(req.body?.observacao || '').trim();
      const modo = String(req.body?.modo || 'definitivo').trim();

      const chamado = await pool.query(
        `SELECT id_loja, status::text AS status, numero, tipo_chamado::text AS tipo_chamado,
                aprovacao_destino, aprovacao_diretor_ok
         FROM manut_chamados WHERE id_chamado = $1`,
        [idChamado],
      );
      if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
      if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
        return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
      }
      if (chamado.rows[0].status !== 'em_aprovacao') {
        return res.status(400).json({ error: 'Chamado não está aguardando aprovação' });
      }

      const cargoAprovacao = await carregarCargoAprovacao(req.user.sub);
      if (!destinoPermiteCargo(chamado.rows[0].aprovacao_destino, cargoAprovacao)) {
        return res.status(403).json({ error: 'Este orçamento não está destinado ao seu cargo' });
      }

      const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [req.user.sub]);
      const autorNome = autor.rows[0]?.nome || 'Aprovador';
      const numero = chamado.rows[0].numero;

      if (modo === 'devolver_financeiro') {
        if (cargoAprovacao !== 'diretor' || chamado.rows[0].aprovacao_destino !== 'diretor') {
          return res.status(400).json({ error: 'Somente o Diretor pode devolver ao Financeiro' });
        }

        const textoEvento =
          observacao.length >= 3
            ? `${observacao}\n\nAprovado pelo Diretor. Aguarda aprovação final do Financeiro.`
            : 'Aprovado pelo Diretor. Aguarda aprovação final do Financeiro.';

        if (observacao.length >= 3) {
          try {
            await pool.query(
              `INSERT INTO manut_atualizacoes (id_chamado, id_usuario, texto)
               VALUES ($1, $2, $3)`,
              [idChamado, req.user.sub, observacao],
            );
          } catch (e) {
            if (e.code !== '42P01') throw e;
          }
        }

        const { rows } = await pool.query(
          `UPDATE manut_chamados
           SET aprovacao_destino = 'financeiro',
               aprovacao_diretor_ok = TRUE,
               updated_at = NOW()
           WHERE id_chamado = $1
           RETURNING id_chamado, status::text AS status, tipo_chamado::text AS tipo_chamado,
                     aprovacao_destino, aprovacao_diretor_ok`,
          [idChamado],
        );

        await registrarEventoChamado({
          idChamado,
          tipo: 'aprovacao_diretor',
          idUsuario: req.user.sub,
          statusRef: 'em_aprovacao',
          texto: textoEvento,
        });
        await notificarAprovadoresOrcamento(
          idChamado,
          req.user.sub,
          `#${numero} · Orçamento aprovado pelo Diretor e enviado ao Financeiro — ${autorNome}`,
          'financeiro',
          'aprovacao_diretor',
        );

        return res.json(rows[0]);
      }

      const textoEvento =
        observacao.length >= 3 ? observacao : 'Orçamento aprovado';

      if (observacao.length >= 3) {
        try {
          await pool.query(
            `INSERT INTO manut_atualizacoes (id_chamado, id_usuario, texto)
             VALUES ($1, $2, $3)`,
            [idChamado, req.user.sub, observacao],
          );
        } catch (e) {
          if (e.code !== '42P01') throw e;
        }
      }

      const { rows } = await pool.query(
        `UPDATE manut_chamados
         SET status = 'aprovado'::manut_status_chamado,
             tipo_chamado = 'orcamento'::manut_tipo_chamado,
             updated_at = NOW()
         WHERE id_chamado = $1
         RETURNING id_chamado, status::text AS status, tipo_chamado::text AS tipo_chamado,
                   aprovacao_destino, aprovacao_diretor_ok`,
        [idChamado],
      );

      await registrarEventoChamado({
        idChamado,
        tipo: 'aprovacao',
        idUsuario: req.user.sub,
        statusRef: 'aprovado',
        texto: textoEvento,
      });
      await notificarEventoChamado(
        idChamado,
        req.user.sub,
        'aprovacao',
        `Chamado #${numero} - Orçamento aprovado (${autorNome})`,
      );

      res.json(rows[0]);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/chamados/:id/recusar-orcamento',
  requirePermissao('chamados.aprovar'),
  async (req, res, next) => {
    try {
      const idChamado = Number(req.params.id);
      const observacao = String(req.body?.observacao || '').trim();

      const chamado = await pool.query(
        `SELECT id_loja, status::text AS status, numero, tipo_chamado::text AS tipo_chamado,
                aprovacao_destino
         FROM manut_chamados WHERE id_chamado = $1`,
        [idChamado],
      );
      if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
      if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
        return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
      }
      if (chamado.rows[0].status !== 'em_aprovacao') {
        return res.status(400).json({ error: 'Chamado não está aguardando aprovação' });
      }

      const cargoAprovacao = await carregarCargoAprovacao(req.user.sub);
      if (!destinoPermiteCargo(chamado.rows[0].aprovacao_destino, cargoAprovacao)) {
        return res.status(403).json({ error: 'Este orçamento não está destinado ao seu cargo' });
      }

      const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [req.user.sub]);
      const autorNome = autor.rows[0]?.nome || 'Aprovador';
      const numero = chamado.rows[0].numero;
      const textoEvento =
        observacao.length >= 3 ? observacao : 'Orçamento não aprovado';

      if (observacao.length >= 3) {
        try {
          await pool.query(
            `INSERT INTO manut_atualizacoes (id_chamado, id_usuario, texto)
             VALUES ($1, $2, $3)`,
            [idChamado, req.user.sub, observacao],
          );
        } catch (e) {
          if (e.code !== '42P01') throw e;
        }
      }

      const { rows } = await pool.query(
        `UPDATE manut_chamados
         SET status = 'em_atendimento'::manut_status_chamado,
             aprovacao_diretor_ok = FALSE,
             updated_at = NOW()
         WHERE id_chamado = $1
         RETURNING id_chamado, status::text AS status, tipo_chamado::text AS tipo_chamado`,
        [idChamado],
      );

      await registrarEventoChamado({
        idChamado,
        tipo: 'recusa_aprovacao',
        idUsuario: req.user.sub,
        statusRef: 'em_atendimento',
        texto: textoEvento,
      });
      await notificarEventoChamado(
        idChamado,
        req.user.sub,
        'recusa_aprovacao',
        `Orçamento do chamado #${numero} não aprovado (${autorNome})`,
      );

      res.json(rows[0]);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/chamados/:id/finalizar',
  requirePermissao('chamados.assumir', 'chamados.ver'),
  async (req, res, next) => {
    try {
      const idChamado = Number(req.params.id);
      const status = String(req.body?.status || '').trim();
      const observacao = String(req.body?.observacao || '').trim();

      if (status !== 'concluido' && status !== 'cancelado') {
        return res.status(400).json({ error: 'Status inválido. Use concluido ou cancelado.' });
      }

      const chamado = await pool.query(
        `SELECT id_loja, status::text AS status, numero, tipo_chamado::text AS tipo_chamado
         FROM manut_chamados WHERE id_chamado = $1`,
        [idChamado],
      );
      if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
      if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
        return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
      }
      if (ENCERRADOS.has(chamado.rows[0].status)) {
        return res.status(400).json({ error: 'Chamado já está encerrado' });
      }
      if (!ABERTOS.has(chamado.rows[0].status)) {
        return res.status(400).json({ error: 'Status não permite encerramento' });
      }
      if (
        status === 'concluido' &&
        chamado.rows[0].tipo_chamado === 'orcamento' &&
        chamado.rows[0].status !== 'aprovado'
      ) {
        return res.status(400).json({
          error: 'Orçamento precisa ser aprovado pelo diretor antes de concluir o chamado',
        });
      }

      const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [req.user.sub]);
      const autorNome = autor.rows[0]?.nome || 'Usuário';
      const numero = chamado.rows[0].numero;

      if (observacao.length >= 3) {
        try {
          await pool.query(
            `INSERT INTO manut_atualizacoes (id_chamado, id_usuario, texto)
             VALUES ($1, $2, $3)`,
            [idChamado, req.user.sub, observacao],
          );
        } catch (e) {
          if (e.code !== '42P01') throw e;
        }
      }

      const { rows } = await pool.query(
        `UPDATE manut_chamados
         SET status = $1::manut_status_chamado, fechado_em = NOW(), updated_at = NOW()
         WHERE id_chamado = $2
         RETURNING id_chamado, status::text AS status, fechado_em`,
        [status, idChamado],
      );

      const acao = status === 'concluido' ? 'concluído' : 'cancelado';
      await registrarEventoChamado({
        idChamado,
        tipo: 'fechamento',
        idUsuario: req.user.sub,
        statusRef: status,
        texto: observacao.length >= 3 ? observacao : null,
      });
      await notificarEventoChamado(
        idChamado,
        req.user.sub,
        'fechamento',
        `Chamado #${numero} ${acao} por ${autorNome}`,
      );

      res.json(rows[0]);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/chamados/:id/reabrir',
  requirePermissao('chamados.assumir', 'chamados.ver'),
  async (req, res, next) => {
    try {
      const idChamado = Number(req.params.id);
      const observacao = String(req.body?.observacao || '').trim();

      const chamado = await pool.query(
        `SELECT id_loja, status::text AS status, numero, id_tecnico
         FROM manut_chamados WHERE id_chamado = $1`,
        [idChamado],
      );
      if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
      if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
        return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
      }
      if (!ENCERRADOS.has(chamado.rows[0].status)) {
        return res.status(400).json({ error: 'Chamado já está aberto' });
      }

      const autor = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [req.user.sub]);
      const autorNome = autor.rows[0]?.nome || 'Usuário';
      const numero = chamado.rows[0].numero;
      const novoStatus = chamado.rows[0].id_tecnico ? 'em_atendimento' : 'aberto';
      const { rows } = await pool.query(
        `UPDATE manut_chamados
         SET status = $1::manut_status_chamado, fechado_em = NULL, updated_at = NOW()
         WHERE id_chamado = $2
         RETURNING id_chamado, status::text AS status, fechado_em`,
        [novoStatus, idChamado],
      );

      await registrarEventoChamado({
        idChamado,
        tipo: 'reabertura',
        idUsuario: req.user.sub,
        statusRef: novoStatus,
        texto: observacao.length >= 3 ? observacao : null,
      });
      await notificarEventoChamado(
        idChamado,
        req.user.sub,
        'reabertura',
        `Chamado #${numero} reaberto por ${autorNome}`,
      );

      res.json(rows[0]);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/notificacoes',
  requirePermissao('chamados.ver', 'chamados.abrir', 'chamados.aprovar'),
  async (req, res, next) => {
  try {
    await ensureNotificacoesTable();
    const idUsuario = Number(req.user.sub);
    const contexto = String(req.query.contexto || '').trim();
    const filtroCtx = sqlFiltroContextoNotificacoes(contexto);
    const params = [idUsuario];
    const { filtroExtra } = await filtroNotificacoesAprovacoes(idUsuario, contexto, params);
    const { rows } = await pool.query(
      `SELECT n.id_notificacao, n.id_chamado, n.tipo, n.mensagem, n.lida, n.created_at,
              c.numero, c.id_loja, l.name AS loja
       FROM manut_notificacoes n
       JOIN manut_chamados c ON c.id_chamado = n.id_chamado
       JOIN lojas l ON l.id_loja = c.id_loja
       WHERE n.id_usuario = $1${filtroCtx}${filtroExtra}
       ORDER BY n.created_at DESC
       LIMIT 30`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
  },
);

router.get(
  '/notificacoes/nao-lidas',
  requirePermissao('chamados.ver', 'chamados.abrir', 'chamados.aprovar'),
  async (req, res, next) => {
  try {
    await ensureNotificacoesTable();
    const idUsuario = Number(req.user.sub);
    const idLoja = req.query.id_loja != null ? Number(req.query.id_loja) : null;
    const filtrarLoja = idLoja != null && Number.isFinite(idLoja);
    const contexto = String(req.query.contexto || '').trim();
    const filtroCtx = sqlFiltroContextoNotificacoes(contexto);
    const params = filtrarLoja ? [idUsuario, idLoja] : [idUsuario];
    const { filtroExtra } = await filtroNotificacoesAprovacoes(idUsuario, contexto, params);
    const precisaJoin = filtrarLoja || contexto === 'aprovacoes';
    const { rows } = await pool.query(
      precisaJoin
        ? `SELECT COUNT(*)::int AS total
           FROM manut_notificacoes n
           JOIN manut_chamados c ON c.id_chamado = n.id_chamado
           WHERE n.id_usuario = $1 AND n.lida = FALSE${filtrarLoja ? ' AND c.id_loja = $2' : ''}${filtroCtx}${filtroExtra}`
        : `SELECT COUNT(*)::int AS total
           FROM manut_notificacoes n
           WHERE n.id_usuario = $1 AND n.lida = FALSE${filtroCtx}`,
      params,
    );
    res.json({ total: rows[0]?.total ?? 0 });
  } catch (e) {
    next(e);
  }
  },
);

router.patch(
  '/notificacoes/chamado/:idChamado/lidas',
  requirePermissao('chamados.ver', 'chamados.abrir', 'chamados.aprovar'),
  async (req, res, next) => {
    try {
      await ensureNotificacoesTable();
      const idChamado = Number(req.params.idChamado);
      const idUsuario = Number(req.user.sub);
      await pool.query(
        `UPDATE manut_notificacoes SET lida = TRUE
         WHERE id_usuario = $1 AND id_chamado = $2 AND lida = FALSE`,
        [idUsuario, idChamado],
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/notificacoes/:id/lida',
  requirePermissao('chamados.ver', 'chamados.abrir', 'chamados.aprovar'),
  async (req, res, next) => {
  try {
    await ensureNotificacoesTable();
    const id = Number(req.params.id);
    const idUsuario = Number(req.user.sub);
    await pool.query(
      `UPDATE manut_notificacoes SET lida = TRUE WHERE id_notificacao = $1 AND id_usuario = $2`,
      [id, idUsuario],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/notificacoes/lidas',
  requirePermissao('chamados.ver', 'chamados.abrir', 'chamados.aprovar'),
  async (req, res, next) => {
  try {
    await ensureNotificacoesTable();
    const idUsuario = Number(req.user.sub);
    const idLoja = req.query.id_loja != null ? Number(req.query.id_loja) : null;
    const filtrarLoja = idLoja != null && Number.isFinite(idLoja);
    const contexto = String(req.query.contexto || '').trim();
    const filtroCtx = sqlFiltroContextoNotificacoes(contexto, 'n');
    if (filtrarLoja || contexto === 'aprovacoes') {
      const params = filtrarLoja ? [idUsuario, idLoja] : [idUsuario];
      const { filtroExtra } = await filtroNotificacoesAprovacoes(idUsuario, contexto, params);
      await pool.query(
        `UPDATE manut_notificacoes n SET lida = TRUE
         FROM manut_chamados c
         WHERE n.id_chamado = c.id_chamado
           AND n.id_usuario = $1 AND n.lida = FALSE${filtrarLoja ? ' AND c.id_loja = $2' : ''}${filtroCtx}${filtroExtra}`,
        params,
      );
    } else {
      await pool.query(
        `UPDATE manut_notificacoes n SET lida = TRUE
         WHERE n.id_usuario = $1 AND n.lida = FALSE${filtroCtx}`,
        [idUsuario],
      );
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
  },
);

ensureNotificacaoEventosTable().catch(() => {});
ensureEventosChamadoTable().catch(() => {});
ensureNotificacoesTable().catch((e) => {
  console.warn('[manutencao] Notificações indisponíveis no boot:', e.message);
});

export default router;
