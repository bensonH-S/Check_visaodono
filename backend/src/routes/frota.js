import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requirePermissao } from '../permissoes.js';
import { encryptAnexo, decryptAnexo } from '../fotos.js';
import {
  EMPRESA_TERMO,
  TERMO_FERRAMENTAS_VERSAO,
  textoTermoFerramentas,
} from '../config/termoFerramentas.js';

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
    km_atual: row.km_atual,
    observacoes: row.observacoes,
    assuncao_em: row.assuncao_em,
    nome_responsavel: row.nome_responsavel,
  };
}

const COLS_VEICULO = `v.id_veiculo, v.placa, v.renavam, v.chassi, v.marca, v.modelo, v.ano, v.cor,
  v.combustivel, v.km_atual, v.observacoes, v.id_usuario_responsavel, v.assuncao_em, v.ativo,
  v.created_at, v.updated_at, u.nome AS nome_responsavel`;

/** Resumo mobile: veículo, termo, últimos abastecimentos */
router.get('/mobile/resumo', requirePermissao('frota.usar', 'frota.gerenciar'), async (req, res, next) => {
  try {
    const idUsuario = req.user.sub;
    const veiculo = await veiculoDoUsuario(idUsuario);

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
             ORDER BY a.data_abastecimento DESC LIMIT 5`,
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

router.get('/veiculos', requirePermissao('frota.usar', 'frota.gerenciar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${COLS_VEICULO}
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       WHERE v.ativo = TRUE
       ORDER BY v.placa`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/assuncoes', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id_assuncao, a.id_veiculo, a.id_usuario, a.km_inicio, a.data_inicio, a.data_fim,
              v.placa, u.nome AS nome_usuario
       FROM frota_assuncoes a
       JOIN frota_veiculos v ON v.id_veiculo = a.id_veiculo
       JOIN usuarios u ON u.id_usuario = a.id_usuario
       ORDER BY a.data_inicio DESC
       LIMIT 200`,
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
              m.data_manutencao, m.proxima_manutencao, m.created_at,
              v.placa, u.nome AS nome_usuario
       FROM frota_manutencoes_veiculo m
       JOIN frota_veiculos v ON v.id_veiculo = m.id_veiculo
       JOIN usuarios u ON u.id_usuario = m.id_usuario
       ORDER BY m.data_manutencao DESC, m.created_at DESC
       LIMIT 200`,
    );
    res.json(
      rows.map((m) => ({
        ...m,
        valor: m.valor != null ? Number(m.valor) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.post('/veiculos', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const { placa, renavam, chassi, marca, modelo, ano, cor, combustivel, km_atual, observacoes } = req.body || {};
    if (!placa?.trim()) return res.status(400).json({ error: 'Informe a placa' });
    const { rows } = await pool.query(
      `INSERT INTO frota_veiculos (placa, renavam, chassi, marca, modelo, ano, cor, combustivel, km_atual, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        km_atual != null ? Number(km_atual) : null,
        observacoes || null,
      ],
    );
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
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Veículo não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/veiculos/:id', requirePermissao('frota.gerenciar'), async (req, res, next) => {
  try {
    const idVeiculo = Number(req.params.id);
    const { placa, renavam, chassi, marca, modelo, ano, cor, combustivel, km_atual, observacoes } = req.body || {};
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
           km_atual = COALESCE($10, km_atual),
           observacoes = COALESCE($11, observacoes),
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
        km_atual != null ? Number(km_atual) : null,
        observacoes ?? null,
      ],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Veículo não encontrado' });
    const { rows: full } = await pool.query(
      `SELECT ${COLS_VEICULO}
       FROM frota_veiculos v
       LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario_responsavel
       WHERE v.id_veiculo = $1`,
      [idVeiculo],
    );
    res.json(full[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Placa já cadastrada' });
    next(e);
  }
});

router.post(
  '/me/assumir',
  requirePermissao('frota.usar'),
  upload.fields([
    { name: 'cnh', maxCount: 1 },
    { name: 'fotos_veiculo', maxCount: 6 },
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
        `SELECT id_veiculo, id_usuario_responsavel, placa, km_atual
         FROM frota_veiculos WHERE id_veiculo = $1 AND ativo = TRUE`,
        [idVeiculo],
      );
      const veiculo = veiculos[0];
      if (!veiculo) return res.status(404).json({ error: 'Veículo não encontrado' });
      if (veiculo.id_usuario_responsavel && veiculo.id_usuario_responsavel !== idUsuario) {
        return res.status(409).json({ error: 'Veículo já está sob responsabilidade de outro colaborador' });
      }

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
          `UPDATE frota_veiculos SET id_usuario_responsavel = NULL, assuncao_em = NULL
           WHERE id_usuario_responsavel = $1 AND id_veiculo != $2`,
          [idUsuario, idVeiculo],
        );

        await client.query(
          `UPDATE frota_veiculos
           SET id_usuario_responsavel = $1, assuncao_em = NOW(), km_atual = $3, updated_at = NOW()
           WHERE id_veiculo = $2`,
          [idUsuario, idVeiculo, kmAtual],
        );

        const { rows: assRows } = await client.query(
          `INSERT INTO frota_assuncoes (id_veiculo, id_usuario, km_inicio)
           VALUES ($1, $2, $3)
           RETURNING id_assuncao`,
          [idVeiculo, idUsuario, kmAtual],
        );
        idAssuncao = assRows[0].id_assuncao;

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

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
      res.json({ ok: true, veiculo: mapVeiculo(atualizado) });
    } catch (e) {
      next(e);
    }
  },
);

router.post('/me/desassumir', requirePermissao('frota.usar'), async (req, res, next) => {
  try {
    const idUsuario = req.user.sub;
    const veiculo = await veiculoDoUsuario(idUsuario);
    if (!veiculo) {
      return res.status(400).json({ error: 'Você não tem veículo sob seu controle' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE frota_assuncoes SET data_fim = NOW()
         WHERE id_veiculo = $1 AND id_usuario = $2 AND data_fim IS NULL`,
        [veiculo.id_veiculo, idUsuario],
      );
      await client.query(
        `UPDATE frota_veiculos
         SET id_usuario_responsavel = NULL, assuncao_em = NULL, updated_at = NOW()
         WHERE id_veiculo = $1 AND id_usuario_responsavel = $2`,
        [veiculo.id_veiculo, idUsuario],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

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

      const { rows } = await pool.query(
        `INSERT INTO frota_abastecimentos (id_veiculo, id_usuario, km_atual, valor_abastecido)
         VALUES ($1, $2, $3, $4)
         RETURNING id_abastecimento`,
        [veiculo.id_veiculo, idUsuario, kmAtual, valor],
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
      await pool.query(`UPDATE frota_veiculos SET km_atual = $1, updated_at = NOW() WHERE id_veiculo = $2`, [
        kmAtual,
        veiculo.id_veiculo,
      ]);

      res.status(201).json({
        id_abastecimento: idAbastecimento,
        km_atual: kmAtual,
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
      if (!fotosFiles.length) return res.status(400).json({ error: 'Envie ao menos uma foto dos equipamentos' });

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
  upload.single('arquivo'),
  async (req, res, next) => {
    try {
      const idVeiculo = Number(req.params.id);
      const idUsuario = req.user.sub;
      const { tipo, titulo, data_vencimento, valor, observacao } = req.body || {};
      if (!tipo?.trim() || !titulo?.trim()) {
        return res.status(400).json({ error: 'Informe tipo e título' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Selecione um arquivo (imagem ou PDF)' });
      }

      const podeGerenciar = req.user.permissoes?.includes('frota.gerenciar');
      if (!podeGerenciar) {
        const veiculo = await veiculoDoUsuario(idUsuario);
        if (!veiculo || veiculo.id_veiculo !== idVeiculo) {
          return res.status(403).json({ error: 'Sem permissão para este veículo' });
        }
      }

      const { rows: docInsert } = await pool.query(
        `INSERT INTO frota_documentos (id_veiculo, tipo, titulo, data_vencimento, valor, observacao, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id_documento`,
        [
          idVeiculo,
          tipo.trim(),
          titulo.trim(),
          data_vencimento || null,
          valor != null ? Number(String(valor).replace(',', '.')) : null,
          observacao || null,
          idUsuario,
        ],
      );

      let idAnexo = null;
      if (req.file) {
        const anexo = await salvarAnexo({
          contexto: 'documento',
          idReferencia: docInsert[0].id_documento,
          idUsuario,
          file: req.file,
        });
        idAnexo = anexo.id_anexo;
        await pool.query(`UPDATE frota_documentos SET id_anexo = $1 WHERE id_documento = $2`, [
          idAnexo,
          docInsert[0].id_documento,
        ]);
      }

      res.status(201).json({
        id_documento: docInsert[0].id_documento,
        media_url: idAnexo ? midiaUrlFrota(idAnexo) : null,
      });
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
      const { descricao, km, valor, data_manutencao, proxima_manutencao } = req.body || {};
      if (!descricao?.trim()) return res.status(400).json({ error: 'Informe a descrição da manutenção' });

      const veiculo = await veiculoDoUsuario(idUsuario);
      if (!veiculo || veiculo.id_veiculo !== idVeiculo) {
        return res.status(403).json({ error: 'Assuma o controle deste veículo' });
      }

      const { rows } = await pool.query(
        `INSERT INTO frota_manutencoes_veiculo
         (id_veiculo, id_usuario, descricao, km, valor, data_manutencao, proxima_manutencao)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7)
         RETURNING id_manutencao`,
        [
          idVeiculo,
          idUsuario,
          descricao.trim(),
          km != null ? Number(km) : null,
          valor != null ? Number(String(valor).replace(',', '.')) : null,
          data_manutencao || null,
          proxima_manutencao || null,
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

      res.status(201).json({ id_manutencao: rows[0].id_manutencao, media_url: mediaUrl });
    } catch (e) {
      next(e);
    }
  },
);

router.post('/posicao', requirePermissao('frota.usar', 'chamados.assumir'), async (req, res, next) => {
  try {
    const idUsuario = req.user.sub;
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
      `SELECT arquivo_url, tipo_mime FROM frota_anexos WHERE id_anexo = $1`,
      [idAnexo],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Anexo não encontrado' });

    const buffer = decryptAnexo(rows[0].arquivo_url);
    res.setHeader('Content-Type', rows[0].tipo_mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

export default router;
