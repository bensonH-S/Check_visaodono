import { pool } from './db.js';
import { carregarRegioesAtuacaoTecnico } from './lojasUsuario.js';
import {
  segundaFeiraDaSemana,
  podeVerEscalaVisitas,
  podeGerenciarEscalaVisitas,
  podeEditarEscalaRegiao,
  lojaExcluidaDaGradeEscala,
} from './escalaVisitas.js';

let schemaOk = false;

export async function garantirSchemaManutencao(client = pool) {
  if (schemaOk) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_manutencao_visita (
      id_celula SERIAL PRIMARY KEY,
      id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      data DATE NOT NULL,
      id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
      UNIQUE (id_usuario, data, id_loja)
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_escala_manutencao_visita_data
      ON escala_manutencao_visita (data, id_usuario)
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS escala_manutencao_horario (
      id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
      data DATE NOT NULL,
      hora_inicio TIME,
      hora_fim TIME,
      PRIMARY KEY (id_usuario, data)
    )
  `);
  schemaOk = true;
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function horaSql(v) {
  if (v == null || v === '') return null;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

function horaApi(v) {
  if (v == null || v === '') return null;
  return String(v).slice(0, 5);
}

const SQL_LISTAR_TECNICOS_MANUT = `
  SELECT u.id_usuario, u.nome,
         COALESCE(
           ARRAY_AGG(DISTINCT r.id_regiao) FILTER (WHERE r.id_regiao IS NOT NULL),
           '{}'
         ) AS ids_regiao,
         MIN(r.nome) AS nome_regiao
  FROM usuarios u
  LEFT JOIN frota_regiao_tecnicos rt ON rt.id_usuario = u.id_usuario
  LEFT JOIN frota_regioes r ON r.id_regiao = rt.id_regiao AND r.ativo = TRUE
  WHERE u.ativo = TRUE
    AND (
      u.perfil = 'tecnico'
      OR COALESCE(u.cargo_aprovacao, '') ILIKE '%tecnico%'
      OR COALESCE(u.cargo, '') ILIKE '%tecnico%'
      OR EXISTS (
        SELECT 1 FROM frota_regiao_tecnicos vinculo
        WHERE vinculo.id_usuario = u.id_usuario
      )
    )
    AND COALESCE(u.cargo_aprovacao, u.perfil::text) NOT IN (
      'administrador', 'diretor', 'ceo', 'supervisor_regional', 'financeiro'
    )
  GROUP BY u.id_usuario, u.nome
  ORDER BY MIN(r.id_regiao) NULLS LAST, u.nome
`;

const CORES_TECNICOS = [
  '#1B2A6B',
  '#E8520A',
  '#0F766E',
  '#6D28D9',
  '#BE185D',
  '#0369A1',
  '#B45309',
  '#334155',
];

function corTecnico(idUsuario) {
  return CORES_TECNICOS[Math.abs(Number(idUsuario)) % CORES_TECNICOS.length];
}

function mapTecnicoRow(t) {
  const idsRegiao = Array.isArray(t.ids_regiao)
    ? t.ids_regiao.map(Number).filter(Boolean)
    : [];
  const idUsuario = Number(t.id_usuario);
  return {
    id_usuario: idUsuario,
    nome: t.nome,
    id_regiao: idsRegiao[0] ?? null,
    ids_regiao: idsRegiao,
    nome_regiao: t.nome_regiao || null,
    grupo: t.nome_regiao || 'Sem região',
    cor: corTecnico(idUsuario),
  };
}

function tecnicoPublico(t) {
  return {
    id_usuario: t.id_usuario,
    nome: t.nome,
    id_regiao: t.id_regiao,
    nome_regiao: t.nome_regiao,
    grupo: t.grupo,
    cor: t.cor || corTecnico(t.id_usuario),
  };
}

async function carregarUsuarioResumo(idUsuario) {
  const id = Number(idUsuario);
  if (!id) return null;
  const { rows } = await pool.query(
    'SELECT id_usuario, nome FROM usuarios WHERE id_usuario = $1',
    [id],
  );
  if (!rows[0]) return null;
  return { id_usuario: Number(rows[0].id_usuario), nome: rows[0].nome };
}

async function resolverRegionalResponsavel(user, escopo) {
  if (escopo.tipo === 'regiao') {
    return carregarUsuarioResumo(user.sub);
  }
  if (escopo.tipo === 'proprio' && Array.isArray(escopo.idsRegiao) && escopo.idsRegiao.length) {
    const { rows } = await pool.query(
      `SELECT u.id_usuario, u.nome
       FROM frota_regioes r
       LEFT JOIN usuarios u ON u.id_usuario = r.id_regional
       WHERE r.id_regiao = ANY($1::int[]) AND r.ativo = TRUE AND u.id_usuario IS NOT NULL
       ORDER BY r.id_regiao
       LIMIT 1`,
      [escopo.idsRegiao],
    );
    if (rows[0]) {
      return { id_usuario: Number(rows[0].id_usuario), nome: rows[0].nome };
    }
  }
  return null;
}

/** Técnicos da região (Frota) ou com lojas da região e sem vínculo em outra região. */
async function idsTecnicosPorLojasDaRegiao(idsRegiao, idsCandidatos) {
  if (!idsRegiao?.length || !idsCandidatos?.length) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT ul.id_usuario
     FROM usuario_lojas ul
     JOIN frota_regiao_lojas rl
       ON rl.id_loja = ul.id_loja AND rl.id_regiao = ANY($1::int[])
     WHERE ul.id_usuario = ANY($2::int[])`,
    [idsRegiao, idsCandidatos],
  );
  return rows.map((r) => Number(r.id_usuario)).filter(Boolean);
}

/** Diretor vê a rede; regional só os técnicos da própria região; técnico só a própria escala. */
async function resolverEscopoManutencao(user, tecnicos) {
  const meuId = Number(user?.sub);
  const souTecnico = Boolean(meuId && tecnicos.some((t) => t.id_usuario === meuId));

  if (podeGerenciarEscalaVisitas(user) && !souTecnico) {
    return {
      tipo: 'rede',
      idsTecnicos: tecnicos.map((t) => t.id_usuario),
      idsRegiao: null,
    };
  }

  if (podeEditarEscalaRegiao(user)) {
    const regioes = await carregarRegioesAtuacaoTecnico(user.sub);
    const idsRegiao = regioes.map((r) => Number(r.id_regiao)).filter(Boolean);
    const idsSet = new Set(idsRegiao);
    const vinculados = tecnicos.filter((t) =>
      (t.ids_regiao || []).some((id) => idsSet.has(Number(id))),
    );
    const candidatosLoja = tecnicos.filter((t) => {
      const regs = (t.ids_regiao || []).map(Number).filter(Boolean);
      return regs.length === 0 || regs.every((id) => idsSet.has(id));
    });
    const porLoja = new Set(
      await idsTecnicosPorLojasDaRegiao(
        idsRegiao,
        candidatosLoja.map((t) => t.id_usuario),
      ),
    );
    const idsTecnicos = [
      ...new Set([
        ...vinculados.map((t) => t.id_usuario),
        ...candidatosLoja.filter((t) => porLoja.has(t.id_usuario)).map((t) => t.id_usuario),
      ]),
    ];
    return { tipo: 'regiao', idsTecnicos, idsRegiao };
  }

  if (souTecnico) {
    const eu = tecnicos.find((t) => t.id_usuario === meuId);
    return {
      tipo: 'proprio',
      idsTecnicos: [meuId],
      idsRegiao: eu?.ids_regiao?.length ? eu.ids_regiao : null,
    };
  }

  return { tipo: 'nenhum', idsTecnicos: [], idsRegiao: [] };
}

async function listarLojasManutencao(idsRegiao) {
  const params = [];
  let filtroRegiao = '';
  if (Array.isArray(idsRegiao)) {
    if (!idsRegiao.length) return [];
    params.push(idsRegiao);
    filtroRegiao = `AND EXISTS (
      SELECT 1 FROM frota_regiao_lojas rl
      WHERE rl.id_loja = l.id_loja AND rl.id_regiao = ANY($1::int[])
    )`;
  }
  const { rows } = await pool.query(
    `SELECT l.id_loja, l.name, l.bk_number
     FROM lojas l
     WHERE l.is_active = TRUE
       ${filtroRegiao}
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
  return rows
    .filter((l) => !lojaExcluidaDaGradeEscala(l.name))
    .map((l) => ({
      id_loja: Number(l.id_loja),
      nome: l.name,
      bk_number: l.bk_number || null,
    }));
}

export async function carregarGradeManutencao(user, { semana_inicio } = {}) {
  if (!podeVerEscalaVisitas(user)) {
    throw new Error('Sem permissão para ver a escala de manutenção');
  }
  await garantirSchemaManutencao();
  const inicio = segundaFeiraDaSemana(semana_inicio || new Date());
  const fim = addDaysIso(inicio, 6);

  const { rows: tecnicosRows } = await pool.query(SQL_LISTAR_TECNICOS_MANUT);
  const tecnicosTodos = tecnicosRows.map(mapTecnicoRow);
  const escopo = await resolverEscopoManutencao(user, tecnicosTodos);
  const idsTecnicos = new Set(escopo.idsTecnicos);
  const tecnicos = tecnicosTodos.filter((t) => idsTecnicos.has(t.id_usuario)).map(tecnicoPublico);
  const lojas = await listarLojasManutencao(escopo.idsRegiao);
  const idsLoja = new Set(lojas.map((l) => l.id_loja));

  const { rows: visitaRows } = await pool.query(
    `SELECT id_usuario, data::text AS data, id_loja
     FROM escala_manutencao_visita
     WHERE data >= $1::date AND data <= $2::date`,
    [inicio, fim],
  );

  const visitas = visitaRows
    .map((v) => {
      const data = String(v.data).slice(0, 10);
      const dia = Math.round((new Date(`${data}T12:00:00`) - new Date(`${inicio}T12:00:00`)) / 86400000);
      return {
        id_usuario: Number(v.id_usuario),
        dia,
        id_loja: Number(v.id_loja),
      };
    })
    .filter(
      (v) =>
        v.dia >= 0 &&
        v.dia <= 6 &&
        idsTecnicos.has(v.id_usuario) &&
        idsLoja.has(v.id_loja),
    );

  const { rows: horarioRows } = await pool.query(
    `SELECT id_usuario, data::text AS data, hora_inicio::text AS hora_inicio, hora_fim::text AS hora_fim
     FROM escala_manutencao_horario
     WHERE data >= $1::date AND data <= $2::date`,
    [inicio, fim],
  );
  const horarios = horarioRows
    .map((h) => {
      const data = String(h.data).slice(0, 10);
      const dia = Math.round((new Date(`${data}T12:00:00`) - new Date(`${inicio}T12:00:00`)) / 86400000);
      return {
        id_usuario: Number(h.id_usuario),
        dia,
        hora_inicio: horaApi(h.hora_inicio),
        hora_fim: horaApi(h.hora_fim),
      };
    })
    .filter((h) => h.dia >= 0 && h.dia <= 6 && idsTecnicos.has(h.id_usuario));

  const idsEditaveis = escopo.tipo === 'nenhum' ? [] : escopo.idsTecnicos;
  const regionalResponsavel = await resolverRegionalResponsavel(user, escopo);
  return {
    semana_inicio: inicio,
    semana_fim: fim,
    pode_editar: idsEditaveis.length > 0,
    ids_tecnicos_editaveis: idsEditaveis,
    escopo: escopo.tipo,
    regional_responsavel: regionalResponsavel,
    tecnicos,
    lojas,
    visitas,
    horarios,
  };
}

export async function salvarGradeManutencao(user, body) {
  if (!podeVerEscalaVisitas(user)) {
    throw new Error('Sem permissão para editar a escala de manutenção');
  }
  await garantirSchemaManutencao();
  const inicio = segundaFeiraDaSemana(body?.semana_inicio || new Date());
  const { rows: tecnicosRows } = await pool.query(SQL_LISTAR_TECNICOS_MANUT);
  const escopo = await resolverEscopoManutencao(user, tecnicosRows.map(mapTecnicoRow));
  const permitidos = new Set(escopo.idsTecnicos);
  if (!permitidos.size) {
    throw new Error('Sem permissão para editar a escala de manutenção');
  }
  const lojasPermitidas = new Set((await listarLojasManutencao(escopo.idsRegiao)).map((l) => l.id_loja));
  const lista = Array.isArray(body?.celulas) ? body.celulas : [];
  const horarios = Array.isArray(body?.horarios) ? body.horarios : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of lista) {
      const idUsuario = Number(item.id_usuario);
      const dia = Number(item.dia);
      if (!idUsuario || !permitidos.has(idUsuario) || dia < 0 || dia > 6) continue;
      const data = addDaysIso(inicio, dia);
      const idsLoja = Array.isArray(item.id_lojas)
        ? [...new Set(item.id_lojas.map(Number).filter((id) => id && lojasPermitidas.has(id)))]
        : [];
      await client.query(
        `DELETE FROM escala_manutencao_visita WHERE id_usuario = $1 AND data = $2::date`,
        [idUsuario, data],
      );
      for (const idLoja of idsLoja) {
        await client.query(
          `INSERT INTO escala_manutencao_visita (id_usuario, data, id_loja)
           VALUES ($1, $2::date, $3)
           ON CONFLICT (id_usuario, data, id_loja) DO NOTHING`,
          [idUsuario, data, idLoja],
        );
      }
    }
    for (const item of horarios) {
      const idUsuario = Number(item.id_usuario);
      const dia = Number(item.dia);
      if (!idUsuario || !permitidos.has(idUsuario) || dia < 0 || dia > 6) continue;
      const data = addDaysIso(inicio, dia);
      const horaInicio = horaSql(item.hora_inicio);
      const horaFim = horaSql(item.hora_fim);
      if (!horaInicio && !horaFim) {
        await client.query(
          `DELETE FROM escala_manutencao_horario WHERE id_usuario = $1 AND data = $2::date`,
          [idUsuario, data],
        );
      } else {
        await client.query(
          `INSERT INTO escala_manutencao_horario (id_usuario, data, hora_inicio, hora_fim)
           VALUES ($1, $2::date, $3::time, $4::time)
           ON CONFLICT (id_usuario, data) DO UPDATE
             SET hora_inicio = EXCLUDED.hora_inicio, hora_fim = EXCLUDED.hora_fim`,
          [idUsuario, data, horaInicio, horaFim],
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return carregarGradeManutencao(user, { semana_inicio: inicio });
}
