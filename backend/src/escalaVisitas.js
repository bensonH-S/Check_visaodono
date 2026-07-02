import { pool } from './db.js';
import { acessoTodasLojas, temPermissao } from './permissoes.js';
import { carregarRegioesAtuacaoTecnico } from './lojasUsuario.js';

export const CORES_REGIONAIS = [
  '#16A34A',
  '#EA580C',
  '#2563EB',
  '#0891B2',
  '#9333EA',
  '#CA8A04',
  '#DC2626',
  '#64748B',
  '#DB2777',
  '#0D9488',
];

export const DIAS_SEMANA = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

export function podeGerenciarEscalaVisitas(user) {
  return temPermissao(user, 'escalas.visitas.gerenciar');
}

export function podeVerEscalaVisitas(user) {
  return podeGerenciarEscalaVisitas(user) || temPermissao(user, 'escalas.visitas.ver');
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

export async function listarRegionaisEscala() {
  const { rows } = await pool.query(`
    SELECT DISTINCT u.id_usuario, u.nome, u.avatar_inicial
    FROM usuarios u
    WHERE u.ativo = TRUE
      AND (
        u.id_usuario IN (SELECT id_regional FROM frota_regioes WHERE id_regional IS NOT NULL AND ativo = TRUE)
        OR u.id_usuario IN (SELECT id_usuario FROM frota_regiao_regionais)
        OR u.id_usuario IN (SELECT id_usuario FROM frota_regiao_tecnicos)
        OR COALESCE(u.cargo_aprovacao, u.perfil::text) = 'supervisor_regional'
        OR COALESCE(u.cargo_aprovacao, u.perfil::text) = 'diretor'
        OR u.id_usuario IN (
          SELECT DISTINCT c.id_regional FROM escala_visitas_celula c WHERE c.id_regional IS NOT NULL
        )
      )
    ORDER BY u.nome
  `);
  return rows.map((r, i) => ({
    id_usuario: r.id_usuario,
    nome: r.nome,
    avatar_inicial: r.avatar_inicial,
    cor: CORES_REGIONAIS[i % CORES_REGIONAIS.length],
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
  } else if (!acessoTodasLojas(user) && !podeGerenciarEscalaVisitas(user)) {
    if (!idsRegiao.length) return [];
    params.push(idsRegiao);
    where += ` AND EXISTS (
      SELECT 1 FROM frota_regiao_lojas rl
      WHERE rl.id_loja = l.id_loja AND rl.id_regiao = ANY($${params.length}::int[])
    )`;
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
     ORDER BY COALESCE(NULLIF(TRIM(l.bk_number), ''), '99999'), l.name`,
    params,
  );
  return rows;
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
  const [semana, lojas, regionais, regioes] = await Promise.all([
    obterOuCriarSemana(semanaInicio, user.sub),
    lojasGrade(user, id_regiao),
    listarRegionaisEscala(),
    listarRegioesEscala(user),
  ]);

  const idsLojas = lojas.map((l) => l.id_loja);
  let celulas = [];
  if (idsLojas.length) {
    const { rows } = await pool.query(
      `SELECT c.id_loja, c.dia, c.id_regional, c.observacao, u.nome AS nome_regional
       FROM escala_visitas_celula c
       LEFT JOIN usuarios u ON u.id_usuario = c.id_regional
       WHERE c.id_semana = $1 AND c.id_loja = ANY($2::int[])`,
      [semana.id_semana, idsLojas],
    );
    celulas = rows;
  }

  const mapCel = new Map();
  for (const c of celulas) {
    mapCel.set(`${c.id_loja}-${c.dia}`, c);
  }

  const mapCor = new Map(regionais.map((r) => [r.id_usuario, r.cor]));

  const linhas = lojas.map((loja) => {
    const dias = [];
    let totalVisitas = 0;
    for (let dia = 0; dia < 7; dia++) {
      const c = mapCel.get(`${loja.id_loja}-${dia}`);
      if (c?.id_regional) totalVisitas += 1;
      dias.push({
        dia,
        id_regional: c?.id_regional ?? null,
        nome_regional: c?.nome_regional ?? null,
        cor: c?.id_regional ? mapCor.get(c.id_regional) || '#64748B' : null,
        observacao: c?.observacao ?? null,
      });
    }
    return {
      id_loja: loja.id_loja,
      nome: loja.name,
      bk_number: loja.bk_number,
      id_regiao: loja.id_regiao,
      nome_regiao: loja.nome_regiao,
      total_visitas: totalVisitas,
      dias,
    };
  });

  return {
    id_semana: semana.id_semana,
    semana_inicio: semanaInicio,
    semana_fim: domingoDaSemana(semanaInicio),
    semana_label: `${formatarDataBr(semanaInicio)} até ${formatarDataBr(domingoDaSemana(semanaInicio))}`,
    pode_editar: podeGerenciarEscalaVisitas(user),
    id_regiao_filtro: id_regiao ? Number(id_regiao) : null,
    regionais,
    regioes,
    linhas,
  };
}

export async function salvarGradeVisitas(user, { semana_inicio, celulas, id_regiao = null }) {
  if (!podeGerenciarEscalaVisitas(user)) throw new Error('Sem permissão para editar');

  const semanaInicio = segundaFeiraDaSemana(semana_inicio);
  const semana = await obterOuCriarSemana(semanaInicio, user.sub);
  const lista = Array.isArray(celulas) ? celulas : [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of lista) {
      const idLoja = Number(item.id_loja);
      const dia = Number(item.dia);
      if (!idLoja || dia < 0 || dia > 6) continue;

      const idRegional = item.id_regional != null && item.id_regional !== ''
        ? Number(item.id_regional)
        : null;
      const obs = item.observacao != null ? String(item.observacao).trim() || null : null;

      if (!idRegional && !obs) {
        await client.query(
          `DELETE FROM escala_visitas_celula
           WHERE id_semana = $1 AND id_loja = $2 AND dia = $3`,
          [semana.id_semana, idLoja, dia],
        );
      } else {
        await client.query(
          `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional, observacao)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id_semana, id_loja, dia) DO UPDATE SET
             id_regional = EXCLUDED.id_regional,
             observacao = EXCLUDED.observacao`,
          [semana.id_semana, idLoja, dia, idRegional, obs],
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
    `INSERT INTO escala_visitas_celula (id_semana, id_loja, dia, id_regional, observacao)
     SELECT $2, id_loja, dia, id_regional, observacao
     FROM escala_visitas_celula
     WHERE id_semana = $1`,
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
