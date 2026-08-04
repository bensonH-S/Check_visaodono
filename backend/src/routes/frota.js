import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import {
  acessoTodasLojas,
  temPermissao,
  requirePermissao,
} from '../permissoes.js';
import {
  idsRegioesVisiveisMapaFrota,
  usuarioPodeVerRegiaoMapa,
} from '../lojasUsuario.js';
import { gpsTecnicosAtivo, gpsCapturaHabilitadaUsuario } from '../gpsTecnicos.js';
import { encryptAnexo, decryptAnexo } from '../fotos.js';
import {
  EMPRESA_TERMO,
  TERMO_FERRAMENTAS_VERSAO,
  textoTermoFerramentas,
} from '../config/termoFerramentas.js';
import { auditar } from '../auditoriaHelpers.js';
import {
  kmBaseVeiculo,
  resolverKmOdometro,
  sincronizarKmAtualVeiculo,
  enriquecerKmVeiculo,
  sincronizarKmAtualComGpsDesdeAssuncao,
} from '../services/frotaKmVeiculo.js';
import {
  combinarVeiculosComRastreamento,
  fulltrackRastreamentoAtivo,
  fulltrackStatus,
  historicoVeiculoFulltrack,
  kmRastreadorVeiculoPeriodo,
  limiteVelocidadeKmh,
  relatorioRotaVeiculoPeriodo,
  relatorioVelocidadeVeiculoPeriodo,
} from '../services/fulltrackFleet.js';
import { ajustarRotaAsRuas } from '../services/routeMatching.js';
import {
  enriquecerRegistrosVelocidade,
  enriquecerRotasComTecnicoExcesso,
  listarAssuncoesVeiculoPeriodo,
} from '../services/frotaAssuncaoHistorico.js';
import {
  encontrarDocumentoDisco,
  lerDocumentoDisco,
  removerDocumentoDisco,
  salvarDocumentoDisco,
} from '../frotaDocumentoArquivo.js';
import {
  listarMultasDetranCache,
  executarSyncMultasDetran,
} from '../services/schedulerMultasDetran.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const APP_BASE = '/auditoria';

function midiaUrlFrota(idAnexo) {
  return `${APP_BASE}/api/frota/anexos/${idAnexo}/media`;
}

async function salvarAnexo({ contexto, idReferencia, idUsuario, file, nome }) {
  const criptografado = encryptAnexo(file.buffer);
  const { rows } = await pool.query(
    `INSERT INTO frota_anexos (contexto, id_referencia, nome_arquivo, arquivo_url, tipo_mime, id_usuario)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_anexo, tipo_mime`,
    [contexto, idReferencia, nome || file.originalname || 'anexo', criptografado, file.mimetype, idUsuario],
  );
  return rows[0];
}

async function veiculoDoUsuario(idUsuario) {
  const { rows } = await pool.query(
    `SELECT v.*, u.nome AS nome_responsavel
     FROM frota_veiculos v
     LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
     WHERE v.id_usuario_responsavel = $1 AND v.ativo = TRUE
     LIMIT 1`,
    [idUsuario],
  );
  return rows[0] || null;
}

function mapVeiculo(row) {
  if (!row) return null;
  return {
    id_veiculo: row.id_veiculo,
    placa: row.placa,
    renavam: row.renavam,
    chassi: row.chassi,
    marca: row.marca,
    modelo: row.modelo,
    ano: row.ano,
    cor: row.cor,
    combustivel: row.combustivel,
    km_inicial: row.km_inicial,
    km_atual: row.km_atual,
    proxima_manutencao_km: row.proxima_manutencao_km,
    observacoes: row.observacoes,
    assuncao_em: row.assuncao_em,
    nome_responsavel: row.nome_responsavel,
  };
}

const COLS_VEICULO = `v.id_veiculo, v.placa, v.renavam, v.chassi, v.marca, v.modelo, v.ano, v.cor,
  v.combustivel, v.km_inicial, v.km_atual, v.proxima_manutencao_km, v.observacoes, v.id_usuario_responsavel, v.assuncao_em, v.ativo,
  v.id_regiao, v.created_at, v.updated_at, u.nome AS nome_responsavel, r.nome AS nome_regiao`;

async function syncRegiaoLojas(idRegiao, idLojas) {
  const ids = [...new Set((idLojas || []).map(Number).filter((n) => n > 0))];
  await pool.query('DELETE FROM frota_regiao_lojas WHERE id_regiao = $1', [idRegiao]);
  for (const idLoja of ids) {
    await pool.query(
      `INSERT INTO frota_regiao_lojas (id_regiao, id_loja) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idRegiao, idLoja],
    );
  }
}

async function syncRegiaoTecnicos(idRegiao, tecnicosEntrada) {
  const lista = Array.isArray(tecnicosEntrada) ? tecnicosEntrada : [];
  const normalizados = lista
    .map((item) => {
      if (typeof item === 'number') {
        const id = Number(item);
        return id > 0 ? { id_usuario: id, gps_habilitado: true } : null;
      }
      const id = Number(item?.id_usuario);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        id_usuario: id,
        gps_habilitado: item?.gps_habilitado !== false,
      };
    })
    .filter(Boolean);

  const idsUnicos = new Map();
  for (const item of normalizados) {
    idsUnicos.set(item.id_usuario, item);
  }
  const itens = [...idsUnicos.values()];

  await pool.query('DELETE FROM frota_regiao_tecnicos WHERE id_regiao = $1', [idRegiao]);
  for (const item of itens) {
    await pool.query(
      `INSERT INTO frota_regiao_tecnicos (id_regiao, id_usuario, gps_habilitado)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_regiao, id_usuario) DO UPDATE SET gps_habilitado = EXCLUDED.gps_habilitado`,
      [idRegiao, item.id_usuario, item.gps_habilitado],
    );
  }

  for (const item of itens) {
    const habilitado = await gpsCapturaHabilitadaUsuario(item.id_usuario);
    if (!habilitado) {
      await pool.query('DELETE FROM frota_tecnico_posicao WHERE id_usuario = $1', [item.id_usuario]);
    }
  }
}

async function syncRegiaoRegionais(idRegiao, idRegionais) {
  const ids = [...new Set((idRegionais || []).map(Number).filter((n) => n > 0))];
  await pool.query('DELETE FROM frota_regiao_regionais WHERE id_regiao = $1', [idRegiao]);
  for (const idUsuario of ids) {
    await pool.query(
      `INSERT INTO frota_regiao_regionais (id_regiao, id_usuario) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idRegiao, idUsuario],
    );
  }
  await pool.query(`UPDATE frota_regioes SET id_regional = $2, updated_at = NOW() WHERE id_regiao = $1`, [
    idRegiao,
    ids[0] ?? null,
  ]);
}

async function syncRegiaoVeiculos(_idRegiao, _idVeiculos) {
  // Veículos não são vinculados manualmente à região — associação é dinâmica via assunção/devolução.
}

/** Região de atuação do técnico (primeira região vinculada). */
async function regiaoDoTecnico(idUsuario) {
  const { rows } = await pool.query(
    `SELECT rt.id_regiao
     FROM frota_regiao_tecnicos rt
     JOIN frota_regioes r ON r.id_regiao = rt.id_regiao AND r.ativo = TRUE
     WHERE rt.id_usuario = $1
     ORDER BY r.nome
     LIMIT 1`,
    [idUsuario],
  );
  return rows[0]?.id_regiao ?? null;
}

const SQL_VEICULOS_REGIOES = `
  SELECT DISTINCT ON (v.id_veiculo)
         v.id_veiculo, v.placa, v.marca, v.modelo,
         rt.id_regiao AS id_regiao,
         r.nome AS nome_regiao
  FROM frota_veiculos v
  INNER JOIN frota_regiao_tecnicos rt ON rt.id_usuario = v.id_usuario_responsavel
  INNER JOIN frota_regioes r ON r.id_regiao = rt.id_regiao AND r.ativo = TRUE
  WHERE v.ativo = TRUE
    AND v.id_usuario_responsavel IS NOT NULL
    AND rt.id_regiao = ANY($1::int[])
  ORDER BY v.id_veiculo, v.placa`;

const SQL_VEICULOS_REGIAO_DETALHE = `
  SELECT v.id_veiculo, v.placa, v.marca, v.modelo, v.ano, v.cor, v.combustivel,
         rt.id_regiao, r.nome AS nome_regiao, u.nome AS nome_responsavel
  FROM frota_veiculos v
  INNER JOIN frota_regiao_tecnicos rt ON rt.id_usuario = v.id_usuario_responsavel AND rt.id_regiao = $1
  LEFT JOIN frota_regioes r ON r.id_regiao = rt.id_regiao
  LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
  WHERE v.ativo = TRUE AND v.id_usuario_responsavel IS NOT NULL
  ORDER BY v.placa`;

const requirePermRegioes = requirePermissao('frota.gerenciar', 'frota.regioes');
const requirePermMapaTecnicos = requirePermissao(
  'frota.mapa.ver',
  'lojas.todas',
  'frota.regioes',
  'frota.gerenciar',
);

function parseRegionaisJson(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return [];
}

function mapRegiaoRow(row) {
  if (!row) return null;
  const regionais = parseRegionaisJson(row.regionais);
  const primeiro = regionais[0];
  return {
    id_regiao: row.id_regiao,
    nome: row.nome,
    descricao: row.descricao,
    ativo: row.ativo,
    id_regional: row.id_regional ?? primeiro?.id_usuario ?? null,
    nome_regional: row.nome_regional ?? primeiro?.nome ?? null,
    email_regional: row.email_regional ?? primeiro?.email ?? null,
    regionais,
    qtd_lojas: row.qtd_lojas,
    qtd_tecnicos: row.qtd_tecnicos,
    qtd_veiculos: row.qtd_veiculos,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SQL_CARGO_USUARIO = `COALESCE(u.cargo_aprovacao, u.perfil::text)`;
const CARGOS_TECNICO = `('tecnico')`;
const CARGOS_REGIONAL = `('supervisor_regional')`;

function erroRegiaoDb(e, res) {
  if (e.code === '23505') {
    res.status(409).json({ error: 'Já existe uma região com este nome' });
    return true;
  }
  if (e.code === '42P01') {
    res.status(503).json({
      error:
        'Estrutura de regiões não instalada no banco. Rode: npm run migrate:frota-regioes',
    });
    return true;
  }
  return false;
}

/** Resumo mobile: veículo, termo, últimos abastecimentos */
router.get('/mobile/resumo', requirePermissao('frota.usar', 'frota.gerenciar'), async (req, res, next) => {
  try {
    const idUsuario = req.user.sub;
    let veiculo = await veiculoDoUsuario(idUsuario);
    if (veiculo) {
      await sincronizarKmAtualVeiculo(veiculo.id_veiculo);
      veiculo = await veiculoDoUsuario(idUsuario);
    }

    const { rows: termoRows } = await pool.query(
      `SELECT id_termo, termo_versao, assinado_em
       FROM frota_termos_ferramentas
       WHERE id_usuario = $1 AND termo_versao = $2
       ORDER BY assinado_em DESC LIMIT 1`,
      [idUsuario, TERMO_FERRAMENTAS_VERSAO],
    );

    const abastecimentos = veiculo
      ? (
          await pool.query(
            `SELECT a.id_abastecimento, a.km_atual, a.valor_abastecido, a.data_abastecimento,
                    a.id_anexo_comprovante
             FROM frota_abastecimentos a
             WHERE a.id_veiculo = $1
             ORDER BY a.data_abastecimento DESC LIMIT 10`,
            [veiculo.id_veiculo],
          )
        ).rows.map((a) => ({
          ...a,
          valor_abastecido: Number(a.valor_abastecido),
          comprovante_url: a.id_anexo_comprovante ? midiaUrlFrota(a.id_anexo_comprovante) : null,
        }))
      : [];

    res.json({
      veiculo: mapVeiculo(veiculo),
      termo: {
        versao: TERMO_FERRAMENTAS_VERSAO,
        assinado: termoRows.length > 0,
        assinado_em: termoRows[0]?.assinado_em || null,
      },
      abastecimentos,
    });
  } catch (e) {
    next(e);
  }
});

/** Histórico mobile: abastecimentos do técnico (e do veículo atual, se houver). */
router.get('/mobile/abastecimentos', requirePermissao('frota.usar', 'frota.gerenciar'), async (req, res, next) => {
  try {
    const idUsuario = req.user.sub;
    const veiculo = await veiculoDoUsuario(idUsuario);
    const idVeiculo = veiculo?.id_veiculo ?? null;

    const { rows } = await pool.query(
      `SELECT a.id_abastecimento, a.id_veiculo, a.km_atual, a.valor_abastecido,
              a.data_abastecimento, a.id_anexo_comprovante, v.placa
       FROM frota_abastecimentos a
       JOIN frota_veiculos v ON v.id_veiculo = a.id_veiculo
       WHERE a.id_usuario = $1
          OR ($2::int IS NOT NULL AND a.id_veiculo = $2)
       ORDER BY a.data_abastecimento DESC
       LIMIT 50`,
      [idUsuario, idVeiculo],
    );

    res.json(
      rows.map((a) => ({
        id_abastecimento: a.id_abastecimento,
        id_veiculo: a.id_veiculo,
        placa: a.placa,
        km_atual: Number(a.km_atual),
        valor_abastecido: Number(a.valor_abastecido),
        data_abastecimento: a.data_abastecimento,
        comprovante_url: a.id_anexo_comprovante ? midiaUrlFrota(a.id_anexo_comprovante) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

/** Histórico mobile: manutenções do técnico (e do veículo atual, se houver). */
router.get('/mobile/manutencoes', requirePermissao('frota.usar', 'frota.gerenciar'), async (req, res, next) => {
  try {
    const idUsuario = req.user.sub;
    const veiculo = await veiculoDoUsuario(idUsuario);
    const idVeiculo = veiculo?.id_veiculo ?? null;

    const { rows } = await pool.query(
      `SELECT m.id_manutencao, m.id_veiculo, m.descricao, m.km, m.valor,
              m.data_manutencao, m.proxima_manutencao_km, m.id_anexo, v.placa
       FROM frota_manutencoes_veiculo m
       JOIN frota_veiculos v ON v.id_veiculo = m.id_veiculo
       WHERE m.id_usuario = $1
          OR ($2::int IS NOT NULL AND m.id_veiculo = $2)
       ORDER BY m.data_manutencao DESC, m.created_at DESC
       LIMIT 50`,
      [idUsuario, idVeiculo],
    );

    res.json(
      rows.map((m) => ({
        id_manutencao: m.id_manutencao,
        id_veiculo: m.id_veiculo,
        placa: m.placa,
        descricao: m.descricao,
        km: m.km != null ? Number(m.km) : null,
        valor: m.valor != null ? Number(m.valor) : null,
        data_manutencao: m.data_manutencao,
        proxima_manutencao_km: m.proxima_manutencao_km != null ? Number(m.proxima_manutencao_km) : null,
        comprovante_url: m.id_anexo ? midiaUrlFrota(m.id_anexo) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

/** Portal: histórico local legado (registros manuais antigos). */
router.get('/multas', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id_multa, m.id_veiculo, m.id_usuario, m.descricao, m.valor,
              m.data_multa, m.local_infracao, m.id_anexo, m.created_at,
              v.placa, u.nome AS nome_usuario
       FROM frota_multas m
       JOIN frota_veiculos v ON v.id_veiculo = m.id_veiculo
       JOIN usuarios u ON u.id_usuario = m.id_usuario
       ORDER BY m.data_multa DESC, m.created_at DESC
       LIMIT 300`,
    );
    res.json(
      rows.map((m) => ({
        ...m,
        valor: m.valor != null ? Number(m.valor) : null,
        foto_url: m.id_anexo ? midiaUrlFrota(m.id_anexo) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

/**
 * Multas DETRAN-DF em cache (consulta Infosimples 1x/dia às 17:00).
 * Não gasta saldo ao abrir a tela — só lê o banco.
 * Query: ?id_veiculo=
 */
router.get('/multas/detran', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = req.query.id_veiculo != null ? Number(req.query.id_veiculo) : null;
    const cache = await listarMultasDetranCache({
      idVeiculo: idVeiculo && Number.isFinite(idVeiculo) ? idVeiculo : null,
    });
    res.json(cache);
  } catch (e) {
    next(e);
  }
});

/**
 * Força sync Infosimples (uso excepcional — gasta saldo).
 * Body/query: forcar=1
 */
router.post('/multas/detran/sync', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const forcar =
      req.query.forcar === '1' ||
      req.body?.forcar === true ||
      req.body?.forcar === '1';
    const result = await executarSyncMultasDetran({ forcar });
    const cache = await listarMultasDetranCache({});
    res.json({ ...result, cache });
  } catch (e) {
    next(e);
  }
});

/** Detalhe de um veículo a partir do cache (sem Infosimples). */
router.get('/veiculos/:id/multas/detran', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    if (!Number.isFinite(idVeiculo)) return res.status(400).json({ error: 'Veículo inválido' });
    const cache = await listarMultasDetranCache({ idVeiculo });
    res.json({
      id_veiculo: idVeiculo,
      ...cache,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/veiculos', requirePermissao('frota.usar', 'frota.gerenciar'), async (req, res, next) => {
  try {
    const { rows: ids } = await pool.query(
      `SELECT id_veiculo FROM frota_veiculos WHERE ativo = TRUE`,
    );
    await Promise.all(ids.map((r) => sincronizarKmAtualVeiculo(r.id_veiculo)));

    // KM atual = KM da atribuição + KM rodado no GPS desde então
    try {
      await sincronizarKmAtualComGpsDesdeAssuncao();
    } catch {
      /* rastreador indisponível — mantém KM dos registros manuais */
    }

    const { rows } = await pool.query(
      `SELECT ${COLS_VEICULO},
              (
                SELECT a.km_inicio
                FROM frota_assuncoes a
                WHERE a.id_veiculo = v.id_veiculo AND a.data_fim IS NULL
                ORDER BY a.data_inicio DESC
                LIMIT 1
              ) AS km_assuncao
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.ativo = TRUE
       ORDER BY v.placa`,
    );

    let gpsPorId = new Map();
    try {
      const comGps = await combinarVeiculosComRastreamento(rows);
      gpsPorId = new Map(comGps.map((g) => [g.id_veiculo, g]));
    } catch {
      /* ok */
    }

    res.json(
      rows.map((row) => {
        const base = enriquecerKmVeiculo(row);
        const g = gpsPorId.get(row.id_veiculo);
        return {
          ...base,
          id_rastreamento: g?.id_rastreamento ?? null,
          gps_instalado: g?.id_rastreamento != null,
          rastreamento_disponivel: g?.rastreamento_disponivel ?? false,
          odometro_gps: g?.odometro_km ?? null,
        };
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/assuncoes', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo =
      req.query.id_veiculo != null && String(req.query.id_veiculo).trim() !== ''
        ? Number(req.query.id_veiculo)
        : null;
    const params = [];
    let where = '';
    if (idVeiculo && Number.isFinite(idVeiculo)) {
      params.push(idVeiculo);
      where = `WHERE a.id_veiculo = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT a.id_assuncao, a.id_veiculo, a.id_usuario, a.km_inicio, a.km_fim, a.data_inicio, a.data_fim,
              v.placa, u.nome AS nome_usuario
       FROM frota_assuncoes a
       JOIN frota_veiculos v ON v.id_veiculo = a.id_veiculo
       JOIN usuarios u ON u.id_usuario = a.id_usuario
       ${where}
       ORDER BY a.data_inicio DESC
       LIMIT 500`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/abastecimentos', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id_abastecimento, a.id_veiculo, a.id_usuario, a.km_atual, a.valor_abastecido,
              a.data_abastecimento, a.id_anexo_comprovante,
              v.placa, u.nome AS nome_usuario
       FROM frota_abastecimentos a
       JOIN frota_veiculos v ON v.id_veiculo = a.id_veiculo
       JOIN usuarios u ON u.id_usuario = a.id_usuario
       ORDER BY a.data_abastecimento DESC
       LIMIT 200`,
    );
    res.json(
      rows.map((a) => ({
        ...a,
        valor_abastecido: Number(a.valor_abastecido),
        comprovante_url: a.id_anexo_comprovante ? midiaUrlFrota(a.id_anexo_comprovante) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/manutencoes', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id_manutencao, m.id_veiculo, m.id_usuario, m.descricao, m.km, m.valor,
              m.data_manutencao, m.proxima_manutencao, m.proxima_manutencao_km, m.created_at,
              v.placa, v.km_atual AS km_atual_veiculo, u.nome AS nome_usuario
       FROM frota_manutencoes_veiculo m
       JOIN frota_veiculos v ON v.id_veiculo = m.id_veiculo
       JOIN usuarios u ON u.id_usuario = m.id_usuario
       ORDER BY m.data_manutencao DESC, m.created_at DESC
       LIMIT 200`,
    );
    res.json(
      rows.map((m) => ({
        ...m,
        km: m.km != null ? Number(m.km) : null,
        km_atual_veiculo: m.km_atual_veiculo != null ? Number(m.km_atual_veiculo) : null,
        proxima_manutencao_km: m.proxima_manutencao_km != null ? Number(m.proxima_manutencao_km) : null,
        valor: m.valor != null ? Number(m.valor) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/termos', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.id_termo, t.id_usuario, t.termo_versao, t.assinado_em, t.assinatura_url,
              u.nome AS nome_usuario,
              COALESCE(
                (
                  SELECT string_agg(r.nome, ', ' ORDER BY r.nome)
                  FROM frota_regiao_tecnicos rt
                  JOIN frota_regioes r ON r.id_regiao = rt.id_regiao AND r.ativo = TRUE
                  WHERE rt.id_usuario = t.id_usuario
                ),
                '—'
              ) AS nome_regiao
       FROM frota_termos_ferramentas t
       JOIN usuarios u ON u.id_usuario = t.id_usuario
       ORDER BY t.assinado_em DESC
       LIMIT 500`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/termos/:id', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idTermo = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT t.id_termo, t.id_usuario, t.termo_versao, t.assinado_em, t.assinatura_url,
              u.nome AS nome_usuario
       FROM frota_termos_ferramentas t
       JOIN usuarios u ON u.id_usuario = t.id_usuario
       WHERE t.id_termo = $1`,
      [idTermo],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Termo não encontrado' });

    const { rows: fotos } = await pool.query(
      `SELECT tf.id_anexo
       FROM frota_termo_fotos tf
       WHERE tf.id_termo = $1
       ORDER BY tf.id_foto`,
      [idTermo],
    );

    const termo = rows[0];
    res.json({
      ...termo,
      texto: textoTermoFerramentas(termo.nome_usuario),
      empresa: EMPRESA_TERMO,
      fotos: fotos.map((f) => ({
        id_anexo: f.id_anexo,
        url: midiaUrlFrota(f.id_anexo),
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/mapa/posicoes', requirePermMapaTecnicos, async (req, res, next) => {
  try {
    const idsRegiao = await idsRegioesVisiveisMapaFrota(req.user);
    if (!idsRegiao.length) {
      return res.json({ tecnicos: [], lojas: [], regioes: [] });
    }

    const { rows: tecnicos } = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email,
              rt.gps_habilitado,
              r.id_regiao, r.nome AS nome_regiao,
              p.latitude, p.longitude, p.precisao_metros, p.atualizado_em
       FROM frota_regiao_tecnicos rt
       JOIN frota_regioes r ON r.id_regiao = rt.id_regiao AND r.ativo = TRUE
       JOIN usuarios u ON u.id_usuario = rt.id_usuario AND u.ativo = TRUE
       LEFT JOIN frota_tecnico_posicao p ON p.id_usuario = u.id_usuario
       WHERE rt.id_regiao = ANY($1::int[])
       ORDER BY r.nome, u.nome`,
      [idsRegiao],
    );

    const { rows: lojas } = await pool.query(
      `SELECT l.id_loja, l.name, l.bk_number, l.address, l.neighborhood, l.city, l.state,
              l.latitude, l.longitude, rl.id_regiao, r.nome AS nome_regiao
       FROM frota_regiao_lojas rl
       JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
       JOIN lojas l ON l.id_loja = rl.id_loja
       WHERE rl.id_regiao = ANY($1::int[]) AND l.is_active = TRUE
       ORDER BY r.nome, l.name`,
      [idsRegiao],
    );

    const { rows: regioes } = await pool.query(
      `SELECT id_regiao, nome FROM frota_regioes
       WHERE id_regiao = ANY($1::int[]) AND ativo = TRUE
       ORDER BY nome`,
      [idsRegiao],
    );

    const { rows: veiculosDb } = await pool.query(SQL_VEICULOS_REGIOES, [idsRegiao]);

    let veiculos = await combinarVeiculosComRastreamento(veiculosDb);

    res.json({
      tecnicos,
      lojas,
      regioes,
      veiculos,
      rastreamento_ativo: fulltrackRastreamentoAtivo(),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/regioes', requirePermRegioes, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id_regiao, r.nome, r.descricao, r.ativo, r.id_regional, r.created_at, r.updated_at,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'id_usuario', u.id_usuario,
                      'nome', u.nome,
                      'email', u.email
                    ) ORDER BY u.nome
                  )
                  FROM frota_regiao_regionais rr
                  JOIN usuarios u ON u.id_usuario = rr.id_usuario
                  WHERE rr.id_regiao = r.id_regiao
                ),
                '[]'::json
              ) AS regionais,
              COUNT(DISTINCT rl.id_loja)::int AS qtd_lojas,
              COUNT(DISTINCT rt.id_usuario)::int AS qtd_tecnicos,
              COUNT(DISTINCT v.id_veiculo) FILTER (
                WHERE v.ativo = TRUE
                  AND v.id_usuario_responsavel IS NOT NULL
                  AND EXISTS (
                    SELECT 1
                    FROM frota_regiao_tecnicos rtv
                    WHERE rtv.id_usuario = v.id_usuario_responsavel
                      AND rtv.id_regiao = r.id_regiao
                  )
              )::int AS qtd_veiculos
       FROM frota_regioes r
       LEFT JOIN frota_regiao_lojas rl ON rl.id_regiao = r.id_regiao
       LEFT JOIN frota_regiao_tecnicos rt ON rt.id_regiao = r.id_regiao
       LEFT JOIN frota_veiculos v ON v.ativo = TRUE
         AND v.id_usuario_responsavel IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM frota_regiao_tecnicos rtv
           WHERE rtv.id_usuario = v.id_usuario_responsavel
             AND rtv.id_regiao = r.id_regiao
         )
       WHERE r.ativo = TRUE
       GROUP BY r.id_regiao
       ORDER BY r.nome`,
    );
    res.json(rows.map(mapRegiaoRow));
  } catch (e) {
    next(e);
  }
});

router.get('/regioes/catalogo', requirePermRegioes, async (req, res, next) => {
  try {
    const { rows: lojas } = await pool.query(
      `SELECT id_loja, name, bk_number, address, neighborhood, city, state, latitude, longitude
       FROM lojas
       WHERE is_active = TRUE
       ORDER BY name`,
    );
    const { rows: tecnicos } = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, ${SQL_CARGO_USUARIO} AS cargo
       FROM usuarios u
       WHERE u.ativo = TRUE
         AND ${SQL_CARGO_USUARIO} IN ${CARGOS_TECNICO}
       ORDER BY u.nome`,
    );
    const { rows: regionais } = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, ${SQL_CARGO_USUARIO} AS cargo
       FROM usuarios u
       WHERE u.ativo = TRUE
         AND ${SQL_CARGO_USUARIO} IN ${CARGOS_REGIONAL}
       ORDER BY u.nome`,
    );
    const { rows: veiculos } = await pool.query(
      `SELECT v.id_veiculo, v.placa, v.marca, v.modelo, v.ano, v.cor, v.combustivel, v.id_regiao,
              r.nome AS nome_regiao
       FROM frota_veiculos v
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.ativo = TRUE
       ORDER BY v.placa`,
    );
    res.json({ lojas, tecnicos, regionais, veiculos });
  } catch (e) {
    next(e);
  }
});

router.get('/regioes/:id', requirePermRegioes, async (req, res, next) => {
  try {
    const idRegiao = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT r.id_regiao, r.nome, r.descricao, r.ativo, r.id_regional, r.created_at, r.updated_at
       FROM frota_regioes r
       WHERE r.id_regiao = $1 AND r.ativo = TRUE`,
      [idRegiao],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Região não encontrada' });

    const { rows: regionais } = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, ${SQL_CARGO_USUARIO} AS cargo
       FROM frota_regiao_regionais rr
       JOIN usuarios u ON u.id_usuario = rr.id_usuario
       WHERE rr.id_regiao = $1
       ORDER BY u.nome`,
      [idRegiao],
    );

    const { rows: lojas } = await pool.query(
      `SELECT l.id_loja, l.name, l.bk_number, l.address, l.neighborhood, l.city, l.state, l.latitude, l.longitude
       FROM frota_regiao_lojas rl
       JOIN lojas l ON l.id_loja = rl.id_loja
       WHERE rl.id_regiao = $1
       ORDER BY l.name`,
      [idRegiao],
    );

    const { rows: tecnicos } = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, rt.gps_habilitado
       FROM frota_regiao_tecnicos rt
       JOIN usuarios u ON u.id_usuario = rt.id_usuario
       WHERE rt.id_regiao = $1
       ORDER BY u.nome`,
      [idRegiao],
    );

    const { rows: veiculosDb } = await pool.query(SQL_VEICULOS_REGIAO_DETALHE, [idRegiao]);
    const telemetria = await combinarVeiculosComRastreamento(veiculosDb);
    const telemetriaPorId = new Map(telemetria.map((t) => [t.id_veiculo, t]));
    const veiculos = veiculosDb.map((v) => {
      const t = telemetriaPorId.get(v.id_veiculo);
      return {
        ...v,
        odometro_km: t?.odometro_km ?? null,
        combustivel_litros: t?.combustivel_litros ?? null,
        rastreamento_disponivel: t?.rastreamento_disponivel ?? false,
        telemetria_atualizada_em: t?.atualizado_em ?? null,
      };
    });

    res.json({
      ...rows[0],
      regionais,
      nome_regional: regionais[0]?.nome ?? null,
      email_regional: regionais[0]?.email ?? null,
      cargo_regional: regionais[0]?.cargo ?? null,
      lojas,
      tecnicos,
      veiculos,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/regioes/:id/posicoes', requirePermRegioes, async (req, res, next) => {
  try {
    const idRegiao = Number(req.params.id);
    if (!(await usuarioPodeVerRegiaoMapa(req.user, idRegiao))) {
      return res.status(403).json({ error: 'Sem permissão para ver técnicos desta região' });
    }
    const { rows: tecnicos } = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, rt.gps_habilitado,
              p.latitude, p.longitude, p.precisao_metros, p.atualizado_em
       FROM frota_regiao_tecnicos rt
       JOIN usuarios u ON u.id_usuario = rt.id_usuario AND u.ativo = TRUE
       LEFT JOIN frota_tecnico_posicao p ON p.id_usuario = u.id_usuario
       WHERE rt.id_regiao = $1
       ORDER BY u.nome`,
      [idRegiao],
    );

    const { rows: veiculosDb } = await pool.query(SQL_VEICULOS_REGIAO_DETALHE, [idRegiao]);

    let veiculos = await combinarVeiculosComRastreamento(veiculosDb);

    res.json({
      tecnicos,
      veiculos,
      rastreamento_ativo: fulltrackRastreamentoAtivo(),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/rastreamento/telemetria', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id_veiculo, placa, marca, modelo
       FROM frota_veiculos
       WHERE ativo = TRUE
       ORDER BY placa`,
    );
    const veiculos = await combinarVeiculosComRastreamento(rows);
    const statusFt = fulltrackStatus();
    res.json({
      veiculos: veiculos.map((v) => ({
        id_veiculo: v.id_veiculo,
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        odometro_km: v.odometro_km ?? null,
        combustivel_litros: v.combustivel_litros ?? null,
        rastreamento_disponivel: v.rastreamento_disponivel ?? false,
        atualizado_em: v.atualizado_em ?? null,
      })),
      rastreamento_ativo: statusFt.ativo,
      fulltrack: statusFt,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/rastreamento/veiculos/:id/rota-dia', requirePermMapaTecnicos, async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const dataInicioRaw = String(req.query.data_inicio || req.query.data || '').trim();
    const dataFimRaw = String(req.query.data_fim || req.query.data || dataInicioRaw).trim();
    if (!Number.isFinite(idVeiculo) || idVeiculo <= 0) {
      return res.status(400).json({ error: 'Veículo inválido' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicioRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFimRaw)) {
      return res.status(400).json({ error: 'Informe as datas no formato AAAA-MM-DD' });
    }
    const dataInicio = dataInicioRaw <= dataFimRaw ? dataInicioRaw : dataFimRaw;
    const dataFim = dataInicioRaw <= dataFimRaw ? dataFimRaw : dataInicioRaw;

    const { rows } = await pool.query(
      `SELECT v.id_veiculo, v.placa, v.marca, v.modelo, v.id_regiao, r.nome AS nome_regiao
       FROM frota_veiculos v
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.id_veiculo = $1 AND v.ativo = TRUE`,
      [idVeiculo],
    );
    const veiculo = rows[0];
    if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });

    if (veiculo.id_regiao != null && !(await usuarioPodeVerRegiaoMapa(req.user, veiculo.id_regiao))) {
      return res.status(403).json({ error: 'Sem permissão para ver este veículo' });
    }

    const [comRastreamento] = await combinarVeiculosComRastreamento([veiculo]);
    if (!comRastreamento?.id_rastreamento) {
      return res.json({
        veiculo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        limite_kmh: limiteVelocidadeKmh(),
        qtd_excessos: 0,
        pontos: [],
        rotas: [],
        km_gps: 0,
        km_odometro: null,
        combustivel_litros: null,
        total_pontos: 0,
        rastreamento_ativo: fulltrackRastreamentoAtivo(),
      });
    }

    const relatorio = await relatorioRotaVeiculoPeriodo(
      comRastreamento.id_rastreamento,
      dataInicio,
      dataFim,
    );
    const assuncoes = await listarAssuncoesVeiculoPeriodo(pool, idVeiculo, dataInicio, dataFim);
    const rotas = enriquecerRotasComTecnicoExcesso(relatorio.rotas, relatorio.limite_kmh, assuncoes);
    res.json({
      veiculo,
      ...relatorio,
      rotas,
      rastreamento_ativo: fulltrackRastreamentoAtivo(),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/rastreamento/veiculos/:id/velocidade', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const dataInicioRaw = String(req.query.data_inicio || '').trim();
    const dataFimRaw = String(req.query.data_fim || dataInicioRaw).trim();
    if (!Number.isFinite(idVeiculo) || idVeiculo <= 0) {
      return res.status(400).json({ error: 'Veículo inválido' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicioRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFimRaw)) {
      return res.status(400).json({ error: 'Informe as datas no formato AAAA-MM-DD' });
    }
    const dataInicio = dataInicioRaw <= dataFimRaw ? dataInicioRaw : dataFimRaw;
    const dataFim = dataInicioRaw <= dataFimRaw ? dataFimRaw : dataInicioRaw;

    const { rows } = await pool.query(
      `SELECT id_veiculo, placa, marca, modelo
       FROM frota_veiculos WHERE id_veiculo = $1 AND ativo = TRUE`,
      [idVeiculo],
    );
    const veiculo = rows[0];
    if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });

    const [comRastreamento] = await combinarVeiculosComRastreamento([veiculo]);
    if (!comRastreamento?.id_rastreamento) {
      return res.json({
        veiculo,
        data_inicio: dataInicio,
        data_fim: dataFim,
        limite_kmh: limiteVelocidadeKmh(),
        velocidade_media: 0,
        velocidade_maxima: 0,
        total_pontos: 0,
        qtd_excessos: 0,
        qtd_normais: 0,
        qtd_parados: 0,
        tempo_parado_ms: 0,
        excessos: [],
        registros: [],
        km_gps: 0,
        rastreamento_ativo: fulltrackRastreamentoAtivo(),
      });
    }

    const relatorio = await relatorioVelocidadeVeiculoPeriodo(
      comRastreamento.id_rastreamento,
      dataInicio,
      dataFim,
    );
    const assuncoes = await listarAssuncoesVeiculoPeriodo(pool, idVeiculo, dataInicio, dataFim);
    const excessos = enriquecerRegistrosVelocidade(relatorio.excessos, assuncoes);
    res.set('Cache-Control', 'no-store');
    res.json({
      veiculo,
      ...relatorio,
      registros: [],
      excessos,
      rastreamento_ativo: fulltrackRastreamentoAtivo(),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/rastreamento/ajustar-rota', requirePermissao('frota.gerenciar', 'frota.mapa.ver'), async (req, res, next) => {
  try {
    const coords = Array.isArray(req.body?.coords) ? req.body.coords : [];
    const ajustadas = await ajustarRotaAsRuas(coords);
    res.json({ coords: ajustadas });
  } catch (e) {
    next(e);
  }
});

router.get('/rastreamento/relatorio-km-confronto', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const dataInicio = String(req.query.data_inicio || '').trim();
    const dataFim = String(req.query.data_fim || dataInicio).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
      return res.status(400).json({ error: 'Informe as datas no formato AAAA-MM-DD' });
    }

    const { rows: veiculosDb } = await pool.query(
      `SELECT id_veiculo, placa, marca, modelo FROM frota_veiculos WHERE ativo = TRUE ORDER BY placa`,
    );
    const telemetria = await combinarVeiculosComRastreamento(veiculosDb);

    const { rows: assuncoes } = await pool.query(
      `SELECT a.id_veiculo, v.placa, a.km_inicio, a.km_fim, a.data_inicio, a.data_fim
       FROM frota_assuncoes a
       JOIN frota_veiculos v ON v.id_veiculo = a.id_veiculo
       WHERE a.data_inicio::date <= $2::date
         AND COALESCE(a.data_fim, NOW())::date >= $1::date`,
      [dataInicio, dataFim],
    );

    const kmManualPorVeiculo = new Map();
    for (const a of assuncoes) {
      if (a.km_inicio == null) continue;
      const kmFim = a.km_fim ?? a.km_inicio;
      const diff = Number(kmFim) - Number(a.km_inicio);
      if (diff < 0) continue;
      const atual = kmManualPorVeiculo.get(a.id_veiculo) || {
        id_veiculo: a.id_veiculo,
        placa: a.placa,
        km_percorrido: 0,
        registros: 0,
      };
      atual.km_percorrido += diff;
      atual.registros += 1;
      kmManualPorVeiculo.set(a.id_veiculo, atual);
    }

    const rastreador = [];
    for (const v of telemetria) {
      if (!v.id_rastreamento) {
        rastreador.push({
          id_veiculo: v.id_veiculo,
          placa: v.placa,
          km_gps: null,
          km_odometro: null,
        });
        continue;
      }
      const km = await kmRastreadorVeiculoPeriodo(v.id_rastreamento, dataInicio, dataFim);
      rastreador.push({
        id_veiculo: v.id_veiculo,
        placa: v.placa,
        km_gps: km.km_gps,
        km_odometro: km.km_odometro,
      });
    }

    const manual = [...kmManualPorVeiculo.values()].map((m) => ({
      ...m,
      km_percorrido: Math.round(m.km_percorrido * 10) / 10,
    }));

    const confronto = veiculosDb.map((v) => {
      const m = manual.find((x) => x.id_veiculo === v.id_veiculo);
      const r = rastreador.find((x) => x.id_veiculo === v.id_veiculo);
      const kmManual = m?.km_percorrido ?? null;
      const kmRastreador = r?.km_odometro ?? r?.km_gps ?? null;
      const diferenca =
        kmManual != null && kmRastreador != null
          ? Math.round((kmRastreador - kmManual) * 10) / 10
          : null;
      return {
        id_veiculo: v.id_veiculo,
        placa: v.placa,
        veiculo: [v.marca, v.modelo].filter(Boolean).join(' ') || '—',
        km_manual: kmManual,
        km_rastreador: kmRastreador,
        diferenca,
      };
    }).filter((c) => c.km_manual != null || c.km_rastreador != null);

    res.json({
      data_inicio: dataInicio,
      data_fim: dataFim,
      manual,
      rastreador,
      confronto,
      rastreamento_ativo: fulltrackRastreamentoAtivo(),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/rastreamento/veiculos/:id/historico', requirePermMapaTecnicos, async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    if (!Number.isFinite(idVeiculo) || idVeiculo <= 0) {
      return res.status(400).json({ error: 'Veículo inválido' });
    }

    const { rows } = await pool.query(
      `SELECT v.id_veiculo, v.placa, v.id_regiao
       FROM frota_veiculos v
       WHERE v.id_veiculo = $1 AND v.ativo = TRUE`,
      [idVeiculo],
    );
    const veiculo = rows[0];
    if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });

    if (veiculo.id_regiao != null && !(await usuarioPodeVerRegiaoMapa(req.user, veiculo.id_regiao))) {
      return res.status(403).json({ error: 'Sem permissão para ver este veículo' });
    }

    const [comRastreamento] = await combinarVeiculosComRastreamento([veiculo]);
    if (!comRastreamento?.id_rastreamento) {
      return res.json({ pontos: [], rastreamento_ativo: fulltrackRastreamentoAtivo() });
    }

    const inicio = req.query.inicio != null ? Number(req.query.inicio) : null;
    const fim = req.query.fim != null ? Number(req.query.fim) : null;
    const pontos = await historicoVeiculoFulltrack(comRastreamento.id_rastreamento, inicio, fim);

    res.json({
      pontos,
      rastreamento_ativo: fulltrackRastreamentoAtivo(),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/regioes', requirePermRegioes, async (req, res, next) => {
  try {
    const { nome, descricao } = req.body || {};
    if (!nome?.trim()) return res.status(400).json({ error: 'Informe o nome da região' });
    const { rows } = await pool.query(
      `INSERT INTO frota_regioes (nome, descricao) VALUES ($1, $2) RETURNING *`,
      [nome.trim(), descricao?.trim() || null],
    );
    await auditar(req, {
      modulo: 'frota',
      acao: 'criar',
      entidade: 'regiao',
      idReferencia: rows[0].id_regiao,
      descricao: `Região criada: ${rows[0].nome}`,
    });
    res.status(201).json(mapRegiaoRow(rows[0]));
  } catch (e) {
    if (erroRegiaoDb(e, res)) return;
    next(e);
  }
});

router.patch('/regioes/:id', requirePermRegioes, async (req, res, next) => {
  try {
    const idRegiao = Number(req.params.id);
    const { nome, descricao, id_lojas, id_usuarios, id_regionais, id_regional, tecnicos: tecnicosBody } =
      req.body || {};
    const sets = ['updated_at = NOW()'];
    const vals = [idRegiao];
    let i = 2;

    if (nome?.trim()) {
      sets.push(`nome = $${i++}`);
      vals.push(nome.trim());
    }
    if (descricao != null) {
      sets.push(`descricao = $${i++}`);
      vals.push(descricao.trim() || null);
    }
    if ('id_regional' in (req.body || {}) && !Array.isArray(id_regionais)) {
      sets.push(`id_regional = $${i++}`);
      vals.push(id_regional != null && id_regional !== '' ? Number(id_regional) : null);
    }

    const { rows } = await pool.query(
      `UPDATE frota_regioes
       SET ${sets.join(', ')}
       WHERE id_regiao = $1 AND ativo = TRUE
       RETURNING *`,
      vals,
    );
    if (!rows[0]) return res.status(404).json({ error: 'Região não encontrada' });

    if (Array.isArray(id_regionais)) {
      await syncRegiaoRegionais(idRegiao, id_regionais);
    } else if ('id_regional' in (req.body || {})) {
      await syncRegiaoRegionais(
        idRegiao,
        id_regional != null && id_regional !== '' ? [Number(id_regional)] : [],
      );
    }

    if (Array.isArray(id_lojas)) await syncRegiaoLojas(idRegiao, id_lojas);
    if (Array.isArray(tecnicosBody)) {
      await syncRegiaoTecnicos(idRegiao, tecnicosBody);
    } else if (Array.isArray(id_usuarios)) {
      await syncRegiaoTecnicos(
        idRegiao,
        id_usuarios.map((id) => ({ id_usuario: id, gps_habilitado: true })),
      );
    }

    await auditar(req, {
      modulo: 'frota',
      acao: 'atualizar',
      entidade: 'regiao',
      idReferencia: idRegiao,
      descricao: `Região atualizada: ${rows[0].nome}`,
      detalhes: {
        regionais: Array.isArray(id_regionais) ? id_regionais : undefined,
        lojas: Array.isArray(id_lojas) ? id_lojas : undefined,
        tecnicos: Array.isArray(tecnicosBody)
          ? tecnicosBody
          : Array.isArray(id_usuarios)
            ? id_usuarios
            : undefined,
      },
    });

    const { rows: regionaisAtual } = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email
       FROM frota_regiao_regionais rr
       JOIN usuarios u ON u.id_usuario = rr.id_usuario
       WHERE rr.id_regiao = $1
       ORDER BY u.nome`,
      [idRegiao],
    );

    res.json(
      mapRegiaoRow({
        ...rows[0],
        regionais: regionaisAtual,
        qtd_lojas: undefined,
        qtd_tecnicos: undefined,
        qtd_veiculos: undefined,
      }),
    );
  } catch (e) {
    if (erroRegiaoDb(e, res)) return;
    next(e);
  }
});

router.post('/veiculos', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const { placa, renavam, chassi, marca, modelo, ano, cor, combustivel, km_atual, km_inicial, observacoes, id_regiao } =
      req.body || {};
    if (!placa?.trim()) return res.status(400).json({ error: 'Informe a placa' });
    const kmIni =
      km_inicial != null
        ? Number(km_inicial)
        : km_atual != null
          ? Number(km_atual)
          : null;
    const { rows } = await pool.query(
      `INSERT INTO frota_veiculos (placa, renavam, chassi, marca, modelo, ano, cor, combustivel, km_inicial, km_atual, observacoes, id_regiao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11)
       RETURNING *`,
      [
        placa.trim().toUpperCase(),
        renavam?.replace(/\D/g, '') || null,
        chassi?.trim()?.toUpperCase() || null,
        marca || null,
        modelo || null,
        ano || null,
        cor || null,
        combustivel || null,
        kmIni != null && Number.isFinite(kmIni) ? kmIni : null,
        observacoes || null,
        id_regiao != null && id_regiao !== '' ? Number(id_regiao) : null,
      ],
    );
    await auditar(req, {
      idUsuario: req.user.sub,
      modulo: 'frota',
      acao: 'criar',
      entidade: 'veiculo',
      idReferencia: rows[0].id_veiculo,
      descricao: `Veículo cadastrado: ${rows[0].placa}`,
    });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Placa já cadastrada' });
    next(e);
  }
});

router.get('/veiculos/:id', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT ${COLS_VEICULO}
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Veículo não encontrado' });
    await sincronizarKmAtualVeiculo(idVeiculo);
    const { rows: atualizado } = await pool.query(
      `SELECT ${COLS_VEICULO}
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );
    res.json(enriquecerKmVeiculo(atualizado[0]));
  } catch (e) {
    next(e);
  }
});

router.patch('/veiculos/:id', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const { placa, renavam, chassi, marca, modelo, ano, cor, combustivel, km_atual, km_inicial, observacoes, id_regiao } =
      req.body || {};
    const kmIniBody =
      km_inicial != null
        ? Number(km_inicial)
        : km_atual != null
          ? Number(km_atual)
          : null;
    const { rows } = await pool.query(
      `UPDATE frota_veiculos
       SET placa = COALESCE($2, placa),
           renavam = COALESCE($3, renavam),
           chassi = COALESCE($4, chassi),
           marca = COALESCE($5, marca),
           modelo = COALESCE($6, modelo),
           ano = COALESCE($7, ano),
           cor = COALESCE($8, cor),
           combustivel = COALESCE($9, combustivel),
           km_inicial = COALESCE($10, km_inicial),
           observacoes = COALESCE($11, observacoes),
           id_regiao = CASE WHEN $12 THEN $13 ELSE id_regiao END,
           updated_at = NOW()
       WHERE id_veiculo = $1 AND ativo = TRUE
       RETURNING *`,
      [
        idVeiculo,
        placa?.trim() ? placa.trim().toUpperCase() : null,
        renavam != null ? (renavam.replace(/\D/g, '') || null) : null,
        chassi != null ? (chassi.trim().toUpperCase() || null) : null,
        marca ?? null,
        modelo ?? null,
        ano ?? null,
        cor ?? null,
        combustivel ?? null,
        kmIniBody != null && Number.isFinite(kmIniBody) ? kmIniBody : null,
        observacoes ?? null,
        Object.prototype.hasOwnProperty.call(req.body || {}, 'id_regiao'),
        id_regiao != null && id_regiao !== '' ? Number(id_regiao) : null,
      ],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Veículo não encontrado' });
    await sincronizarKmAtualVeiculo(idVeiculo);
    const { rows: full } = await pool.query(
      `SELECT ${COLS_VEICULO}
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );
    await auditar(req, {
      idUsuario: req.user.sub,
      modulo: 'frota',
      acao: 'atualizar',
      entidade: 'veiculo',
      idReferencia: idVeiculo,
      descricao: `Veículo atualizado: ${full[0]?.placa || idVeiculo}`,
    });
    res.json(full[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Placa já cadastrada' });
    next(e);
  }
});

router.delete('/veiculos/:id', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const { rows } = await pool.query(
      `UPDATE frota_veiculos
       SET ativo = FALSE, id_usuario_responsavel = NULL, assuncao_em = NULL, updated_at = NOW()
       WHERE id_veiculo = $1 AND ativo = TRUE
       RETURNING placa`,
      [idVeiculo],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Veículo não encontrado' });
    await auditar(req, {
      idUsuario: req.user.sub,
      modulo: 'frota',
      acao: 'excluir',
      entidade: 'veiculo',
      idReferencia: idVeiculo,
      descricao: `Veículo excluído: ${rows[0].placa}`,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** Atribuição manual pelo portal (sem CNH/fotos do app). */
router.post('/veiculos/:id/atribuir', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const idUsuario = Number(req.body?.id_usuario);
    const kmRaw = req.body?.km_atual;
    if (!idVeiculo) return res.status(400).json({ error: 'Veículo inválido' });
    if (!Number.isFinite(idUsuario) || idUsuario <= 0) {
      return res.status(400).json({ error: 'Selecione o responsável' });
    }

    const { rows: veiculos } = await pool.query(
      `SELECT id_veiculo, id_usuario_responsavel, placa, km_inicial, km_atual
       FROM frota_veiculos WHERE id_veiculo = $1 AND ativo = TRUE`,
      [idVeiculo],
    );
    const veiculo = veiculos[0];
    if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });

    const { rows: usuarios } = await pool.query(
      `SELECT id_usuario, nome FROM usuarios WHERE id_usuario = $1 AND ativo = TRUE`,
      [idUsuario],
    );
    if (!usuarios[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

    let kmEfetivo = null;
    if (kmRaw != null && String(kmRaw).trim() !== '') {
      const kmNum = Number(String(kmRaw).replace(/\D/g, ''));
      if (!Number.isFinite(kmNum) || kmNum < 0) {
        return res.status(400).json({ error: 'Informe a quilometragem válida' });
      }
      kmEfetivo = resolverKmOdometro(kmNum, kmBaseVeiculo(veiculo));
      if (kmEfetivo == null) return res.status(400).json({ error: 'Informe a quilometragem válida' });
    } else {
      kmEfetivo = Number(veiculo.km_atual) || Number(veiculo.km_inicial) || 0;
    }

    const idRegiaoTecnico = await regiaoDoTecnico(idUsuario);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (veiculo.id_usuario_responsavel) {
        await client.query(
          `UPDATE frota_assuncoes
           SET data_fim = NOW(), km_fim = $2
           WHERE id_veiculo = $1 AND data_fim IS NULL`,
          [idVeiculo, kmEfetivo],
        );
      }

      await client.query(
        `UPDATE frota_veiculos SET id_usuario_responsavel = NULL, assuncao_em = NULL, id_regiao = NULL
         WHERE id_usuario_responsavel = $1 AND id_veiculo != $2`,
        [idUsuario, idVeiculo],
      );

      await client.query(
        `UPDATE frota_veiculos
         SET id_usuario_responsavel = $1, assuncao_em = NOW(), km_atual = $3, id_regiao = $4, updated_at = NOW()
         WHERE id_veiculo = $2`,
        [idUsuario, idVeiculo, kmEfetivo, idRegiaoTecnico],
      );

      await client.query(
        `INSERT INTO frota_assuncoes (id_veiculo, id_usuario, km_inicio)
         VALUES ($1, $2, $3)`,
        [idVeiculo, idUsuario, kmEfetivo],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await sincronizarKmAtualVeiculo(idVeiculo);
    const { rows: full } = await pool.query(
      `SELECT ${COLS_VEICULO}
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );

    await auditar(req, {
      idUsuario: req.user.sub,
      modulo: 'frota',
      acao: 'atribuir_veiculo',
      entidade: 'veiculo',
      idReferencia: idVeiculo,
      descricao: `Atribuiu ${veiculo.placa} para ${usuarios[0].nome}`,
    });
    res.json(full[0]);
  } catch (e) {
    next(e);
  }
});

/**
 * Corrige o KM da atribuição ativa (odômetro no início do uso / instalação GPS).
 * Body: { km_atribuicao: number, km_atual?: number }
 */
router.patch('/veiculos/:id/km-atribuicao', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const kmAtribRaw = req.body?.km_atribuicao ?? req.body?.km_inicio;
    const kmAtualRaw = req.body?.km_atual;

    if (!idVeiculo) return res.status(400).json({ error: 'Veículo inválido' });
    const kmAtrib = Number(String(kmAtribRaw ?? '').replace(/\D/g, ''));
    if (!Number.isFinite(kmAtrib) || kmAtrib < 0) {
      return res.status(400).json({ error: 'Informe o KM da atribuição' });
    }

    const { rows: veiculos } = await pool.query(
      `SELECT id_veiculo, id_usuario_responsavel, placa, km_inicial, km_atual
       FROM frota_veiculos WHERE id_veiculo = $1 AND ativo = TRUE`,
      [idVeiculo],
    );
    const veiculo = veiculos[0];
    if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });
    if (!veiculo.id_usuario_responsavel) {
      return res.status(400).json({ error: 'Veículo sem atribuição ativa — atribua alguém antes' });
    }

    const { rows: assuncao } = await pool.query(
      `SELECT id_assuncao, km_inicio
       FROM frota_assuncoes
       WHERE id_veiculo = $1 AND data_fim IS NULL
       ORDER BY data_inicio DESC
       LIMIT 1`,
      [idVeiculo],
    );
    if (!assuncao[0]) {
      return res.status(400).json({ error: 'Nenhuma atribuição aberta encontrada' });
    }

    let kmAtual = Number(veiculo.km_atual) || kmAtrib;
    if (kmAtualRaw != null && String(kmAtualRaw).trim() !== '') {
      const n = Number(String(kmAtualRaw).replace(/\D/g, ''));
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ error: 'KM atual inválido' });
      }
      kmAtual = n;
    }
    kmAtual = Math.max(kmAtual, kmAtrib);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE frota_assuncoes SET km_inicio = $1 WHERE id_assuncao = $2`, [
        kmAtrib,
        assuncao[0].id_assuncao,
      ]);
      await client.query(
        `UPDATE frota_veiculos
         SET km_inicial = $2, km_atual = $3, updated_at = NOW()
         WHERE id_veiculo = $1`,
        [idVeiculo, kmAtrib, kmAtual],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    try {
      await sincronizarKmAtualComGpsDesdeAssuncao();
    } catch {
      /* ok */
    }

    const { rows: full } = await pool.query(
      `SELECT ${COLS_VEICULO},
              (
                SELECT a.km_inicio
                FROM frota_assuncoes a
                WHERE a.id_veiculo = v.id_veiculo AND a.data_fim IS NULL
                ORDER BY a.data_inicio DESC
                LIMIT 1
              ) AS km_assuncao
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );

    await auditar(req, {
      idUsuario: req.user.sub,
      modulo: 'frota',
      acao: 'editar_km_atribuicao',
      entidade: 'veiculo',
      idReferencia: idVeiculo,
      descricao: `Ajustou KM atribuição de ${veiculo.placa}: ${assuncao[0].km_inicio ?? '—'} → ${kmAtrib}`,
    });

    res.json(enriquecerKmVeiculo(full[0]));
  } catch (e) {
    next(e);
  }
});

/** Define o KM da próxima manutenção no cadastro do veículo. */
router.patch('/veiculos/:id/proxima-manutencao', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const kmRaw = req.body?.proxima_manutencao_km;
    if (!idVeiculo) return res.status(400).json({ error: 'Veículo inválido' });
    const kmProx = Number(String(kmRaw ?? '').replace(/\D/g, ''));
    if (!Number.isFinite(kmProx) || kmProx <= 0) {
      return res.status(400).json({ error: 'Informe o KM da próxima manutenção' });
    }

    const { rows } = await pool.query(
      `UPDATE frota_veiculos
       SET proxima_manutencao_km = $2, updated_at = NOW()
       WHERE id_veiculo = $1 AND ativo = TRUE
       RETURNING placa`,
      [idVeiculo, Math.round(kmProx)],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Veículo não encontrado' });

    const { rows: full } = await pool.query(
      `SELECT ${COLS_VEICULO},
              (
                SELECT a.km_inicio
                FROM frota_assuncoes a
                WHERE a.id_veiculo = v.id_veiculo AND a.data_fim IS NULL
                ORDER BY a.data_inicio DESC
                LIMIT 1
              ) AS km_assuncao
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );

    await auditar(req, {
      idUsuario: req.user.sub,
      modulo: 'frota',
      acao: 'editar_proxima_manutencao',
      entidade: 'veiculo',
      idReferencia: idVeiculo,
      descricao: `Definiu próxima manutenção de ${rows[0].placa} para ${kmProx} km`,
    });

    res.json(enriquecerKmVeiculo(full[0]));
  } catch (e) {
    next(e);
  }
});

/** Liberação manual pelo portal. */
router.post('/veiculos/:id/devolver', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const kmRaw = req.body?.km_atual;

    const { rows: veiculos } = await pool.query(
      `SELECT id_veiculo, id_usuario_responsavel, placa, km_inicial, km_atual
       FROM frota_veiculos WHERE id_veiculo = $1 AND ativo = TRUE`,
      [idVeiculo],
    );
    const veiculo = veiculos[0];
    if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });
    if (!veiculo.id_usuario_responsavel) {
      return res.status(400).json({ error: 'Veículo já está livre' });
    }

    let kmEfetivo = Number(veiculo.km_atual) || Number(veiculo.km_inicial) || 0;
    if (kmRaw != null && String(kmRaw).trim() !== '') {
      const kmNum = Number(String(kmRaw).replace(/\D/g, ''));
      if (!Number.isFinite(kmNum) || kmNum < 0) {
        return res.status(400).json({ error: 'Informe a quilometragem válida' });
      }
      const resolvido = resolverKmOdometro(kmNum, kmBaseVeiculo(veiculo));
      if (resolvido == null) return res.status(400).json({ error: 'Informe a quilometragem válida' });
      kmEfetivo = resolvido;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE frota_assuncoes
         SET data_fim = NOW(), km_fim = $2
         WHERE id_veiculo = $1 AND data_fim IS NULL`,
        [idVeiculo, kmEfetivo],
      );
      await client.query(
        `UPDATE frota_veiculos
         SET id_usuario_responsavel = NULL, assuncao_em = NULL, km_atual = $2, id_regiao = NULL, updated_at = NOW()
         WHERE id_veiculo = $1`,
        [idVeiculo, kmEfetivo],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await sincronizarKmAtualVeiculo(idVeiculo);
    const { rows: full } = await pool.query(
      `SELECT ${COLS_VEICULO}
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       LEFT JOIN frota_regioes r ON r.id_regiao = v.id_regiao
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );

    await auditar(req, {
      idUsuario: req.user.sub,
      modulo: 'frota',
      acao: 'devolver_veiculo_portal',
      entidade: 'veiculo',
      idReferencia: idVeiculo,
      descricao: `Liberou o veículo ${veiculo.placa} (KM ${kmEfetivo})`,
    });
    res.json(full[0]);
  } catch (e) {
    next(e);
  }
});

router.post(
  '/me/assumir',
  requirePermissao('frota.usar'),
  upload.fields([
    { name: 'cnh', maxCount: 1 },
    { name: 'fotos_veiculo', maxCount: 10 },
  ]),
  async (req, res, next) => {
    try {
      const idUsuario = req.user.sub;
      const idVeiculo = Number(req.body?.id_veiculo);
      const kmAtual = Number(String(req.body?.km_atual ?? '').replace(/\D/g, ''));
      const cnhFile = req.files?.cnh?.[0];
      const fotosVeiculo = req.files?.fotos_veiculo || [];
      if (!idVeiculo) return res.status(400).json({ error: 'Selecione o veículo' });
      if (!Number.isFinite(kmAtual) || kmAtual < 0) {
        return res.status(400).json({ error: 'Informe a quilometragem atual' });
      }
      if (!cnhFile) return res.status(400).json({ error: 'Envie a foto da CNH' });
      if (!fotosVeiculo.length) return res.status(400).json({ error: 'Envie ao menos uma foto do veículo' });

      const { rows: veiculos } = await pool.query(
        `SELECT id_veiculo, id_usuario_responsavel, placa, km_inicial, km_atual
         FROM frota_veiculos WHERE id_veiculo = $1 AND ativo = TRUE`,
        [idVeiculo],
      );
      const veiculo = veiculos[0];
      if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });
      if (veiculo.id_usuario_responsavel && veiculo.id_usuario_responsavel !== idUsuario) {
        return res.status(409).json({ error: 'Veículo já está sob responsabilidade de outro colaborador' });
      }

      const kmEfetivo = resolverKmOdometro(kmAtual, kmBaseVeiculo(veiculo));
      if (kmEfetivo == null) {
        return res.status(400).json({ error: 'Informe a quilometragem atual' });
      }

      const idRegiaoTecnico = await regiaoDoTecnico(idUsuario);

      const client = await pool.connect();
      let idAssuncao;
      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE frota_assuncoes SET data_fim = NOW()
           WHERE id_veiculo = $1 AND id_usuario = $2 AND data_fim IS NULL`,
          [idVeiculo, idUsuario],
        );

        await client.query(
          `UPDATE frota_veiculos SET id_usuario_responsavel = NULL, assuncao_em = NULL, id_regiao = NULL
           WHERE id_usuario_responsavel = $1 AND id_veiculo != $2`,
          [idUsuario, idVeiculo],
        );

        await client.query(
          `UPDATE frota_veiculos
           SET id_usuario_responsavel = $1, assuncao_em = NOW(), km_atual = $3, id_regiao = $4, updated_at = NOW()
           WHERE id_veiculo = $2`,
          [idUsuario, idVeiculo, kmEfetivo, idRegiaoTecnico],
        );

        const { rows: assRows } = await client.query(
          `INSERT INTO frota_assuncoes (id_veiculo, id_usuario, km_inicio)
           VALUES ($1, $2, $3)
           RETURNING id_assuncao`,
          [idVeiculo, idUsuario, kmEfetivo],
        );
        idAssuncao = assRows[0].id_assuncao;

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      await sincronizarKmAtualVeiculo(idVeiculo);

      await salvarAnexo({
        contexto: 'assuncao_cnh',
        idReferencia: idAssuncao,
        idUsuario,
        file: cnhFile,
        nome: 'cnh',
      });

      for (let i = 0; i < fotosVeiculo.length; i++) {
        await salvarAnexo({
          contexto: 'assuncao_veiculo',
          idReferencia: idAssuncao,
          idUsuario,
          file: fotosVeiculo[i],
          nome: `veiculo_${i + 1}`,
        });
      }

      const atualizado = await veiculoDoUsuario(idUsuario);
      await auditar(req, {
        idUsuario,
        modulo: 'frota',
        acao: 'assumir_veiculo',
        entidade: 'veiculo',
        idReferencia: idVeiculo,
        descricao: `Assumiu o veículo ${veiculo.placa}`,
      });
      res.json({ ok: true, veiculo: mapVeiculo(atualizado) });
    } catch (e) {
      next(e);
    }
  },
);

router.post('/me/desassumir', requirePermissao('frota.usar'), async (req, res, next) => {
  try {
    const idUsuario = req.user.sub;
    const kmAtual = Number(String(req.body?.km_atual ?? '').replace(/\D/g, ''));
    const veiculo = await veiculoDoUsuario(idUsuario);
    if (!veiculo) {
      return res.status(400).json({ error: 'Você não tem veículo sob seu controle' });
    }
    if (!Number.isFinite(kmAtual) || kmAtual < 0) {
      return res.status(400).json({ error: 'Informe a quilometragem atual do veículo' });
    }

    const kmEfetivo = resolverKmOdometro(kmAtual, kmBaseVeiculo(veiculo));
    if (kmEfetivo == null) {
      return res.status(400).json({ error: 'Informe a quilometragem atual do veículo' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE frota_assuncoes
         SET data_fim = NOW(), km_fim = $3
         WHERE id_veiculo = $1 AND id_usuario = $2 AND data_fim IS NULL`,
        [veiculo.id_veiculo, idUsuario, kmEfetivo],
      );
      await client.query(
        `UPDATE frota_veiculos
         SET id_usuario_responsavel = NULL, assuncao_em = NULL, km_atual = $3, id_regiao = NULL, updated_at = NOW()
         WHERE id_veiculo = $1 AND id_usuario_responsavel = $2`,
        [veiculo.id_veiculo, idUsuario, kmEfetivo],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await sincronizarKmAtualVeiculo(veiculo.id_veiculo);

    await auditar(req, {
      idUsuario,
      modulo: 'frota',
      acao: 'devolver_veiculo',
      entidade: 'veiculo',
      idReferencia: veiculo.id_veiculo,
      descricao: `Devolveu o veículo ${veiculo.placa} (KM ${kmEfetivo})`,
    });
    res.json({ ok: true, veiculo: null });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/abastecimentos',
  requirePermissao('frota.usar'),
  upload.single('comprovante'),
  async (req, res, next) => {
    try {
      const idUsuario = req.user.sub;
      const kmAtual = Number(req.body?.km_atual);
      const valor = Number(String(req.body?.valor_abastecido || '').replace(',', '.'));
      if (!Number.isFinite(kmAtual) || kmAtual < 0) {
        return res.status(400).json({ error: 'Informe o KM atual válido' });
      }
      if (!Number.isFinite(valor) || valor <= 0) {
        return res.status(400).json({ error: 'Informe o valor abastecido' });
      }
      if (!req.file) return res.status(400).json({ error: 'Envie a foto do comprovante' });

      const veiculo = await veiculoDoUsuario(idUsuario);
      if (!veiculo) {
        return res.status(400).json({ error: 'Assuma o controle de um veículo antes de registrar abastecimento' });
      }

      const kmEfetivo = resolverKmOdometro(kmAtual, kmBaseVeiculo(veiculo));
      if (kmEfetivo == null) {
        return res.status(400).json({ error: 'Informe o KM atual válido' });
      }

      const { rows } = await pool.query(
        `INSERT INTO frota_abastecimentos (id_veiculo, id_usuario, km_atual, valor_abastecido)
         VALUES ($1, $2, $3, $4)
         RETURNING id_abastecimento`,
        [veiculo.id_veiculo, idUsuario, kmEfetivo, valor],
      );
      const idAbastecimento = rows[0].id_abastecimento;

      const anexo = await salvarAnexo({
        contexto: 'abastecimento',
        idReferencia: idAbastecimento,
        idUsuario,
        file: req.file,
        nome: 'comprovante_abastecimento',
      });

      await pool.query(
        `UPDATE frota_abastecimentos SET id_anexo_comprovante = $1 WHERE id_abastecimento = $2`,
        [anexo.id_anexo, idAbastecimento],
      );
      await sincronizarKmAtualVeiculo(veiculo.id_veiculo);

      res.status(201).json({
        id_abastecimento: idAbastecimento,
        km_atual: kmEfetivo,
        valor_abastecido: valor,
        comprovante_url: midiaUrlFrota(anexo.id_anexo),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get('/termo', requirePermissao('frota.usar'), async (req, res, next) => {
  try {
    const idUsuario = req.user.sub;
    const { rows: u } = await pool.query('SELECT nome FROM usuarios WHERE id_usuario = $1', [idUsuario]);
    const nome = u[0]?.nome || 'Colaborador';

    const { rows: termoRows } = await pool.query(
      `SELECT id_termo, assinado_em FROM frota_termos_ferramentas
       WHERE id_usuario = $1 AND termo_versao = $2 ORDER BY assinado_em DESC LIMIT 1`,
      [idUsuario, TERMO_FERRAMENTAS_VERSAO],
    );

    res.json({
      versao: TERMO_FERRAMENTAS_VERSAO,
      empresa: EMPRESA_TERMO,
      texto: textoTermoFerramentas(nome),
      assinado: termoRows.length > 0,
      assinado_em: termoRows[0]?.assinado_em || null,
    });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/termo',
  requirePermissao('frota.usar'),
  upload.fields([
    { name: 'assinatura', maxCount: 1 },
    { name: 'fotos', maxCount: 10 },
  ]),
  async (req, res, next) => {
    try {
      const idUsuario = req.user.sub;
      const assinaturaFile = req.files?.assinatura?.[0];
      const fotosFiles = req.files?.fotos || [];
      if (!assinaturaFile) return res.status(400).json({ error: 'Assinatura digital obrigatória' });

      const { rows: existente } = await pool.query(
        `SELECT id_termo FROM frota_termos_ferramentas
         WHERE id_usuario = $1 AND termo_versao = $2 LIMIT 1`,
        [idUsuario, TERMO_FERRAMENTAS_VERSAO],
      );
      if (existente.length) {
        return res.status(409).json({ error: 'Termo já assinado para a versão atual' });
      }

      const { rows: termoInsert } = await pool.query(
        `INSERT INTO frota_termos_ferramentas (id_usuario, assinatura_url, termo_versao)
         VALUES ($1, $2, $3)
         RETURNING id_termo`,
        [idUsuario, 'pendente', TERMO_FERRAMENTAS_VERSAO],
      );
      const idTermo = termoInsert[0].id_termo;

      const assinaturaAnexo = await salvarAnexo({
        contexto: 'termo_assinatura',
        idReferencia: idTermo,
        idUsuario,
        file: assinaturaFile,
        nome: 'assinatura',
      });

      await pool.query(`UPDATE frota_termos_ferramentas SET assinatura_url = $1 WHERE id_termo = $2`, [
        midiaUrlFrota(assinaturaAnexo.id_anexo),
        idTermo,
      ]);

      for (const file of fotosFiles) {
        const anexo = await salvarAnexo({
          contexto: 'termo_foto',
          idReferencia: idTermo,
          idUsuario,
          file,
        });
        await pool.query(
          `INSERT INTO frota_termo_fotos (id_termo, id_anexo) VALUES ($1, $2)`,
          [idTermo, anexo.id_anexo],
        );
      }

      res.status(201).json({ ok: true, id_termo: idTermo });
    } catch (e) {
      next(e);
    }
  },
);

router.get('/veiculos/:id/documentos', requirePermissao('frota.usar', 'frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT d.id_documento, d.id_veiculo, d.tipo, d.titulo, d.id_anexo,
              d.data_vencimento, d.valor, d.observacao, d.id_usuario, d.created_at,
              a.tipo_mime, a.nome_arquivo
       FROM frota_documentos d
       LEFT JOIN frota_anexos a ON a.id_anexo = d.id_anexo
       WHERE d.id_veiculo = $1
       ORDER BY d.created_at DESC`,
      [idVeiculo],
    );
    res.json(
      rows.map((d) => ({
        id_documento: d.id_documento,
        id_veiculo: d.id_veiculo,
        tipo: d.tipo,
        titulo: d.titulo,
        data_vencimento: d.data_vencimento,
        valor: d.valor != null ? Number(d.valor) : null,
        observacao: d.observacao,
        created_at: d.created_at,
        tipo_mime: d.tipo_mime || null,
        nome_arquivo: d.nome_arquivo || null,
        media_url: d.id_anexo ? midiaUrlFrota(d.id_anexo) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.post(
  '/veiculos/:id/documentos',
  requirePermissao('frota.usar', 'frota.gerenciar'),
  upload.array('arquivo', 15),
  async (req, res, next) => {
    try {
      const idVeiculo = Number(req.params.id);
      const idUsuario = req.user.sub;
      const { tipo, titulo, data_vencimento, valor, observacao } = req.body || {};
      if (!tipo?.trim() || !titulo?.trim()) {
        return res.status(400).json({ error: 'Informe tipo e título' });
      }
      const arquivos = Array.isArray(req.files) ? req.files : req.file ? [req.file] : [];
      if (!arquivos.length) {
        return res.status(400).json({ error: 'Selecione um arquivo (imagem ou PDF)' });
      }
      if (arquivos.length > 15) {
        return res.status(400).json({ error: 'Máximo de 15 arquivos por envio' });
      }

      const podeGerenciar = req.user.permissoes?.includes('frota.gerenciar');
      if (!podeGerenciar) {
        const veiculo = await veiculoDoUsuario(idUsuario);
        if (!veiculo || veiculo.id_veiculo !== idVeiculo) {
          return res.status(403).json({ error: 'Sem permissão para este veículo' });
        }
      }

      const { rows: placaRows } = await pool.query(
        `SELECT placa, modelo FROM frota_veiculos WHERE id_veiculo = $1`,
        [idVeiculo],
      );
      const placa = placaRows[0]?.placa || `#${idVeiculo}`;
      const modelo = placaRows[0]?.modelo || '';
      const veiculoLabel = modelo ? `${placa} (${modelo})` : placa;
      const tipoLimpo = tipo.trim();
      const tituloBase = titulo.trim();
      const criados = [];

      for (let i = 0; i < arquivos.length; i++) {
        const file = arquivos[i];
        const tituloDoc =
          arquivos.length === 1 ? tituloBase : `${tituloBase} (${i + 1}/${arquivos.length})`;

        const { rows: docInsert } = await pool.query(
          `INSERT INTO frota_documentos (id_veiculo, tipo, titulo, data_vencimento, valor, observacao, id_usuario)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id_documento`,
          [
            idVeiculo,
            tipoLimpo,
            tituloDoc,
            data_vencimento || null,
            valor != null ? Number(String(valor).replace(',', '.')) : null,
            observacao || null,
            idUsuario,
          ],
        );

        const idDocumento = docInsert[0].id_documento;
        const anexo = await salvarAnexo({
          contexto: 'documento',
          idReferencia: idDocumento,
          idUsuario,
          file,
        });
        await pool.query(`UPDATE frota_documentos SET id_anexo = $1 WHERE id_documento = $2`, [
          anexo.id_anexo,
          idDocumento,
        ]);
        salvarDocumentoDisco({
          idVeiculo,
          idDocumento,
          idAnexo: anexo.id_anexo,
          nomeArquivo: file.originalname || 'documento.pdf',
          buffer: file.buffer,
        });

        criados.push({
          id_documento: idDocumento,
          media_url: midiaUrlFrota(anexo.id_anexo),
          titulo: tituloDoc,
        });

        await auditar(req, {
          idUsuario,
          modulo: 'frota',
          acao: 'anexar_documento',
          entidade: 'veiculo',
          idReferencia: idVeiculo,
          descricao: `Enviou o arquivo “${file.originalname || 'arquivo'}” (${tipoLimpo}) no veículo ${veiculoLabel} — título “${tituloDoc}”`,
          detalhes: {
            id_documento: idDocumento,
            tipo: tipoLimpo,
            placa,
            modelo: modelo || null,
            nome_arquivo: file.originalname || 'arquivo',
            titulo: tituloDoc,
          },
        });
      }

      res.status(201).json({
        ok: true,
        qtd: criados.length,
        documentos: criados,
        id_documento: criados[0]?.id_documento ?? null,
        media_url: criados[0]?.media_url ?? null,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/veiculos/:id/documentos/:idDocumento',
  requirePermissao('frota.usar', 'frota.gerenciar'),
  async (req, res, next) => {
    try {
      const idVeiculo = Number(req.params.id);
      const idDocumento = Number(req.params.idDocumento);
      const idUsuario = req.user.sub;

      const podeGerenciar = req.user.permissoes?.includes('frota.gerenciar');
      if (!podeGerenciar) {
        const veiculo = await veiculoDoUsuario(idUsuario);
        if (!veiculo || veiculo.id_veiculo !== idVeiculo) {
          return res.status(403).json({ error: 'Sem permissão para este veículo' });
        }
      }

      const { rows } = await pool.query(
        `DELETE FROM frota_documentos
         WHERE id_documento = $1 AND id_veiculo = $2
         RETURNING id_anexo, titulo, tipo`,
        [idDocumento, idVeiculo],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Documento não encontrado' });

      let nomeArquivo = null;
      if (rows[0].id_anexo) {
        const { rows: anexoRows } = await pool.query(
          `SELECT nome_arquivo FROM frota_anexos WHERE id_anexo = $1`,
          [rows[0].id_anexo],
        );
        nomeArquivo = anexoRows[0]?.nome_arquivo || null;
        removerDocumentoDisco({
          idVeiculo,
          idDocumento,
          idAnexo: rows[0].id_anexo,
        });
        await pool.query(`DELETE FROM frota_anexos WHERE id_anexo = $1`, [rows[0].id_anexo]);
      }

      const { rows: placaRows } = await pool.query(
        `SELECT placa, modelo FROM frota_veiculos WHERE id_veiculo = $1`,
        [idVeiculo],
      );
      const placa = placaRows[0]?.placa || `#${idVeiculo}`;
      const modelo = placaRows[0]?.modelo || '';
      const veiculoLabel = modelo ? `${placa} (${modelo})` : placa;
      const arq = nomeArquivo ? `arquivo “${nomeArquivo}”` : `documento “${rows[0].titulo}”`;
      await auditar(req, {
        idUsuario,
        modulo: 'frota',
        acao: 'excluir_documento',
        entidade: 'veiculo',
        idReferencia: idVeiculo,
        descricao: `Removeu ${arq} (${rows[0].tipo || 'doc'}) do veículo ${veiculoLabel}`,
        detalhes: {
          id_documento: idDocumento,
          placa,
          modelo: modelo || null,
          tipo: rows[0].tipo,
          titulo: rows[0].titulo,
          nome_arquivo: nomeArquivo,
        },
      });

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/veiculos/:id/manutencoes',
  requirePermissao('frota.usar'),
  upload.single('comprovante'),
  async (req, res, next) => {
    try {
      const idVeiculo = Number(req.params.id);
      const idUsuario = req.user.sub;
      const { descricao, km, valor, data_manutencao, proxima_manutencao, proxima_manutencao_km } =
        req.body || {};
      if (!descricao?.trim()) return res.status(400).json({ error: 'Informe a descrição da manutenção' });

      const veiculo = await veiculoDoUsuario(idUsuario);
      if (!veiculo || veiculo.id_veiculo !== idVeiculo) {
        return res.status(403).json({ error: 'Assuma o controle deste veículo' });
      }

      const kmNumRaw = km != null ? Number(km) : null;
      const kmEfetivo =
        kmNumRaw != null && Number.isFinite(kmNumRaw) && kmNumRaw >= 0
          ? resolverKmOdometro(kmNumRaw, kmBaseVeiculo(veiculo))
          : null;

      const proxKmRaw =
        proxima_manutencao_km != null && String(proxima_manutencao_km).trim() !== ''
          ? Number(String(proxima_manutencao_km).replace(/\D/g, ''))
          : null;
      let proxKmEfetivo =
        proxKmRaw != null && Number.isFinite(proxKmRaw) && proxKmRaw > 0 ? Math.round(proxKmRaw) : null;
      // Se não informou próxima, sugere KM atual da manutenção + 10.000
      if (proxKmEfetivo == null && kmEfetivo != null) {
        proxKmEfetivo = kmEfetivo + 10000;
      }

      const { rows } = await pool.query(
        `INSERT INTO frota_manutencoes_veiculo
         (id_veiculo, id_usuario, descricao, km, valor, data_manutencao, proxima_manutencao, proxima_manutencao_km)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7, $8)
         RETURNING id_manutencao`,
        [
          idVeiculo,
          idUsuario,
          descricao.trim(),
          kmEfetivo,
          valor != null ? Number(String(valor).replace(',', '.')) : null,
          data_manutencao || null,
          proxima_manutencao || null,
          proxKmEfetivo,
        ],
      );

      let mediaUrl = null;
      if (req.file) {
        const anexo = await salvarAnexo({
          contexto: 'manutencao_veiculo',
          idReferencia: rows[0].id_manutencao,
          idUsuario,
          file: req.file,
        });
        await pool.query(`UPDATE frota_manutencoes_veiculo SET id_anexo = $1 WHERE id_manutencao = $2`, [
          anexo.id_anexo,
          rows[0].id_manutencao,
        ]);
        mediaUrl = midiaUrlFrota(anexo.id_anexo);
      }

      if (kmEfetivo != null) {
        await sincronizarKmAtualVeiculo(idVeiculo);
      }
      if (proxKmEfetivo != null) {
        await pool.query(
          `UPDATE frota_veiculos SET proxima_manutencao_km = $2, updated_at = NOW() WHERE id_veiculo = $1`,
          [idVeiculo, proxKmEfetivo],
        );
      }

      res.status(201).json({ id_manutencao: rows[0].id_manutencao, media_url: mediaUrl });
    } catch (e) {
      next(e);
    }
  },
);

router.post('/posicao', requirePermissao('frota.usar', 'chamados.assumir'), async (req, res, next) => {
  // GPS em background — não polui a trilha de auditoria
  req.auditoriaRegistrada = true;
  try {
    if (!gpsTecnicosAtivo()) {
      return res.json({ ok: true, skipped: true, motivo: 'gps_desativado' });
    }
    const idUsuario = req.user.sub;
    const gpsPermitido = await gpsCapturaHabilitadaUsuario(idUsuario);
    if (!gpsPermitido) {
      return res.json({ ok: true, skipped: true, motivo: 'gps_desabilitado_tecnico' });
    }
    const lat = Number(req.body?.latitude);
    const lng = Number(req.body?.longitude);
    const precisao = req.body?.precisao_metros != null ? Number(req.body.precisao_metros) : null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Coordenadas inválidas' });
    }

    await pool.query(
      `INSERT INTO frota_tecnico_posicao (id_usuario, latitude, longitude, precisao_metros, atualizado_em)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id_usuario) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         precisao_metros = EXCLUDED.precisao_metros,
         atualizado_em = NOW()`,
      [idUsuario, lat, lng, precisao],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/anexos/:idAnexo/media', requirePermissao('frota.usar', 'frota.gerenciar'), async (req, res, next) => {
  try {
    const idAnexo = Number(req.params.idAnexo);
    const { rows } = await pool.query(
      `SELECT a.arquivo_url, a.tipo_mime, a.contexto, a.id_referencia, a.nome_arquivo,
              d.id_veiculo, d.id_documento
       FROM frota_anexos a
       LEFT JOIN frota_documentos d
         ON a.contexto = 'documento' AND d.id_documento = a.id_referencia
       WHERE a.id_anexo = $1`,
      [idAnexo],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Anexo não encontrado' });

    let buffer = null;
    if (rows[0].contexto === 'documento' && rows[0].id_veiculo != null) {
      const diskPath = encontrarDocumentoDisco({
        idVeiculo: rows[0].id_veiculo,
        idDocumento: rows[0].id_documento,
        idAnexo,
      });
      buffer = lerDocumentoDisco(diskPath);
    }
    if (!buffer) {
      buffer = decryptAnexo(rows[0].arquivo_url);
    }

    res.setHeader('Content-Type', rows[0].tipo_mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

export default router;
