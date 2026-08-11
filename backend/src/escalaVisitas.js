import { pool } from './db.js';
import { acessoTodasLojas, temPermissao } from './permissoes.js';
import { carregarRegioesAtuacaoTecnico } from './lojasUsuario.js';

/**
 * Cores da legenda da planilha "Time de Campo" (Escala Grupo Alvim).
 * Renato=verde, Bárbara=amarelo, Igor=cinza, Plinio=azul, Fagno=ciano.
 * Kadu (laranja) é Delivery — não entra na paleta da grade de visitas; rota vai na aba Delivery.
 */
export const CORES_ESCALA_POR_NOME = [
  { chave: 'renato', cor: '#00B050' },
  { chave: 'barbara', cor: '#FFFF00' },
  { chave: 'igor', cor: '#CCCCCC' },
  { chave: 'plinio', cor: '#4A86E8' },
  { chave: 'fagno', cor: '#00FFFF' },
  // Mantido só para histórico/legado se algum nome ainda aparecer; Kadu é delivery-only.
  { chave: 'kadu', cor: '#FF9900' },
  { chave: 'cadu', cor: '#FF9900' },
];

/** Fallback quando o nome não está na legenda da planilha. */
export const CORES_REGIONAIS = [
  '#00B050',
  '#FFFF00',
  '#CCCCCC',
  '#FF9900',
  '#4A86E8',
  '#00FFFF',
  '#7030A0',
  '#FF0000',
  '#00FF00',
  '#64748B',
];

/** Roxo da planilha para célula multi (ex.: I/R). */
export const COR_ESCALA_MULTI = '#7030A0';

export const DIAS_SEMANA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

/** Ordem fixa no topo da legenda / seletor da escala de visitas. */
export const ESCALA_VISITAS_PRIORIDADE_TOPO = ['renato frota', 'renato', 'igor'];

/** Supervisores de região — cada um agrupa os regionais e técnicos vinculados na frota. */
export const ESCALA_VISITAS_LIDERES_GRUPO = ['plinio', 'fagno', 'barbara'];

/**
 * Paleta fixa da planilha Time de Campo (grade de visitas).
 * Kadu é Delivery e não entra aqui.
 */
export const ESCALA_VISITAS_PALETA_NOMES = ['renato', 'barbara', 'igor', 'plinio', 'fagno'];

/** Loja âncora da linha DELIVERY e lojas que não entram como linha normal na grade. */
export const ESCALA_VISITAS_NOME_LOJA_DELIVERY = 'DELIVERY';
export const ESCALA_VISITAS_LOJAS_EXCLUIDAS_GRADE = [
  'GA - KING ASSESSORIA E CONSULTORIA',
  ESCALA_VISITAS_NOME_LOJA_DELIVERY,
];

function normNomeLojaEscala(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function lojaExcluidaDaGradeEscala(nomeLoja) {
  const n = normNomeLojaEscala(nomeLoja);
  return ESCALA_VISITAS_LOJAS_EXCLUIDAS_GRADE.some(
    (item) => normNomeLojaEscala(item) === n,
  );
}

export function isLinhaDeliveryEscala(nomeLoja) {
  return normNomeLojaEscala(nomeLoja) === normNomeLojaEscala(ESCALA_VISITAS_NOME_LOJA_DELIVERY);
}

function normNomeEscala(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function nomeCorrespondeChave(nome, chave) {
  const n = normNomeEscala(nome);
  const c = normNomeEscala(chave);
  if (!n || !c) return false;
  if (n === c) return true;
  return n.startsWith(`${c} `);
}

/** Cor de marcação do regional conforme a planilha Time de Campo. */
export function corEscalaPorNome(nome, indexFallback = 0) {
  for (const item of CORES_ESCALA_POR_NOME) {
    if (nomeCorrespondeChave(nome, item.chave)) return item.cor;
  }
  return CORES_REGIONAIS[indexFallback % CORES_REGIONAIS.length];
}

export function indicePrioridadeTopoEscala(nome) {
  for (let i = 0; i < ESCALA_VISITAS_PRIORIDADE_TOPO.length; i += 1) {
    if (nomeCorrespondeChave(nome, ESCALA_VISITAS_PRIORIDADE_TOPO[i])) return i;
  }
  return -1;
}

export function indiceLiderGrupoEscala(nomeLider) {
  for (let i = 0; i < ESCALA_VISITAS_LIDERES_GRUPO.length; i += 1) {
    if (nomeCorrespondeChave(nomeLider, ESCALA_VISITAS_LIDERES_GRUPO[i])) return i;
  }
  return -1;
}

export function rotuloGrupoEscala(nomeLider) {
  if (!nomeLider) return null;
  const chave = ESCALA_VISITAS_LIDERES_GRUPO.find((item) => nomeCorrespondeChave(nomeLider, item));
  if (!chave) return null;
  return chave.charAt(0).toUpperCase() + chave.slice(1);
}

async function carregarMembrosRegioesFrotaEscala() {
  const { rows } = await pool.query(`
    SELECT
      lid.id_usuario AS id_lider,
      lid.nome AS nome_lider,
      mem.id_usuario,
      mem.papel
    FROM frota_regioes r
    JOIN usuarios lid ON lid.id_usuario = r.id_regional AND lid.ativo = TRUE
    JOIN LATERAL (
      SELECT r.id_regional AS id_usuario, 'lider' AS papel
      UNION ALL
      SELECT rr.id_usuario, 'regional'
      FROM frota_regiao_regionais rr
      WHERE rr.id_regiao = r.id_regiao
      UNION ALL
      SELECT rt.id_usuario, 'tecnico'
      FROM frota_regiao_tecnicos rt
      WHERE rt.id_regiao = r.id_regiao
    ) mem ON TRUE
    WHERE r.ativo = TRUE AND r.id_regional IS NOT NULL
  `);

  const porUsuario = new Map();
  for (const row of rows) {
    const grupoIdx = indiceLiderGrupoEscala(row.nome_lider);
    if (grupoIdx < 0) continue;

    const papelOrd = row.papel === 'lider' ? 0 : row.papel === 'regional' ? 1 : 2;
    const atual = porUsuario.get(row.id_usuario);
    if (
      !atual
      || grupoIdx < atual.grupoIdx
      || (grupoIdx === atual.grupoIdx && papelOrd < atual.papelOrd)
    ) {
      porUsuario.set(row.id_usuario, {
        id_lider: row.id_lider,
        nome_lider: row.nome_lider,
        grupoIdx,
        papelOrd,
      });
    }
  }
  return porUsuario;
}

export function ordenarRegionaisEscala(regionais, membrosMap = new Map()) {
  function chaveOrdenacao(regional) {
    const topo = indicePrioridadeTopoEscala(regional.nome);
    if (topo >= 0) {
      return { tier: 0, sub: topo, nome: regional.nome, grupo: null };
    }

    const membro = membrosMap.get(regional.id_usuario);
    if (membro) {
      return {
        tier: 1 + membro.grupoIdx,
        sub: membro.papelOrd,
        nome: regional.nome,
        grupo: rotuloGrupoEscala(membro.nome_lider),
      };
    }

    return { tier: 100, sub: 0, nome: regional.nome, grupo: 'Outros' };
  }

  return [...regionais]
    .map((regional) => ({ regional, ord: chaveOrdenacao(regional) }))
    .sort((a, b) => {
      if (a.ord.tier !== b.ord.tier) return a.ord.tier - b.ord.tier;
      if (a.ord.sub !== b.ord.sub) return a.ord.sub - b.ord.sub;
      return a.ord.nome.localeCompare(b.ord.nome, 'pt-BR');
    })
    .map(({ regional, ord }) => ({
      ...regional,
      grupo_nome: ord.grupo,
    }));
}

export function podeGerenciarEscalaVisitas(user) {
  return temPermissao(user, 'escalas.visitas.gerenciar');
}

export function podeEditarEscalaRegiao(user) {
  return temPermissao(user, 'escalas.visitas.editar_regiao');
}

export function podeEditarEscalaDelivery(user) {
  return temPermissao(user, 'escalas.visitas.editar_delivery') || podeGerenciarEscalaVisitas(user);
}

export function podeVerEscalaVisitas(user) {
  return (
    podeGerenciarEscalaVisitas(user) ||
    podeEditarEscalaRegiao(user) ||
    podeEditarEscalaDelivery(user) ||
    temPermissao(user, 'escalas.visitas.ver')
  );
}

const STATUS_RASCUNHO = 'rascunho';
const STATUS_PENDENTE = 'pendente_aprovacao';
const STATUS_APROVADO = 'aprovado';

async function garantirStatusRegiao(clientOrPool, idSemana, idRegiao) {
  const db = clientOrPool || pool;
  await db.query(
    `INSERT INTO escala_visitas_regiao_status (id_semana, id_regiao, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_semana, id_regiao) DO NOTHING`,
    [idSemana, idRegiao, STATUS_RASCUNHO],
  );
}

async function obterStatusRegiao(idSemana, idRegiao) {
  await garantirStatusRegiao(pool, idSemana, idRegiao);
  const { rows } = await pool.query(
    `SELECT s.status, s.submetido_por, s.submetido_em, s.revisado_por, s.revisado_em, s.comentario,
            us.nome AS nome_submetido_por, ur.nome AS nome_revisado_por
     FROM escala_visitas_regiao_status s
     LEFT JOIN usuarios us ON us.id_usuario = s.submetido_por
     LEFT JOIN usuarios ur ON ur.id_usuario = s.revisado_por
     WHERE s.id_semana = $1 AND s.id_regiao = $2`,
    [idSemana, idRegiao],
  );
  return rows[0] || { status: STATUS_RASCUNHO };
}

async function carregarStatusPorRegiao(idSemana, idsRegiao) {
  if (!idsRegiao.length) return [];
  for (const id of idsRegiao) {
    await garantirStatusRegiao(pool, idSemana, id);
  }
  const { rows } = await pool.query(
    `SELECT s.id_regiao, r.nome AS nome_regiao, s.status,
            s.submetido_por, s.submetido_em, s.revisado_por, s.revisado_em, s.comentario,
            us.nome AS nome_submetido_por, ur.nome AS nome_revisado_por
     FROM escala_visitas_regiao_status s
     JOIN frota_regioes r ON r.id_regiao = s.id_regiao
     LEFT JOIN usuarios us ON us.id_usuario = s.submetido_por
     LEFT JOIN usuarios ur ON ur.id_usuario = s.revisado_por
     WHERE s.id_semana = $1 AND s.id_regiao = ANY($2::int[])
     ORDER BY r.nome`,
    [idSemana, idsRegiao],
  );
  return rows;
}

async function garantirStatusDelivery(clientOrPool, idSemana) {
  const db = clientOrPool || pool;
  await db.query(
    `INSERT INTO escala_visitas_delivery_status (id_semana, status)
     VALUES ($1, $2)
     ON CONFLICT (id_semana) DO NOTHING`,
    [idSemana, STATUS_RASCUNHO],
  );
}

async function obterStatusDelivery(idSemana) {
  await garantirStatusDelivery(pool, idSemana);
  const { rows } = await pool.query(
    `SELECT s.status, s.submetido_por, s.submetido_em, s.revisado_por, s.revisado_em, s.comentario,
            us.nome AS nome_submetido_por, ur.nome AS nome_revisado_por
     FROM escala_visitas_delivery_status s
     LEFT JOIN usuarios us ON us.id_usuario = s.submetido_por
     LEFT JOIN usuarios ur ON ur.id_usuario = s.revisado_por
     WHERE s.id_semana = $1`,
    [idSemana],
  );
  return rows[0] || { status: STATUS_RASCUNHO };
}

async function mapLojaParaRegiao(idsLoja) {
  const out = new Map();
  if (!idsLoja.length) return out;
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (rl.id_loja) rl.id_loja, rl.id_regiao
     FROM frota_regiao_lojas rl
     JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
     WHERE rl.id_loja = ANY($1::int[])
     ORDER BY rl.id_loja, r.nome`,
    [idsLoja],
  );
  for (const row of rows) out.set(Number(row.id_loja), Number(row.id_regiao));
  return out;
}

/** Segunda-feira (ISO) da semana que contém a data. */
export function segundaFeiraDaSemana(valor) {
  const d = valor instanceof Date ? new Date(valor) : new Date(`${valor}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Data inválida');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function domingoDaSemana(semanaInicio) {
  const d = new Date(`${semanaInicio}T12:00:00`);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function formatarDataBr(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function idsRegioesVisiveis(user) {
  if (acessoTodasLojas(user) || podeGerenciarEscalaVisitas(user)) {
    const { rows } = await pool.query(
      'SELECT id_regiao FROM frota_regioes WHERE ativo = TRUE ORDER BY nome',
    );
    return rows.map((r) => r.id_regiao);
  }
  const regioes = await carregarRegioesAtuacaoTecnico(user.sub);
  return regioes.map((r) => r.id_regiao);
}

async function idsUsuariosDeliveryOnly() {
  const { rows } = await pool.query(
    `SELECT DISTINCT pd.id_usuario
     FROM usuario_permissoes pd
     JOIN usuarios u ON u.id_usuario = pd.id_usuario AND u.ativo = TRUE
     WHERE pd.codigo = 'escalas.visitas.editar_delivery'
       AND NOT EXISTS (
         SELECT 1 FROM usuario_permissoes pr
         WHERE pr.id_usuario = pd.id_usuario
           AND pr.codigo IN ('escalas.visitas.editar_regiao', 'escalas.visitas.gerenciar')
       )`,
  );
  return new Set(rows.map((r) => Number(r.id_usuario)));
}

export async function listarRegionaisEscala() {
  const [queryRegionais, membrosMap] = await Promise.all([
    pool.query(`
      SELECT DISTINCT u.id_usuario, u.nome, u.avatar_inicial
      FROM usuarios u
      WHERE u.ativo = TRUE
        AND (
          EXISTS (
            SELECT 1 FROM usuario_permissoes p
            WHERE p.id_usuario = u.id_usuario
              AND p.codigo IN ('escalas.visitas.editar_regiao', 'escalas.visitas.gerenciar')
          )
          OR u.id_usuario IN (SELECT id_regional FROM frota_regioes WHERE id_regional IS NOT NULL AND ativo = TRUE)
          OR u.id_usuario IN (SELECT id_usuario FROM frota_regiao_regionais)
          OR COALESCE(u.cargo_aprovacao, u.perfil::text) = 'supervisor_regional'
          OR COALESCE(u.cargo_aprovacao, u.perfil::text) = 'diretor'
        )
        -- Delivery-only não entra na paleta de visitas (só na aba Delivery).
        AND NOT (
          EXISTS (
            SELECT 1 FROM usuario_permissoes pd
            WHERE pd.id_usuario = u.id_usuario AND pd.codigo = 'escalas.visitas.editar_delivery'
          )
          AND NOT EXISTS (
            SELECT 1 FROM usuario_permissoes pr
            WHERE pr.id_usuario = u.id_usuario
              AND pr.codigo IN ('escalas.visitas.editar_regiao', 'escalas.visitas.gerenciar')
          )
        )
    `),
    carregarMembrosRegioesFrotaEscala(),
  ]);

  // Só a legenda da planilha (Renato, Bárbara, Igor, Plinio, Fagno).
  const daPlanilha = queryRegionais.rows.filter((u) =>
    ESCALA_VISITAS_PALETA_NOMES.some((chave) => nomeCorrespondeChave(u.nome, chave)),
  );

  const ordenados = ordenarRegionaisEscala(daPlanilha, membrosMap);
  return ordenados.map((r, i) => ({
    id_usuario: r.id_usuario,
    nome: r.nome,
    avatar_inicial: r.avatar_inicial,
    grupo_nome: r.grupo_nome ?? null,
    cor: corEscalaPorNome(r.nome, i),
  }));
}

export async function listarRegioesEscala(user) {
  const ids = await idsRegioesVisiveis(user);
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT r.id_regiao, r.nome
     FROM frota_regioes r
     WHERE r.id_regiao = ANY($1::int[]) AND r.ativo = TRUE
     ORDER BY r.nome`,
    [ids],
  );
  return rows;
}

async function lojasGrade(user, idRegiaoFiltro) {
  const idsRegiao = await idsRegioesVisiveis(user);
  let filtroRegiao = idRegiaoFiltro ? Number(idRegiaoFiltro) : null;

  if (filtroRegiao && !idsRegiao.includes(filtroRegiao)) {
    throw new Error('Sem acesso a esta região');
  }

  const params = [];
  let where = 'l.is_active = TRUE';

  if (filtroRegiao) {
    params.push(filtroRegiao);
    where += ` AND EXISTS (
      SELECT 1 FROM frota_regiao_lojas rl
      WHERE rl.id_loja = l.id_loja AND rl.id_regiao = $${params.length}
    )`;
  } else if (
    !acessoTodasLojas(user) &&
    !podeGerenciarEscalaVisitas(user) &&
    !temPermissao(user, 'escalas.visitas.editar_delivery')
  ) {
    if (idsRegiao.length) {
      params.push(idsRegiao);
      where += ` AND EXISTS (
        SELECT 1 FROM frota_regiao_lojas rl
        WHERE rl.id_loja = l.id_loja AND rl.id_regiao = ANY($${params.length}::int[])
      )`;
    } else if (
      temPermissao(user, 'escalas.visitas.editar_regiao') ||
      temPermissao(user, 'escalas.visitas.ver')
    ) {
      // Regional sem vínculo de frota (ex.: Igor): ainda precisa ver lojas onde está escalado.
      params.push(Number(user.sub));
      where += ` AND EXISTS (
        SELECT 1 FROM escala_visitas_celula c
        WHERE c.id_loja = l.id_loja AND c.id_regional = $${params.length}
      )`;
    } else {
      return [];
    }
  }

  const { rows } = await pool.query(
    `SELECT l.id_loja, l.name, l.bk_number,
            (
              SELECT r.id_regiao
              FROM frota_regiao_lojas rl
              JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
              WHERE rl.id_loja = l.id_loja
              ORDER BY r.nome
              LIMIT 1
            ) AS id_regiao,
            (
              SELECT r.nome
              FROM frota_regiao_lojas rl
              JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
              WHERE rl.id_loja = l.id_loja
              ORDER BY r.nome
              LIMIT 1
            ) AS nome_regiao
     FROM lojas l
     WHERE ${where}
     ORDER BY
       CASE
         WHEN TRIM(l.bk_number) = '15022'
           OR UPPER(TRIM(l.name)) LIKE '%VALPARA%'
         THEN 1
         ELSE 0
       END,
       COALESCE(NULLIF(TRIM(l.bk_number), ''), '99999'),
       l.name`,
    params,
  );
  return rows.filter((loja) => !lojaExcluidaDaGradeEscala(loja.name));
}

async function obterLojaDeliveryAnchor() {
  const { rows } = await pool.query(
    `SELECT id_loja, name, bk_number
     FROM lojas
     WHERE LOWER(TRIM(name)) = LOWER($1)
     LIMIT 1`,
    [ESCALA_VISITAS_NOME_LOJA_DELIVERY],
  );
  return rows[0] ?? null;
}

function regionaisParaSalvar(item) {
  if (Array.isArray(item.id_regionais)) {
    return [...new Set(item.id_regionais.map(Number).filter(Boolean))];
  }
  if (item.id_regional != null && item.id_regional !== '') {
    return [Number(item.id_regional)];
  }
  return [];
}

function lojasDestinoParaSalvar(item) {
  if (Array.isArray(item.id_lojas_destino)) {
    return [...new Set(item.id_lojas_destino.map(Number).filter(Boolean))];
  }
  if (item.id_loja_destino != null && item.id_loja_destino !== '') {
    return [Number(item.id_loja_destino)];
  }
  return [];
}

async function obterOuCriarSemana(semanaInicio, idUsuario) {
  const { rows } = await pool.query(
    `INSERT INTO escala_visitas_semana (semana_inicio, atualizado_por)
     VALUES ($1::date, $2)
     ON CONFLICT (semana_inicio) DO UPDATE SET semana_inicio = EXCLUDED.semana_inicio
     RETURNING id_semana, semana_inicio, observacao, atualizado_em`,
    [semanaInicio, idUsuario || null],
  );
  return rows[0];
}

export async function carregarGradeVisitas(user, { semana_inicio, id_regiao = null }) {
  if (!podeVerEscalaVisitas(user)) throw new Error('Sem permissão');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const [semana, lojas, regionais, regioes, lojaDelivery] = await Promise.all([
    obterOuCriarSemana(semanaInicio, user.sub),
    lojasGrade(user, id_regiao),
    listarRegionaisEscala(),
    listarRegioesEscala(user),
    obterLojaDeliveryAnchor(),
  ]);

  const idsLojas = lojas.map((l) => l.id_loja);
  const idsConsulta = lojaDelivery ? [...idsLojas, lojaDelivery.id_loja] : idsLojas;
  let celulas = [];
  if (idsConsulta.length) {
    // Remove atribuições indevidas de usuários só-delivery na grade de visitas.
    const idsDeliveryOnly = [...(await idsUsuariosDeliveryOnly())];
    if (idsDeliveryOnly.length) {
      await pool.query(
        `DELETE FROM escala_visitas_celula
         WHERE id_semana = $1
           AND id_regional = ANY($2::int[])
           AND id_loja_destino IS NULL`,
        [semana.id_semana, idsDeliveryOnly],
      );
    }

    const { rows } = await pool.query(
      `SELECT c.id_celula, c.id_loja, c.dia, c.id_regional, c.id_loja_destino, c.observacao,
              u.nome AS nome_regional,
              ld.name AS nome_loja_destino, ld.bk_number AS bk_loja_destino
       FROM escala_visitas_celula c
       LEFT JOIN usuarios u ON u.id_usuario = c.id_regional
       LEFT JOIN lojas ld ON ld.id_loja = c.id_loja_destino
       WHERE c.id_semana = $1 AND c.id_loja = ANY($2::int[])
       ORDER BY c.id_loja, c.dia, c.id_celula`,
      [semana.id_semana, idsConsulta],
    );
    celulas = rows;
  }

  const mapCel = new Map();
  for (const c of celulas) {
    const key = `${c.id_loja}-${c.dia}`;
    if (!mapCel.has(key)) mapCel.set(key, []);
    mapCel.get(key).push(c);
  }

  const mapCor = new Map(regionais.map((r) => [r.id_usuario, r.cor]));

  function montarDiasLinha(idLoja, tipo) {
    const dias = [];
    let totalVisitas = 0;
    for (let dia = 0; dia < 7; dia++) {
      const lista = mapCel.get(`${idLoja}-${dia}`) ?? [];
      const atribuicoes = tipo === 'delivery'
        ? lista
          .filter((c) => c.id_loja_destino != null)
          .map((c) => ({
            id_celula: c.id_celula,
            id_loja_destino: c.id_loja_destino,
            nome_loja_destino: c.nome_loja_destino ?? null,
            bk_loja_destino: c.bk_loja_destino ?? null,
            observacao: c.observacao ?? null,
          }))
        : lista
          .filter((c) => c.id_regional != null)
          .map((c) => ({
            id_celula: c.id_celula,
            id_regional: c.id_regional,
            nome_regional: c.nome_regional ?? null,
            cor: mapCor.get(c.id_regional) || '#64748B',
            observacao: c.observacao ?? null,
          }));
      totalVisitas += atribuicoes.length;
      const primeira = atribuicoes[0];
      dias.push({
        dia,
        atribuicoes,
        id_regional: primeira?.id_regional ?? null,
        nome_regional: primeira?.nome_regional ?? null,
        cor: primeira?.cor ?? null,
        id_loja_destino: primeira?.id_loja_destino ?? null,
        nome_loja_destino: primeira?.nome_loja_destino ?? null,
        observacao: primeira?.observacao ?? null,
      });
    }
    return { dias, totalVisitas };
  }

  const linhas = lojas.map((loja) => {
    const { dias, totalVisitas } = montarDiasLinha(loja.id_loja, 'loja');
    return {
      id_loja: loja.id_loja,
      nome: loja.name,
      bk_number: loja.bk_number,
      id_regiao: loja.id_regiao,
      nome_regiao: loja.nome_regiao,
      tipo: 'loja',
      total_visitas: totalVisitas,
      dias,
    };
  });

  if (lojaDelivery) {
    const { dias, totalVisitas } = montarDiasLinha(lojaDelivery.id_loja, 'delivery');
    linhas.push({
      id_loja: lojaDelivery.id_loja,
      nome: ESCALA_VISITAS_NOME_LOJA_DELIVERY,
      bk_number: lojaDelivery.bk_number,
      id_regiao: null,
      nome_regiao: null,
      tipo: 'delivery',
      total_visitas: totalVisitas,
      dias,
    });
  }

  const lojasDestinoRows =
    id_regiao &&
    (podeGerenciarEscalaVisitas(user) || temPermissao(user, 'escalas.visitas.editar_delivery'))
      ? await lojasGrade(user, null)
      : lojas;
  const lojasDestino = lojasDestinoRows.map((loja) => ({
    id_loja: loja.id_loja,
    nome: loja.name,
    bk_number: loja.bk_number,
  }));

  const idsRegiaoStatus = id_regiao
    ? [Number(id_regiao)]
    : regioes.map((r) => Number(r.id_regiao));
  const statusPorRegiao = await carregarStatusPorRegiao(semana.id_semana, idsRegiaoStatus);
  const statusDelivery = await obterStatusDelivery(semana.id_semana);
  const equipesPorRegiao = await listarEquipesVisitaPorRegiao(
    [...new Set(regioes.map((r) => Number(r.id_regiao)).filter(Boolean))],
  );

  const gerenciar = podeGerenciarEscalaVisitas(user);
  const editarRegiaoPerm = podeEditarEscalaRegiao(user) && !gerenciar;
  const editarDeliveryPerm = temPermissao(user, 'escalas.visitas.editar_delivery') || gerenciar;
  const idsRegiaoUsuario = await idsRegioesVisiveis(user);

  let podeEditarRegiao = false;
  let podeSubmeter = false;
  let statusRegiaoFiltro = null;
  if (editarRegiaoPerm) {
    const alvo =
      id_regiao && idsRegiaoUsuario.includes(Number(id_regiao))
        ? Number(id_regiao)
        : idsRegiaoUsuario.length === 1
          ? idsRegiaoUsuario[0]
          : null;
    if (alvo != null) {
      const st = await obterStatusRegiao(semana.id_semana, alvo);
      statusRegiaoFiltro = st.status || STATUS_RASCUNHO;
      podeEditarRegiao = statusRegiaoFiltro === STATUS_RASCUNHO;
      podeSubmeter = statusRegiaoFiltro === STATUS_RASCUNHO;
    }
  }

  const statusDeliveryCodigo = statusDelivery.status || STATUS_RASCUNHO;
  const podeEditarDelivery =
    gerenciar || (editarDeliveryPerm && statusDeliveryCodigo === STATUS_RASCUNHO);
  const podeSubmeterDelivery =
    !gerenciar &&
    temPermissao(user, 'escalas.visitas.editar_delivery') &&
    statusDeliveryCodigo === STATUS_RASCUNHO;

  const temPendente =
    statusPorRegiao.some((s) => s.status === STATUS_PENDENTE) ||
    statusDeliveryCodigo === STATUS_PENDENTE;
  const temAprovado =
    statusPorRegiao.some((s) => s.status === STATUS_APROVADO) ||
    statusDeliveryCodigo === STATUS_APROVADO;

  return {
    id_semana: semana.id_semana,
    semana_inicio: semanaInicio,
    semana_fim: domingoDaSemana(semanaInicio),
    semana_label: `${formatarDataBr(semanaInicio)} até ${formatarDataBr(domingoDaSemana(semanaInicio))}`,
    pode_editar: gerenciar,
    pode_editar_regiao: podeEditarRegiao,
    pode_editar_delivery: podeEditarDelivery,
    pode_submeter: podeSubmeter,
    pode_submeter_delivery: podeSubmeterDelivery,
    pode_aprovar: gerenciar && temPendente,
    pode_devolver: gerenciar && (temPendente || temAprovado),
    pode_excluir: gerenciar,
    id_regiao_filtro: id_regiao ? Number(id_regiao) : null,
    status_regiao: statusRegiaoFiltro,
    status_por_regiao: statusPorRegiao,
    status_delivery: {
      status: statusDeliveryCodigo,
      submetido_por: statusDelivery.submetido_por ?? null,
      submetido_em: statusDelivery.submetido_em ?? null,
      revisado_por: statusDelivery.revisado_por ?? null,
      revisado_em: statusDelivery.revisado_em ?? null,
      comentario: statusDelivery.comentario ?? null,
      nome_submetido_por: statusDelivery.nome_submetido_por ?? null,
      nome_revisado_por: statusDelivery.nome_revisado_por ?? null,
    },
    regionais,
    regioes,
    equipes_por_regiao: equipesPorRegiao,
    lojas_destino: lojasDestino,
    linhas,
  };
}

export async function salvarGradeVisitas(user, { semana_inicio, celulas, id_regiao = null }) {
  const gerenciar = podeGerenciarEscalaVisitas(user);
  const editarRegiao = podeEditarEscalaRegiao(user);
  const editarDelivery = temPermissao(user, 'escalas.visitas.editar_delivery') || gerenciar;
  if (!gerenciar && !editarRegiao && !editarDelivery) throw new Error('Sem permissão para editar');

  const soDelivery = editarDelivery && !gerenciar && !editarRegiao;

  const semanaInicio = segundaFeiraDaSemana(semana_inicio);
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const lista = Array.isArray(celulas) ? celulas : [];
  const lojaDelivery = await obterLojaDeliveryAnchor();

  const idsRegiaoUsuario = await idsRegioesVisiveis(user);
  const idsLojaPayload = [
    ...new Set(lista.map((item) => Number(item.id_loja)).filter(Boolean)),
  ];
  const lojaRegiaoMap = await mapLojaParaRegiao(idsLojaPayload);

  if (soDelivery) {
    if (!lojaDelivery) throw new Error('Linha de delivery não configurada');
    const stDelivery = await obterStatusDelivery(semana.id_semana);
    if ((stDelivery.status || STATUS_RASCUNHO) !== STATUS_RASCUNHO) {
      throw new Error('Delivery bloqueado — aguarde aprovação ou devolução do diretor');
    }
    for (const item of lista) {
      const idLoja = Number(item.id_loja);
      if (idLoja !== lojaDelivery.id_loja) {
        throw new Error('Este usuário só pode editar a escala de delivery');
      }
    }
  } else if (!gerenciar) {
    for (const item of lista) {
      const idLoja = Number(item.id_loja);
      if (lojaDelivery && idLoja === lojaDelivery.id_loja) {
        throw new Error('Delivery só pode ser editado pela diretoria ou pelo responsável de delivery');
      }
      const idRegiaoLoja = lojaRegiaoMap.get(idLoja);
      if (!idRegiaoLoja || !idsRegiaoUsuario.includes(idRegiaoLoja)) {
        throw new Error('Só é possível editar lojas da sua região');
      }
      const st = await obterStatusRegiao(semana.id_semana, idRegiaoLoja);
      if ((st.status || STATUS_RASCUNHO) !== STATUS_RASCUNHO) {
        throw new Error('Região bloqueada — aguarde aprovação ou devolução do diretor');
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const idsDeliveryOnly = await idsUsuariosDeliveryOnly();
    for (const item of lista) {
      const idLoja = Number(item.id_loja);
      const dia = Number(item.dia);
      if (!idLoja || dia < 0 || dia > 6) continue;

      const ehDelivery = lojaDelivery && idLoja === lojaDelivery.id_loja;
      let idsRegional = ehDelivery ? [] : regionaisParaSalvar(item);
      if (!ehDelivery && idsDeliveryOnly.size) {
        idsRegional = idsRegional.filter((id) => !idsDeliveryOnly.has(id));
      }
      const idsLojaDestino = ehDelivery ? lojasDestinoParaSalvar(item) : [];
      const obs = item.observacao != null ? String(item.observacao).trim() || null : null;

      await client.query(
        `DELETE FROM escala_visitas_celula
         WHERE id_semana = $1 AND id_loja = $2 AND dia = $3`,
        [semana.id_semana, idLoja, dia],
      );

      if (!idsRegional.length && !idsLojaDestino.length && !obs) continue;

      for (const idRegional of idsRegional) {
        await client.query(
          `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional, observacao)
           VALUES ($1, $2, $3, $4, $5)`,
          [semana.id_semana, idLoja, dia, idRegional, obs],
        );
      }

      for (const idLojaDestino of idsLojaDestino) {
        await client.query(
          `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_loja_destino, observacao)
           VALUES ($1, $2, $3, $4, $5)`,
          [semana.id_semana, idLoja, dia, idLojaDestino, obs],
        );
      }

      if (!idsRegional.length && !idsLojaDestino.length && obs) {
        await client.query(
          `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional, observacao)
           VALUES ($1, $2, $3, NULL, $4)`,
          [semana.id_semana, idLoja, dia, obs],
        );
      }
    }
    await client.query(
      `UPDATE escala_visitas_semana SET atualizado_em = NOW(), atualizado_por = $2 WHERE id_semana = $1`,
      [semana.id_semana, user.sub],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao });
}

export async function submeterEscalaRegiao(user, { semana_inicio, id_regiao }) {
  if (!podeEditarEscalaRegiao(user) && !podeGerenciarEscalaVisitas(user)) {
    throw new Error('Sem permissão para submeter');
  }
  const idRegiao = Number(id_regiao);
  if (!idRegiao) throw new Error('Informe a região');

  const idsRegiaoUsuario = await idsRegioesVisiveis(user);
  if (!podeGerenciarEscalaVisitas(user) && !idsRegiaoUsuario.includes(idRegiao)) {
    throw new Error('Sem acesso a esta região');
  }

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const st = await obterStatusRegiao(semana.id_semana, idRegiao);
  if ((st.status || STATUS_RASCUNHO) !== STATUS_RASCUNHO) {
    throw new Error('Só é possível enviar escala em rascunho');
  }

  await pool.query(
    `UPDATE escala_visitas_regiao_status
     SET status = $3,
         submetido_por = $4,
         submetido_em = NOW(),
         revisado_por = NULL,
         revisado_em = NULL,
         comentario = NULL
     WHERE id_semana = $1 AND id_regiao = $2`,
    [semana.id_semana, idRegiao, STATUS_PENDENTE, user.sub],
  );

  const nomeRegiao = await nomeRegiaoPorId(idRegiao);
  const nomeAutor = (await nomeUsuarioPorId(user.sub)) || 'Regional';
  await notificarEscalaUsuarios({
    idsUsuario: await idsDiretoresEscala(),
    excluirId: user.sub,
    tipo: 'pendente_aprovacao',
    mensagem: `${nomeAutor} enviou a escala de ${nomeRegiao} (${formatarDataBr(semanaInicio)}) para aprovação.`,
    idSemana: semana.id_semana,
    idRegiao,
    semanaInicio,
  });

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao: idRegiao });
}

export async function aprovarEscalaRegiao(user, { semana_inicio, id_regiao, comentario = null }) {
  if (!podeGerenciarEscalaVisitas(user)) throw new Error('Sem permissão para aprovar');
  const idRegiao = Number(id_regiao);
  if (!idRegiao) throw new Error('Informe a região');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const st = await obterStatusRegiao(semana.id_semana, idRegiao);
  if ((st.status || STATUS_RASCUNHO) !== STATUS_PENDENTE) {
    throw new Error('Só é possível aprovar escala pendente');
  }

  const comentarioTxt = comentario != null ? String(comentario).trim() || null : null;
  await pool.query(
    `UPDATE escala_visitas_regiao_status
     SET status = $3,
         revisado_por = $4,
         revisado_em = NOW(),
         comentario = $5
     WHERE id_semana = $1 AND id_regiao = $2`,
    [semana.id_semana, idRegiao, STATUS_APROVADO, user.sub, comentarioTxt],
  );

  const nomeRegiao = await nomeRegiaoPorId(idRegiao);
  await notificarEscalaUsuarios({
    idsUsuario: await idsDestinatariosRegionalEscala(st.submetido_por, idRegiao),
    excluirId: user.sub,
    tipo: 'aprovado',
    mensagem: `Sua escala de ${nomeRegiao} (${formatarDataBr(semanaInicio)}) foi aprovada.`,
    idSemana: semana.id_semana,
    idRegiao,
    semanaInicio,
  });

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao: null });
}

export async function devolverEscalaRegiao(user, { semana_inicio, id_regiao, comentario = null }) {
  if (!podeGerenciarEscalaVisitas(user)) throw new Error('Sem permissão para devolver');
  const idRegiao = Number(id_regiao);
  if (!idRegiao) throw new Error('Informe a região');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const st = await obterStatusRegiao(semana.id_semana, idRegiao);
  if (![STATUS_PENDENTE, STATUS_APROVADO].includes(st.status || STATUS_RASCUNHO)) {
    throw new Error('Só é possível devolver escala pendente ou aprovada');
  }

  const comentarioTxt = comentario != null ? String(comentario).trim() || null : null;
  await pool.query(
    `UPDATE escala_visitas_regiao_status
     SET status = $3,
         revisado_por = $4,
         revisado_em = NOW(),
         comentario = $5
     WHERE id_semana = $1 AND id_regiao = $2`,
    [semana.id_semana, idRegiao, STATUS_RASCUNHO, user.sub, comentarioTxt],
  );

  const nomeRegiao = await nomeRegiaoPorId(idRegiao);
  await notificarEscalaUsuarios({
    idsUsuario: await idsDestinatariosRegionalEscala(st.submetido_por, idRegiao),
    excluirId: user.sub,
    tipo: 'recusado',
    mensagem: `Sua escala de ${nomeRegiao} (${formatarDataBr(semanaInicio)}) foi recusada. Monte novamente e envie para aprovação.`,
    idSemana: semana.id_semana,
    idRegiao,
    semanaInicio,
  });

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao: null });
}

export async function submeterEscalaDelivery(user, { semana_inicio }) {
  const gerenciar = podeGerenciarEscalaVisitas(user);
  const editarDelivery = temPermissao(user, 'escalas.visitas.editar_delivery');
  if (!editarDelivery && !gerenciar) throw new Error('Sem permissão para submeter delivery');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const st = await obterStatusDelivery(semana.id_semana);
  if ((st.status || STATUS_RASCUNHO) !== STATUS_RASCUNHO) {
    throw new Error('Só é possível enviar delivery em rascunho');
  }

  await pool.query(
    `UPDATE escala_visitas_delivery_status
     SET status = $2,
         submetido_por = $3,
         submetido_em = NOW(),
         revisado_por = NULL,
         revisado_em = NULL,
         comentario = NULL
     WHERE id_semana = $1`,
    [semana.id_semana, STATUS_PENDENTE, user.sub],
  );

  const nomeAutor = (await nomeUsuarioPorId(user.sub)) || 'Delivery';
  await notificarEscalaUsuarios({
    idsUsuario: await idsDiretoresEscala(),
    excluirId: user.sub,
    tipo: 'pendente_aprovacao',
    mensagem: `${nomeAutor} enviou a escala de delivery (${formatarDataBr(semanaInicio)}) para aprovação.`,
    idSemana: semana.id_semana,
    idRegiao: null,
    semanaInicio,
  });

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao: null });
}

export async function aprovarEscalaDelivery(user, { semana_inicio, comentario = null }) {
  if (!podeGerenciarEscalaVisitas(user)) throw new Error('Sem permissão para aprovar');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const st = await obterStatusDelivery(semana.id_semana);
  if ((st.status || STATUS_RASCUNHO) !== STATUS_PENDENTE) {
    throw new Error('Só é possível aprovar delivery pendente');
  }

  const comentarioTxt = comentario != null ? String(comentario).trim() || null : null;
  await pool.query(
    `UPDATE escala_visitas_delivery_status
     SET status = $2,
         revisado_por = $3,
         revisado_em = NOW(),
         comentario = $4
     WHERE id_semana = $1`,
    [semana.id_semana, STATUS_APROVADO, user.sub, comentarioTxt],
  );

  await notificarEscalaUsuarios({
    idsUsuario: await idsDestinatariosDelivery(st.submetido_por),
    excluirId: user.sub,
    tipo: 'aprovado',
    mensagem: `Sua escala de delivery (${formatarDataBr(semanaInicio)}) foi aprovada.`,
    idSemana: semana.id_semana,
    idRegiao: null,
    semanaInicio,
  });

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao: null });
}

export async function devolverEscalaDelivery(user, { semana_inicio, comentario = null }) {
  if (!podeGerenciarEscalaVisitas(user)) throw new Error('Sem permissão para devolver');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const st = await obterStatusDelivery(semana.id_semana);
  if (![STATUS_PENDENTE, STATUS_APROVADO].includes(st.status || STATUS_RASCUNHO)) {
    throw new Error('Só é possível devolver delivery pendente ou aprovado');
  }

  const comentarioTxt = comentario != null ? String(comentario).trim() || null : null;
  await pool.query(
    `UPDATE escala_visitas_delivery_status
     SET status = $2,
         revisado_por = $3,
         revisado_em = NOW(),
         comentario = $4
     WHERE id_semana = $1`,
    [semana.id_semana, STATUS_RASCUNHO, user.sub, comentarioTxt],
  );

  await notificarEscalaUsuarios({
    idsUsuario: await idsDestinatariosDelivery(st.submetido_por),
    excluirId: user.sub,
    tipo: 'recusado',
    mensagem: `Sua escala de delivery (${formatarDataBr(semanaInicio)}) foi recusada. Monte novamente e envie para aprovação.`,
    idSemana: semana.id_semana,
    idRegiao: null,
    semanaInicio,
  });

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao: null });
}

/** Diretor: apaga visitas da região na semana e volta status para rascunho. */
export async function limparEscalaRegiao(user, { semana_inicio, id_regiao }) {
  if (!podeGerenciarEscalaVisitas(user)) throw new Error('Sem permissão para excluir escala');

  const idRegiao = Number(id_regiao);
  if (!idRegiao) throw new Error('Informe a região');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const st = await obterStatusRegiao(semana.id_semana, idRegiao);
  const lojaDelivery = await obterLojaDeliveryAnchor();

  await pool.query(
    `DELETE FROM escala_visitas_celula c
     WHERE c.id_semana = $1
       AND ($3::int IS NULL OR c.id_loja <> $3)
       AND EXISTS (
         SELECT 1 FROM frota_regiao_lojas rl
         WHERE rl.id_loja = c.id_loja AND rl.id_regiao = $2
       )`,
    [semana.id_semana, idRegiao, lojaDelivery?.id_loja ?? null],
  );

  await pool.query(
    `UPDATE escala_visitas_regiao_status
     SET status = $3,
         submetido_por = NULL,
         submetido_em = NULL,
         revisado_por = $4,
         revisado_em = NOW(),
         comentario = 'Escala excluída pelo diretor'
     WHERE id_semana = $1 AND id_regiao = $2`,
    [semana.id_semana, idRegiao, STATUS_RASCUNHO, user.sub],
  );

  await pool.query(
    `UPDATE escala_visitas_semana SET atualizado_em = NOW(), atualizado_por = $2 WHERE id_semana = $1`,
    [semana.id_semana, user.sub],
  );

  const nomeRegiao = await nomeRegiaoPorId(idRegiao);
  await notificarEscalaUsuarios({
    idsUsuario: await idsDestinatariosRegionalEscala(st.submetido_por, idRegiao),
    excluirId: user.sub,
    tipo: 'recusado',
    mensagem: `A escala de ${nomeRegiao} (${formatarDataBr(semanaInicio)}) foi excluída pelo diretor. Monte novamente se necessário.`,
    idSemana: semana.id_semana,
    idRegiao,
    semanaInicio,
  });

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao: null });
}

/** Diretor: apaga escala de delivery da semana e volta status para rascunho. */
export async function limparEscalaDelivery(user, { semana_inicio }) {
  if (!podeGerenciarEscalaVisitas(user)) throw new Error('Sem permissão para excluir escala');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const st = await obterStatusDelivery(semana.id_semana);
  const lojaDelivery = await obterLojaDeliveryAnchor();
  if (!lojaDelivery) throw new Error('Linha de delivery não configurada');

  await pool.query(
    `DELETE FROM escala_visitas_celula
     WHERE id_semana = $1 AND id_loja = $2`,
    [semana.id_semana, lojaDelivery.id_loja],
  );

  await pool.query(
    `UPDATE escala_visitas_delivery_status
     SET status = $2,
         submetido_por = NULL,
         submetido_em = NULL,
         revisado_por = $3,
         revisado_em = NOW(),
         comentario = 'Escala excluída pelo diretor'
     WHERE id_semana = $1`,
    [semana.id_semana, STATUS_RASCUNHO, user.sub],
  );

  await pool.query(
    `UPDATE escala_visitas_semana SET atualizado_em = NOW(), atualizado_por = $2 WHERE id_semana = $1`,
    [semana.id_semana, user.sub],
  );

  await notificarEscalaUsuarios({
    idsUsuario: await idsDestinatariosDelivery(st.submetido_por),
    excluirId: user.sub,
    tipo: 'recusado',
    mensagem: `A escala de delivery (${formatarDataBr(semanaInicio)}) foi excluída pelo diretor. Monte novamente se necessário.`,
    idSemana: semana.id_semana,
    idRegiao: null,
    semanaInicio,
  });

  return carregarGradeVisitas(user, { semana_inicio: semanaInicio, id_regiao: null });
}

export async function copiarSemanaVisitas(user, { de, para }) {
  if (!podeGerenciarEscalaVisitas(user)) throw new Error('Sem permissão');

  const origem = segundaFeiraDaSemana(de);
  const destino = segundaFeiraDaSemana(para);
  if (origem === destino) throw new Error('Semanas iguais');

  const semOrigem = await obterOuCriarSemana(origem, user.sub);
  const semDestino = await obterOuCriarSemana(destino, user.sub);

  await pool.query(
    `DELETE FROM escala_visitas_celula WHERE id_semana = $1`,
    [semDestino.id_semana],
  );

  await pool.query(
    `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional, id_loja_destino, observacao)
     SELECT $2, id_loja, dia, id_regional, id_loja_destino, observacao
     FROM escala_visitas_celula
     WHERE id_semana = $1
     ORDER BY id_celula`,
    [semOrigem.id_semana, semDestino.id_semana],
  );

  await pool.query(
    `UPDATE escala_visitas_semana SET atualizado_em = NOW(), atualizado_por = $2 WHERE id_semana = $1`,
    [semDestino.id_semana, user.sub],
  );

  return carregarGradeVisitas(user, { semana_inicio: destino, id_regiao: null });
}

export async function listarSemanasVisitas(user) {
  if (!podeVerEscalaVisitas(user)) throw new Error('Sem permissão');
  const { rows } = await pool.query(
    `SELECT semana_inicio, atualizado_em
     FROM escala_visitas_semana
     ORDER BY semana_inicio DESC
     LIMIT 52`,
  );
  return rows;
}

async function nomeRegiaoPorId(idRegiao) {
  const { rows } = await pool.query(
    `SELECT nome FROM frota_regioes WHERE id_regiao = $1`,
    [idRegiao],
  );
  return rows[0]?.nome || `Região #${idRegiao}`;
}

async function nomeUsuarioPorId(idUsuario) {
  if (!idUsuario) return null;
  const { rows } = await pool.query(
    `SELECT nome FROM usuarios WHERE id_usuario = $1`,
    [idUsuario],
  );
  return rows[0]?.nome || null;
}

async function idsDiretoresEscala() {
  const { rows } = await pool.query(
    `SELECT DISTINCT up.id_usuario
     FROM usuario_permissoes up
     JOIN usuarios u ON u.id_usuario = up.id_usuario AND u.ativo = TRUE
     WHERE up.codigo = 'escalas.visitas.gerenciar'`,
  );
  return rows.map((r) => Number(r.id_usuario));
}

async function listarEquipesVisitaPorRegiao(idsRegiao = []) {
  if (!idsRegiao.length) return [];
  const { rows } = await pool.query(
    `SELECT rt.id_regiao, u.id_usuario, u.nome
     FROM frota_regiao_tecnicos rt
     JOIN usuarios u ON u.id_usuario = rt.id_usuario AND u.ativo = TRUE
     WHERE rt.id_regiao = ANY($1::int[])
     ORDER BY rt.id_regiao, u.nome`,
    [idsRegiao],
  );
  const porRegiao = new Map();
  for (const row of rows) {
    const idRegiao = Number(row.id_regiao);
    if (!porRegiao.has(idRegiao)) {
      porRegiao.set(idRegiao, {
        id_regiao: idRegiao,
        ids_usuario: [],
        nomes: [],
      });
    }
    const eq = porRegiao.get(idRegiao);
    eq.ids_usuario.push(Number(row.id_usuario));
    eq.nomes.push(row.nome);
  }
  return [...porRegiao.values()];
}

async function idsDestinatariosRegionalEscala(submetidoPor, idRegiao) {
  const ids = new Set();
  if (submetidoPor) ids.add(Number(submetidoPor));
  const { rows } = await pool.query(
    `SELECT r.id_regional AS id_usuario
     FROM frota_regioes r
     WHERE r.id_regiao = $1 AND r.id_regional IS NOT NULL
     UNION
     SELECT rr.id_usuario
     FROM frota_regiao_regionais rr
     WHERE rr.id_regiao = $1`,
    [idRegiao],
  );
  for (const r of rows) {
    if (r.id_usuario) ids.add(Number(r.id_usuario));
  }
  return [...ids];
}

async function idsDestinatariosDelivery(submetidoPor) {
  const ids = new Set();
  if (submetidoPor) ids.add(Number(submetidoPor));
  const { rows } = await pool.query(
    `SELECT DISTINCT up.id_usuario
     FROM usuario_permissoes up
     JOIN usuarios u ON u.id_usuario = up.id_usuario AND u.ativo = TRUE
     WHERE up.codigo = 'escalas.visitas.editar_delivery'`,
  );
  for (const r of rows) {
    if (r.id_usuario) ids.add(Number(r.id_usuario));
  }
  return [...ids];
}

async function notificarEscalaUsuarios({
  idsUsuario,
  excluirId = null,
  tipo,
  mensagem,
  idSemana,
  idRegiao,
  semanaInicio,
}) {
  const destinarios = [...new Set((idsUsuario || []).map(Number).filter(Boolean))].filter(
    (id) => !excluirId || id !== Number(excluirId),
  );
  if (!destinarios.length) return;

  for (const idUsuario of destinarios) {
    try {
      await pool.query(
        `INSERT INTO escala_visitas_notificacoes
           (id_usuario, tipo, mensagem, id_semana, id_regiao, semana_inicio)
         VALUES ($1, $2, $3, $4, $5, $6::date)`,
        [idUsuario, tipo, mensagem, idSemana, idRegiao, semanaInicio],
      );
    } catch (e) {
      console.error('[escala] Falha ao gravar notificação:', e.message);
    }
  }

  try {
    const { enviarPushApp } = await import('./pushNotifications.js');
    const title =
      tipo === 'aprovado'
        ? 'Escala aprovada'
        : tipo === 'recusado'
          ? 'Escala recusada'
          : 'Escala para aprovar';
    for (const idUsuario of destinarios) {
      enviarPushApp(idUsuario, {
        title,
        body: mensagem,
        url: '/escalas/visitas/mobile',
      }).catch(() => {});
    }
  } catch {
    /* push opcional */
  }
}

export async function listarNotificacoesEscala(user, { apenas_nao_lidas = false } = {}) {
  if (!podeVerEscalaVisitas(user)) throw new Error('Sem permissão');
  const params = [user.sub];
  let where = 'n.id_usuario = $1';
  if (apenas_nao_lidas) where += ' AND n.lida = FALSE';
  const { rows } = await pool.query(
    `SELECT n.id_notificacao, n.tipo, n.mensagem, n.id_semana, n.id_regiao, n.semana_inicio,
            n.lida, n.created_at, r.nome AS nome_regiao
     FROM escala_visitas_notificacoes n
     LEFT JOIN frota_regioes r ON r.id_regiao = n.id_regiao
     WHERE ${where}
     ORDER BY n.created_at DESC
     LIMIT 40`,
    params,
  );
  return rows;
}

export async function marcarNotificacoesEscalaLidas(user, { id_notificacao = null } = {}) {
  if (!podeVerEscalaVisitas(user)) throw new Error('Sem permissão');
  if (id_notificacao) {
    await pool.query(
      `UPDATE escala_visitas_notificacoes
       SET lida = TRUE
       WHERE id_usuario = $1 AND id_notificacao = $2`,
      [user.sub, Number(id_notificacao)],
    );
  } else {
    await pool.query(
      `UPDATE escala_visitas_notificacoes
       SET lida = TRUE
       WHERE id_usuario = $1 AND lida = FALSE`,
      [user.sub],
    );
  }
  return { ok: true };
}
