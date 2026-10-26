import { pool } from './db.js';

export const CATALOGO_PERMISSOES = [
  { codigo: 'portal.dashboard.ver', nome: 'Ver dashboard (início, ranking e NCs)', grupo: 'Início', ordem: 10 },
  { codigo: 'portal.visitas.ver', nome: 'Ver histórico de visitas', grupo: 'Visitas', ordem: 20 },
  { codigo: 'portal.visitas.apagar', nome: 'Apagar relatórios de visitas', grupo: 'Visitas', ordem: 21 },
  { codigo: 'portal.visitas.reabrir', nome: 'Reabrir visitas finalizadas para edição', grupo: 'Visitas', ordem: 22 },
  { codigo: 'checklist.ver', nome: 'Acessar AutoREV em loja', grupo: 'AutoREV', ordem: 26 },
  { codigo: 'checklist.executar', nome: 'Executar AutoREV e registrar visita', grupo: 'AutoREV', ordem: 28 },
  { codigo: 'configuracoes.perguntas', nome: 'Perguntas do checklist', grupo: 'Configurações', ordem: 68 },
  { codigo: 'configuracoes.notificacoes', nome: 'Gerir notificações', grupo: 'Configurações', ordem: 69 },
  { codigo: 'configuracoes.ver', nome: 'Acessar configurações', grupo: 'Configurações', ordem: 70 },
  { codigo: 'configuracoes.auditoria', nome: 'Ver auditoria do sistema', grupo: 'Configurações', ordem: 71 },
  { codigo: 'portal.lojas.ver', nome: 'Ver cadastro de lojas', grupo: 'Configurações', ordem: 72 },
  { codigo: 'chamados.ver', nome: 'Ver chamados de manutenção', grupo: 'Manutenção', ordem: 80 },
  { codigo: 'chamados.abrir', nome: 'Abrir chamado de manutenção', grupo: 'Manutenção', ordem: 90 },
  { codigo: 'chamados.assumir', nome: 'Assumir chamado', grupo: 'Manutenção', ordem: 100 },
  { codigo: 'chamados.aprovar', nome: 'Aprovar orçamentos', grupo: 'Manutenção', ordem: 105 },
  { codigo: 'usuarios.listar', nome: 'Listar usuários (ex.: escolher auditor no checklist)', grupo: 'Usuários', ordem: 110 },
  { codigo: 'usuarios.gerenciar', nome: 'Gerenciar usuários e permissões', grupo: 'Usuários', ordem: 120 },
  { codigo: 'lojas.todas', nome: 'Todas as lojas (estoque, visitas, chamados e demais módulos)', grupo: 'Lojas', ordem: 130 },
  { codigo: 'frota.regioes', nome: 'Gerenciar regiões de atuação', grupo: 'Lojas', ordem: 131 },
  { codigo: 'frota.usar', nome: 'Usar módulo de frota no app mobile', grupo: 'Frota', ordem: 140 },
  { codigo: 'frota.mapa.ver', nome: 'Ver mapa de técnicos em tempo real', grupo: 'Frota', ordem: 142 },
  { codigo: 'frota.gerenciar', nome: 'Cadastrar veículos e gerenciar frota', grupo: 'Frota', ordem: 145 },
  { codigo: 'frota.multas.sync', nome: 'Sincronizar Multas', grupo: 'Frota', ordem: 146 },
  { codigo: 'frota.debitos.ver', nome: 'Ver aba Débitos (IPVA e Licenciamento)', grupo: 'Frota', ordem: 147 },
  { codigo: 'frota.debitos.sync', nome: 'Sincronizar Débitos', grupo: 'Frota', ordem: 148 },
  { codigo: 'escalas.visitas.gerenciar', nome: 'Gerenciar escala de visitas semanal', grupo: 'Escalas', ordem: 150 },
  { codigo: 'escalas.visitas.ver', nome: 'Ver escala de visitas semanal', grupo: 'Escalas', ordem: 151 },
  { codigo: 'escalas.visitas.editar_regiao', nome: 'Montar escala de visitas da própria região', grupo: 'Escalas', ordem: 152 },
  { codigo: 'escalas.visitas.editar_delivery', nome: 'Preencher escala de delivery', grupo: 'Escalas', ordem: 153 },
  { codigo: 'metas.gerenciar', nome: 'Gerenciar metas e indicadores', grupo: 'Metas', ordem: 160 },
  { codigo: 'metas.ver', nome: 'Ver metas da empresa e gestores', grupo: 'Metas', ordem: 161 },
  { codigo: 'estoque.produtos', nome: 'Insumos — cadastrar e editar', grupo: 'Estoque', ordem: 200 },
  { codigo: 'estoque.conferencia', nome: 'Conferência — iniciar, salvar e finalizar', grupo: 'Estoque', ordem: 201 },
  { codigo: 'estoque.conferencia.reabrir', nome: 'Reabrir conferências finalizadas para edição', grupo: 'Estoque', ordem: 202 },
  { codigo: 'estoque.operacional', nome: 'Operacional — vendas, ficha, break e saldos', grupo: 'Estoque', ordem: 203 },
  { codigo: 'estoque.break', nome: 'Break — lançar consumo de colaboradores', grupo: 'Estoque', ordem: 204 },
  { codigo: 'ncs.ver', nome: 'Ver não conformidades da região', grupo: 'Não conformidades', ordem: 170 },
  { codigo: 'ncs.resolver', nome: 'Resolver não conformidades (foto e encerramento)', grupo: 'Não conformidades', ordem: 171 },
  { codigo: 'energia.ver', nome: 'Ver chamados de energia e relatórios', grupo: 'Energia', ordem: 175 },
  { codigo: 'energia.abrir', nome: 'Registrar protocolo e fotos de ocorrência de energia', grupo: 'Energia', ordem: 176 },
  { codigo: 'financeiro.ver', nome: 'Ver módulo Financeiro (contas a pagar, caixa, DDA)', grupo: 'Financeiro', ordem: 185 },
  { codigo: 'financeiro.resumo.ver', nome: 'Ver gastos e pagamentos no Command Center', grupo: 'Financeiro', ordem: 186 },
  { codigo: 'freelancers.aprovar', nome: 'Aprovar turnos de freelancers (ponto) na região', grupo: 'Freelancers', ordem: 180 },
  { codigo: 'sistema.backup', nome: 'Gerar e baixar dump do banco (TI)', grupo: 'Sistema', ordem: 190 },
  { codigo: 'ti.tickets.abrir', nome: 'Abrir chamado para o TI', grupo: 'TI / Tickets', ordem: 200 },
  { codigo: 'ti.tickets.gerenciar', nome: 'Gerenciar board de tickets do TI', grupo: 'TI / Tickets', ordem: 201 },
];

const PERMISSOES_DASHBOARD = new Set([
  'portal.dashboard.ver',
  'portal.ranking.ver',
  'portal.ncs.ver',
]);

let catalogoSyncPromise = null;

/** Garante que todas as permissões do catálogo existem na tabela permissoes (evita FK ao salvar usuário). */
export async function ensureCatalogoPermissoes() {
  if (!catalogoSyncPromise) {
    catalogoSyncPromise = (async () => {
      for (const p of CATALOGO_PERMISSOES) {
        await pool.query(
          `INSERT INTO permissoes (codigo, nome, grupo, ordem)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (codigo) DO UPDATE SET
             nome = EXCLUDED.nome,
             grupo = EXCLUDED.grupo,
             ordem = EXCLUDED.ordem`,
          [p.codigo, p.nome, p.grupo, p.ordem],
        );
      }
      codigosValidosCache = null;
    })().catch((e) => {
      catalogoSyncPromise = null;
      throw e;
    });
  }
  return catalogoSyncPromise;
}

let codigosValidosCache = null;

async function carregarCodigosValidos() {
  await ensureCatalogoPermissoes();
  if (!codigosValidosCache) {
    const { rows } = await pool.query('SELECT codigo FROM permissoes');
    codigosValidosCache = new Set(rows.map((r) => r.codigo));
  }
  return codigosValidosCache;
}

/** Catálogo efetivo (banco após sync), usado na tela de Usuários. */
export async function listarCatalogoPermissoes() {
  await ensureCatalogoPermissoes();
  const { rows } = await pool.query(
    'SELECT codigo, nome, grupo, ordem FROM permissoes ORDER BY ordem, codigo',
  );
  return rows.length ? rows : [...CATALOGO_PERMISSOES];
}

export async function carregarPermissoesCargo(codigoCargo) {
  if (!codigoCargo) return [];
  try {
    const { rows } = await pool.query(
      `SELECT cp.codigo
       FROM cargo_permissoes cp
       JOIN permissoes p ON p.codigo = cp.codigo
       WHERE cp.codigo_cargo = $1
       ORDER BY p.ordem`,
      [codigoCargo],
    );
    return rows.map((r) => r.codigo);
  } catch {
    return [];
  }
}

export async function syncCargoPermissoes(codigoCargo, codigos) {
  await ensureCatalogoPermissoes();
  const lista = await normalizarPermissoes(codigos);
  await pool.query(`DELETE FROM cargo_permissoes WHERE codigo_cargo = $1`, [codigoCargo]);
  if (lista.length) {
    await pool.query(
      `INSERT INTO cargo_permissoes (codigo_cargo, codigo)
       SELECT $1, unnest($2::text[])
       ON CONFLICT DO NOTHING`,
      [codigoCargo, lista],
    );
  }
  // Espelha em lote nos usuários do perfil (compat + login imediato)
  const { rows: users } = await pool.query(
    `SELECT id_usuario FROM usuarios WHERE cargo_aprovacao = $1`,
    [codigoCargo],
  );
  if (users.length) {
    const ids = users.map((u) => u.id_usuario);
    // Preserva override de rede (Igor/Clemerson e quem já tinha lojas.todas)
    const { rows: comTodas } = await pool.query(
      `SELECT u.id_usuario
       FROM usuarios u
       WHERE u.id_usuario = ANY($1::int[])
         AND (
           lower(u.nome) ~* '(^| )igor( |$)'
           OR lower(coalesce(u.email, '')) LIKE '%igor%'
           OR lower(u.nome) ~* 'clemerson'
           OR lower(coalesce(u.email, '')) LIKE '%clemerson%'
           OR EXISTS (
             SELECT 1 FROM usuario_permissoes up
             WHERE up.id_usuario = u.id_usuario AND up.codigo = 'lojas.todas'
           )
         )`,
      [ids],
    );
    const idsTodas = new Set(comTodas.map((r) => r.id_usuario));
    await pool.query(
      `DELETE FROM usuario_permissoes WHERE id_usuario = ANY($1::int[])`,
      [ids],
    );
    if (lista.length) {
      await pool.query(
        `INSERT INTO usuario_permissoes (id_usuario, codigo)
         SELECT u.id, p.codigo
         FROM unnest($1::int[]) AS u(id)
         CROSS JOIN unnest($2::text[]) AS p(codigo)
         ON CONFLICT DO NOTHING`,
        [ids, lista],
      );
    }
    if (idsTodas.size) {
      await pool.query(
        `INSERT INTO usuario_permissoes (id_usuario, codigo)
         SELECT unnest($1::int[]), 'lojas.todas'
         ON CONFLICT DO NOTHING`,
        [[...idsTodas]],
      );
    }
  }
  return lista;
}

export async function carregarPermissoesUsuario(idUsuario) {
  // Fonte principal: permissões do perfil (cargo)
  let perms = [];
  try {
    const { rows } = await pool.query(
      `SELECT cp.codigo
       FROM usuarios u
       JOIN cargo_permissoes cp ON cp.codigo_cargo = u.cargo_aprovacao
       JOIN permissoes p ON p.codigo = cp.codigo
       WHERE u.id_usuario = $1
       ORDER BY p.ordem`,
      [idUsuario],
    );
    perms = rows.map((r) => r.codigo);
  } catch {
    /* cargo_permissoes ainda não migrada */
  }

  // Fallback legado: usuario_permissoes se o perfil ainda não tem matriz
  if (!perms.length) {
    const { rows } = await pool.query(
      `SELECT up.codigo
       FROM usuario_permissoes up
       JOIN permissoes p ON p.codigo = up.codigo
       WHERE up.id_usuario = $1
       ORDER BY p.ordem`,
      [idUsuario],
    );
    perms = rows.map((r) => r.codigo);
  }

  // Override individual (ex.: Igor/Clemerson com lojas.todas fora da matriz do cargo)
  try {
    const { rows: extras } = await pool.query(
      `SELECT up.codigo
       FROM usuario_permissoes up
       JOIN permissoes p ON p.codigo = up.codigo
       WHERE up.id_usuario = $1
         AND up.codigo = 'lojas.todas'`,
      [idUsuario],
    );
    for (const r of extras) {
      if (!perms.includes(r.codigo)) perms.push(r.codigo);
    }
  } catch {
    /* ignore */
  }

  try {
    const { rows: acc } = await pool.query(
      `SELECT 1 FROM ti_ticket_acessos
       WHERE id_usuario = $1 AND pode_gerenciar = TRUE
       LIMIT 1`,
      [idUsuario],
    );
    if (acc.length && !perms.includes('ti.tickets.gerenciar')) {
      perms.push('ti.tickets.gerenciar');
    }
    if (acc.length && !perms.includes('ti.tickets.abrir')) {
      perms.push('ti.tickets.abrir');
    }
  } catch {
    /* tabela ainda não migrada */
  }
  return perms;
}

export async function normalizarPermissoes(codigos) {
  const validos = await carregarCodigosValidos();
  return [...new Set((codigos || []).filter((c) => validos.has(c)))];
}

/** Permissões efetivas do usuário (apenas as informadas explicitamente). */
export async function resolverPermissoesUsuario(_perfil, permissoes) {
  return normalizarPermissoes(permissoes);
}

export async function syncUsuarioPermissoes(idUsuario, codigos) {
  await ensureCatalogoPermissoes();
  const lista = await normalizarPermissoes(codigos);
  // Preserva override de rede (lojas.todas) ao espelhar o perfil
  const { rows: tinhaTodas } = await pool.query(
    `SELECT 1
     FROM usuarios u
     WHERE u.id_usuario = $1
       AND (
         EXISTS (
           SELECT 1 FROM usuario_permissoes up
           WHERE up.id_usuario = u.id_usuario AND up.codigo = 'lojas.todas'
         )
         OR lower(u.nome) ~* '(^| )igor( |$)'
         OR lower(coalesce(u.email, '')) LIKE '%igor%'
         OR lower(u.nome) ~* 'clemerson'
         OR lower(coalesce(u.email, '')) LIKE '%clemerson%'
       )
     LIMIT 1`,
    [idUsuario],
  );
  const manterTodas = tinhaTodas.length > 0 || lista.includes('lojas.todas');
  await pool.query('DELETE FROM usuario_permissoes WHERE id_usuario = $1', [idUsuario]);
  if (lista.length) {
    await pool.query(
      `INSERT INTO usuario_permissoes (id_usuario, codigo)
       SELECT $1, unnest($2::text[])
       ON CONFLICT DO NOTHING`,
      [idUsuario, lista],
    );
  }
  if (manterTodas && !lista.includes('lojas.todas')) {
    await pool.query(
      `INSERT INTO usuario_permissoes (id_usuario, codigo) VALUES ($1, 'lojas.todas')
       ON CONFLICT DO NOTHING`,
      [idUsuario],
    );
  }
  return lista;
}

export function temPermissao(user, codigo) {
  const perms = user?.permissoes || [];
  if (perms.includes(codigo)) return true;
  if (codigo === 'portal.dashboard.ver' && perms.some((p) => PERMISSOES_DASHBOARD.has(p))) {
    return true;
  }
  return false;
}

export function acessoTodasLojas(user) {
  return temPermissao(user, 'lojas.todas');
}

export async function attachPermissoesUsuario(req, _res, next) {
  if (!req.user?.sub) return next();
  try {
    req.user.permissoes = await carregarPermissoesUsuario(req.user.sub);
    next();
  } catch (e) {
    next(e);
  }
}

export function requirePermissao(...codigos) {
  return (req, res, next) => {
    if (!codigos.some((c) => temPermissao(req.user, c))) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}
