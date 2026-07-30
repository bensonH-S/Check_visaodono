import { pool } from '../db.js';
import { logger } from '../logger.js';

let tabelaOk = null;

const SQL_CRIAR_TABELA = `
CREATE TABLE IF NOT EXISTS sistema_auditoria (
  id_auditoria SERIAL PRIMARY KEY,
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  modulo VARCHAR(40) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  entidade VARCHAR(60),
  id_referencia VARCHAR(80),
  descricao TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_created ON sistema_auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_modulo ON sistema_auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_usuario ON sistema_auditoria(id_usuario);
`;

const ACAO_LABEL = {
  login: 'Entrou no sistema',
  logout: 'Saiu do sistema',
  login_falha: 'Tentativa de acesso falhou',
  criar: 'Criou',
  atualizar: 'Alterou',
  excluir: 'Excluiu',
  iniciar: 'Iniciou',
  finalizar: 'Finalizou',
  reabrir: 'Reabriu visita',
  anexar_documento: 'Anexou documento',
  excluir_documento: 'Removeu documento',
  assumir_veiculo: 'Assumiu veículo',
  devolver_veiculo: 'Devolveu veículo',
  salvar_escala: 'Salvou escala',
  copiar_escala: 'Copiou escala',
  salvar_realizado: 'Salvou realizado',
  salvar_ranking: 'Salvou ranking',
  salvar_premio: 'Salvou prêmio',
  atualizacao: 'Atualizou chamado',
  assumido: 'Assumiu chamado',
  envio_aprovacao: 'Enviou para aprovação',
  encaminhar_diretor: 'Encaminhou ao diretor',
  aprovacao_diretor: 'Aprovação do diretor',
  aprovacao: 'Aprovou chamado',
  recusa_aprovacao: 'Recusou aprovação',
  fechamento: 'Fechou chamado',
  reabertura: 'Reabriu chamado',
  criado: 'Criou chamado',
  status: 'Alterou status',
};

const MODULO_LABEL = {
  auth: 'Acesso',
  usuarios: 'Usuários',
  cargos: 'Cargos',
  lojas: 'Lojas',
  configuracoes: 'Configurações',
  chamados: 'Chamados',
  frota: 'Frota',
  visitas: 'Visitas',
  escalas: 'Escalas',
  metas: 'Metas',
  checklist: 'Checklist',
  sistema: 'Sistema',
};

async function garantirTabela() {
  if (tabelaOk != null) return tabelaOk;
  try {
    await pool.query(SQL_CRIAR_TABELA);
    tabelaOk = true;
  } catch (e) {
    logger.warn('auditoria', 'Tabela sistema_auditoria indisponível', { error: e.message });
    tabelaOk = false;
  }
  return tabelaOk;
}

/** Registra evento na trilha de auditoria (não bloqueia operação principal). */
export async function registrarAuditoria({
  idUsuario,
  modulo,
  acao,
  entidade = null,
  idReferencia = null,
  descricao,
  detalhes = null,
}) {
  if (!(await garantirTabela())) return;
  try {
    await pool.query(
      `INSERT INTO sistema_auditoria (id_usuario, modulo, acao, entidade, id_referencia, descricao, detalhes)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        idUsuario ?? null,
        String(modulo || 'sistema').slice(0, 40),
        String(acao || 'acao').slice(0, 40),
        entidade ? String(entidade).slice(0, 60) : null,
        idReferencia != null ? String(idReferencia).slice(0, 80) : null,
        String(descricao || '').slice(0, 4000),
        detalhes ? JSON.stringify(detalhes) : null,
      ],
    );
  } catch (e) {
    logger.warn('auditoria', 'Falha ao registrar evento', { error: e.message, modulo, acao });
  }
}

export async function initAuditoria() {
  return garantirTabela();
}

const LIMITE_MAX = 500;

function rotuloAcao(acao) {
  const key = String(acao || '').toLowerCase();
  return ACAO_LABEL[key] || String(acao || 'Ação').replace(/_/g, ' ');
}

function rotuloModulo(modulo) {
  const key = String(modulo || '').toLowerCase();
  return MODULO_LABEL[key] || modulo;
}

function classificarAcao(acao, descricao = '') {
  const a = String(acao || '').toLowerCase();
  const d = String(descricao || '').toLowerCase();
  if (a.includes('excluir') || a.includes('remov') || a === 'recusa_aprovacao' || d.includes('removeu') || d.includes('exclu')) {
    return 'exclusao';
  }
  if (a.includes('anexar') || a.includes('upload') || d.includes('enviou o arquivo') || d.includes('anexou')) {
    return 'upload';
  }
  if (a === 'login' || a === 'logout' || a === 'login_falha') return 'acesso';
  if (a.includes('criar') || a === 'iniciar' || a === 'criado') return 'criacao';
  if (a.includes('atualizar') || a.includes('salvar') || a.includes('alter') || a === 'finalizar') return 'alteracao';
  if (a.includes('assum') || a.includes('devolver') || a.includes('aprov') || a.includes('fechamento')) {
    return 'operacao';
  }
  return 'outro';
}

function parseDetalhes(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function bitsDoCorpo(corpo) {
  if (!corpo || typeof corpo !== 'object') return [];
  const bits = [];
  if (corpo.placa) bits.push(`placa ${corpo.placa}`);
  if (corpo.nome) bits.push(`“${corpo.nome}”`);
  if (corpo.titulo) bits.push(`“${corpo.titulo}”`);
  if (corpo.email) bits.push(String(corpo.email));
  if (corpo.modelo) bits.push(`modelo ${corpo.modelo}`);
  if (corpo.tipo) bits.push(`tipo ${corpo.tipo}`);
  if (corpo.nome_arquivo) bits.push(`arquivo “${corpo.nome_arquivo}”`);
  if (corpo.loja) bits.push(String(corpo.loja));
  if (corpo.indicador) bits.push(String(corpo.indicador));
  if (corpo.periodo) bits.push(`período ${corpo.periodo}`);
  if (corpo.alvo) bits.push(String(corpo.alvo));
  if (corpo.valor != null) bits.push(`valor ${corpo.valor}`);
  return bits.slice(0, 5);
}

function rotuloCaminho(caminho) {
  const p = String(caminho || '').toLowerCase();
  if (p.includes('/documentos')) return 'documento de veículo';
  if (p.includes('/frota/veiculos')) return 'veículo da frota';
  if (p.includes('/frota/regioes')) return 'região da frota';
  if (p.includes('/metas/realizados')) return 'realizado de metas';
  if (p.includes('/metas/rankings')) return 'ranking de metas';
  if (p.includes('/metas/premios')) return 'prêmio de metas';
  if (p.includes('/escalas')) return 'escala de visitas';
  if (p.includes('/usuarios')) return 'usuário';
  if (p.includes('/checklist')) return 'checklist';
  if (p.includes('/visitas')) return 'visita';
  if (p.includes('/cargos')) return 'cargo';
  if (p.includes('/lojas')) return 'loja';
  return null;
}

function limparDescricao(descricao, acao, detalhes) {
  const raw = String(descricao || '').trim();
  const det = parseDetalhes(detalhes);
  const bitsCorpo = bitsDoCorpo(det?.corpo);
  const bits = bitsCorpo.length ? bitsCorpo : bitsDoCorpo(det);

  // Lixo legado do middleware genérico (ex.: "criar em /auditoria/api/frota/posicao")
  const m = raw.match(/^(criar|atualizar|excluir)\s+em\s+(\/\S+)/i);
  if (m) {
    const path = m[2].toLowerCase();
    if (path.includes('/frota/posicao')) return null;
    const recurso = rotuloCaminho(path) || rotuloCaminho(det?.caminho) || 'registro';
    const extra = bits.length ? ` — ${bits.join(' · ')}` : '';
    const id = det?.caminho?.match(/\/(\d+)/)?.[1];
    return `${rotuloAcao(m[1])} ${recurso}${id ? ` #${id}` : ''}${extra}`;
  }

  // Textos genéricos demais
  if (!raw || /^(excluiu|criou|alterou)\s+(no sistema|recurso)/i.test(raw) || raw === rotuloAcao(acao)) {
    const recurso = rotuloCaminho(det?.caminho) || (det?.entidade ? String(det.entidade) : null);
    const extra = bits.length ? ` — ${bits.join(' · ')}` : '';
    if (recurso || extra) {
      return `${rotuloAcao(acao)}${recurso ? ` ${recurso}` : ''}${extra}`;
    }
  }

  // Enriquece descrições curtas antigas de documento
  if (/^documento (anexado|removido):/i.test(raw) && bits.length) {
    return `${raw} — ${bits.join(' · ')}`;
  }
  if (/^documento (anexado|removido):/i.test(raw) && det?.placa) {
    return `${raw} (veículo ${det.placa})`;
  }
  if (/^login realizado:/i.test(raw)) {
    return raw.replace(/^login realizado:\s*/i, '').replace(/\s*\(.*\)\s*$/, '') + ' entrou no sistema';
  }

  return raw || rotuloAcao(acao);
}

function mapRow(r) {
  const acao = r.acao;
  const descricao = limparDescricao(r.descricao, acao, r.detalhes);
  const tipo = classificarAcao(acao, descricao || r.descricao);
  return {
    created_at: r.created_at,
    modulo: r.modulo,
    modulo_label: rotuloModulo(r.modulo),
    acao,
    acao_label: rotuloAcao(acao),
    tipo_acao: tipo,
    entidade: r.entidade,
    id_referencia: r.id_referencia,
    descricao: descricao || rotuloAcao(acao),
    usuario_nome: r.usuario_nome,
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
    detalhes: r.detalhes ?? null,
  };
}

export async function listarAuditoria({
  limite = 100,
  offset = 0,
  modulo = null,
  idUsuario = null,
  q = null,
} = {}) {
  const take = Math.min(Math.max(Number(limite) || 100, 1), LIMITE_MAX);
  const skip = Math.max(Number(offset) || 0, 0);
  const filtroModulo = modulo ? String(modulo).trim().toLowerCase() : null;
  const filtroUsuario = idUsuario != null && idUsuario !== '' ? Number(idUsuario) : null;
  const busca = q ? String(q).trim() : '';

  const params = [take, skip];
  const wheres = [
    // Esconde ruído de GPS / paths genéricos legados
    `NOT (
       LOWER(COALESCE(sub.descricao, '')) LIKE '%/frota/posicao%'
       OR LOWER(COALESCE(sub.detalhes::text, '')) LIKE '%/frota/posicao%'
       OR LOWER(COALESCE(sub.entidade, '')) = 'posicao'
     )`,
  ];

  if (filtroModulo) {
    params.push(filtroModulo);
    wheres.push(`LOWER(sub.modulo) = $${params.length}`);
  }
  if (Number.isFinite(filtroUsuario) && filtroUsuario > 0) {
    params.push(filtroUsuario);
    wheres.push(`sub.id_usuario = $${params.length}`);
  }
  if (busca) {
    params.push(`%${busca.toLowerCase()}%`);
    const i = params.length;
    wheres.push(
      `(LOWER(COALESCE(sub.descricao, '')) LIKE $${i}
        OR LOWER(COALESCE(sub.acao, '')) LIKE $${i}
        OR LOWER(COALESCE(sub.usuario_nome, '')) LIKE $${i}
        OR LOWER(COALESCE(sub.entidade, '')) LIKE $${i}
        OR LOWER(COALESCE(sub.id_referencia, '')) LIKE $${i})`,
    );
  }

  const filtroSql = `WHERE ${wheres.join(' AND ')}`;
  const temSistema = await garantirTabela();
  const partes = [];

  if (temSistema) {
    partes.push(`
      SELECT a.created_at,
             a.modulo,
             a.acao,
             a.entidade,
             a.id_referencia,
             a.descricao,
             u.nome AS usuario_nome,
             a.id_usuario,
             a.detalhes
      FROM sistema_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
    `);
  }

  // Chamados: histórico operacional (não passa pelo middleware genérico)
  partes.push(`
    SELECT e.created_at,
           'chamados'::varchar AS modulo,
           e.tipo AS acao,
           'chamado'::varchar AS entidade,
           e.id_chamado::text AS id_referencia,
           CASE
             WHEN NULLIF(TRIM(e.texto), '') IS NOT NULL THEN
               ('Chamado #' || e.id_chamado::text || ' — ' || TRIM(e.texto))
             ELSE
               ('Chamado #' || e.id_chamado::text || ' — ' || REPLACE(e.tipo, '_', ' '))
           END AS descricao,
           u.nome AS usuario_nome,
           e.id_usuario,
           NULL::jsonb AS detalhes
    FROM manut_chamado_eventos e
    LEFT JOIN usuarios u ON u.id_usuario = e.id_usuario
  `);

  partes.push(`
    SELECT a.created_at,
           'chamados'::varchar AS modulo,
           'atualizacao'::varchar AS acao,
           'chamado'::varchar AS entidade,
           a.id_chamado::text AS id_referencia,
           ('Chamado #' || a.id_chamado::text || ' — ' || COALESCE(NULLIF(TRIM(a.texto), ''), 'atualização')) AS descricao,
           u.nome AS usuario_nome,
           a.id_usuario,
           NULL::jsonb AS detalhes
    FROM manut_atualizacoes a
    LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
  `);

  const unionSql = partes.join('\nUNION ALL\n');

  const { rows } = await pool.query(
    `SELECT sub.created_at, sub.modulo, sub.acao, sub.entidade, sub.id_referencia, sub.descricao,
            sub.usuario_nome, sub.id_usuario, sub.detalhes
     FROM (${unionSql}) sub
     ${filtroSql}
     ORDER BY sub.created_at DESC
     LIMIT $1 OFFSET $2`,
    params,
  );

  return rows.map(mapRow);
}

export { ACAO_LABEL, MODULO_LABEL, rotuloAcao, rotuloModulo };
