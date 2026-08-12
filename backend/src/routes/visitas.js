import { Router } from 'express';
import { pool } from '../db.js';
import {
  persistirFotos,
  classificarFotoCliente,
  mesclarFotoUrlSalva,
  midiaUrlsResposta,
  decryptMidiaResposta,
  countMidiaResposta,
} from '../fotos.js';
import { filtroSqlLojas, usuarioPodeLoja } from '../lojasUsuario.js';
import {
  resolverTipoChecklist,
  schemaTiposChecklistAtivo,
  obterTipoChecklistDaVisita,
} from '../checklistTipos.js';
import { auditar } from '../auditoriaHelpers.js';
import { gerarNcsFromVisita } from '../naoConformidadesChecklist.js';
import { SQL_PONTUACAO_RESPOSTA } from '../checklistPontuacao.js';
import { processarVisitaTimeCampoReprovada } from '../services/timeCampoNotificacoes.js';
import {
  processarEnvioRelatorioVisita,
  limparEnvioRelatorioVisita,
} from '../services/visitaRelatorioEmail.js';
import { requirePermissao } from '../permissoes.js';

const router = Router();
const requireApagarVisita = requirePermissao('portal.visitas.apagar');
const requireReabrirVisita = requirePermissao('portal.visitas.reabrir');

/** Garante data_visita como YYYY-MM-DD (evita ISO UTC no JSON). */
function dataVisitaIso(val) {
  if (val == null) return val;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function serializarVisita(row) {
  if (!row) return row;
  const meta =
    row.meta_visita && typeof row.meta_visita === 'object' ? row.meta_visita : {};
  return {
    ...row,
    data_visita: dataVisitaIso(row.data_visita),
    meta_visita: meta,
  };
}

router.get('/:idVisita/respostas/:idPergunta/media/:indice', async (req, res, next) => {
  try {
    const idVisita = Number(req.params.idVisita);
    const idPergunta = Number(req.params.idPergunta);
    const indice = Number(req.params.indice);

    const visita = await pool.query('SELECT id_loja FROM visitas WHERE id_visita = $1', [idVisita]);
    if (!visita.rows[0]) return res.status(404).json({ error: 'Visita não encontrada' });
    if (!usuarioPodeLoja(req.user, visita.rows[0].id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { rows } = await pool.query(
      `SELECT foto_url FROM respostas WHERE id_visita = $1 AND id_pergunta = $2`,
      [idVisita, idPergunta],
    );
    if (!rows[0]?.foto_url) return res.status(404).json({ error: 'Mídia não encontrada' });
    if (indice < 0 || indice >= countMidiaResposta(rows[0].foto_url)) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    const { buffer, mime } = decryptMidiaResposta(rows[0].foto_url, indice);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { loja, status, usuario, order, tipo } = req.query;
    let q = `
      SELECT v.*, l.name, l.bk_number, u.nome AS nome_usuario,
        tc.codigo AS tipo_checklist_codigo,
        tc.nome AS tipo_checklist_nome,
        (SELECT COUNT(*)::int FROM nao_conformidades nc
         WHERE nc.id_visita = v.id_visita AND nc.status = 'Em aberto') AS nc_abertas
      FROM visitas v
      JOIN lojas l ON l.id_loja = v.id_loja
      JOIN usuarios u ON u.id_usuario = v.id_usuario
      LEFT JOIN tipos_checklist tc ON tc.id_tipo_checklist = v.id_tipo_checklist
      WHERE 1=1
    `;
    const params = [];
    if (loja) {
      params.push(loja);
      q += ` AND v.id_loja = $${params.length}`;
    }
    if (status) {
      params.push(status);
      q += ` AND v.status = $${params.length}::status_visita`;
    }
    if (usuario) {
      params.push(Number(usuario));
      q += ` AND v.id_usuario = $${params.length}`;
    }
    if (tipo) {
      params.push(String(tipo));
      // Visitas antigas sem tipo caem em auditoria_operacional
      if (String(tipo) === 'auditoria_operacional') {
        q += ` AND (tc.codigo = $${params.length} OR v.id_tipo_checklist IS NULL)`;
      } else {
        q += ` AND tc.codigo = $${params.length}`;
      }
    }
    q += filtroSqlLojas(req.user, 'v', 'id_loja', params);
    if (String(order || '').toLowerCase() === 'nota_desc') {
      q += ' ORDER BY v.nota_final DESC NULLS LAST, v.data_visita DESC, v.id_visita DESC';
    } else {
      q += ' ORDER BY v.data_visita DESC, v.id_visita DESC';
    }
    const { rows } = await pool.query(q, params);
    res.json(rows.map(serializarVisita));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const visita = await pool.query(
      `SELECT v.*, l.name, l.bk_number, l.city, l.neighborhood, u.nome AS nome_usuario,
              tc.codigo AS tipo_checklist_codigo, tc.nome AS tipo_checklist_nome
       FROM visitas v
       JOIN lojas l ON l.id_loja = v.id_loja
       JOIN usuarios u ON u.id_usuario = v.id_usuario
       LEFT JOIN tipos_checklist tc ON tc.id_tipo_checklist = v.id_tipo_checklist
       WHERE v.id_visita = $1`,
      [req.params.id]
    );
    if (!visita.rows[0]) return res.status(404).json({ error: 'Visita não encontrada' });

    const respostas = await pool.query(
      `SELECT r.*, p.codigo, p.texto, p.tipo_resposta, p.sim_indica_problema, p.id_categoria,
              c.nome AS categoria
       FROM respostas r
       JOIN perguntas p ON p.id_pergunta = r.id_pergunta
       JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
       WHERE r.id_visita = $1
       ORDER BY c.ordem, p.ordem`,
      [req.params.id]
    );

    const porCategoria = await pool.query(
      `SELECT c.nome AS categoria,
        COALESCE(ROUND(AVG(
          (${SQL_PONTUACAO_RESPOSTA}) * p.peso
        )::numeric, 0), 0) AS percentual
       FROM respostas r
       JOIN perguntas p ON p.id_pergunta = r.id_pergunta
       JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
       WHERE r.id_visita = $1
       GROUP BY c.id_categoria, c.nome, c.ordem
       ORDER BY c.ordem`,
      [req.params.id]
    );

    const ncs = await pool.query(
      `SELECT * FROM nao_conformidades WHERE id_visita = $1 ORDER BY data_cadastro DESC`,
      [req.params.id]
    );

    const historico = await pool.query(
      `SELECT nota, data_registro FROM historico_notas
       WHERE id_loja = $1 ORDER BY data_registro DESC LIMIT 2`,
      [visita.rows[0].id_loja]
    );

    const respostasPublicas = respostas.rows.map((r) => ({
      ...r,
      foto_url: undefined,
      midia_urls: midiaUrlsResposta(req.params.id, r.id_pergunta, r.foto_url),
      total_midias: countMidiaResposta(r.foto_url),
    }));

    res.json({
      visita: serializarVisita(visita.rows[0]),
      respostas: respostasPublicas,
      desempenho_categorias: porCategoria.rows,
      nao_conformidades: ncs.rows,
      historico_notas: historico.rows,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  const {
    id_loja,
    id_usuario,
    data_visita,
    hora_inicio,
    codigo_tipo_checklist,
    id_tipo_checklist,
    meta_visita,
  } = req.body;
  if (!id_loja || !id_usuario) {
    return res.status(400).json({ error: 'Loja e auditor são obrigatórios' });
  }
  if (!usuarioPodeLoja(req.user, id_loja)) {
    return res.status(403).json({ error: 'Loja não vinculada ao seu usuário' });
  }

  const schemaAtivo = await schemaTiposChecklistAtivo();
  let idTipo = null;
  if (schemaAtivo) {
    const resolved = await resolverTipoChecklist(Number(id_usuario), {
      codigo: codigo_tipo_checklist,
      id: id_tipo_checklist,
    });
    if (!resolved.tipo) {
      return res.status(400).json({ error: resolved.error, tipos: resolved.tipos });
    }
    idTipo = resolved.tipo.id_tipo_checklist;
  }

  const meta =
    meta_visita && typeof meta_visita === 'object' && !Array.isArray(meta_visita)
      ? meta_visita
      : {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cols = schemaAtivo
      ? '(id_loja, id_usuario, data_visita, hora_inicio, status, id_tipo_checklist, meta_visita)'
      : '(id_loja, id_usuario, data_visita, hora_inicio, status)';
    const vals = schemaAtivo
      ? '($1, $2, COALESCE($3::date, (timezone(\'America/Sao_Paulo\', now()))::date), COALESCE($4, (timezone(\'America/Sao_Paulo\', now()))::time), \'Rascunho\', $5, $6::jsonb)'
      : '($1, $2, COALESCE($3::date, (timezone(\'America/Sao_Paulo\', now()))::date), COALESCE($4, (timezone(\'America/Sao_Paulo\', now()))::time), \'Rascunho\')';
    const params = schemaAtivo
      ? [
          Number(id_loja),
          Number(id_usuario),
          data_visita ?? null,
          hora_inicio ?? null,
          idTipo,
          JSON.stringify(meta),
        ]
      : [Number(id_loja), Number(id_usuario), data_visita ?? null, hora_inicio ?? null];
    const { rows } = await client.query(
      `INSERT INTO visitas ${cols} VALUES ${vals} RETURNING *`,
      params,
    );
    await client.query('COMMIT');
    const visita = rows[0];
    const { rows: lojaRow } = await pool.query('SELECT name FROM lojas WHERE id_loja = $1', [visita.id_loja]);
    await auditar(req, {
      modulo: 'visitas',
      acao: 'iniciar',
      entidade: 'visita',
      idReferencia: visita.id_visita,
      descricao: `Iniciou visita #${visita.id_visita} na loja ${lojaRow[0]?.name || visita.id_loja}`,
    });
    res.status(201).json(serializarVisita(visita));
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* conexão já fechada */
    }
    console.error('[visitas POST]', e.message);
    res.status(500).json({ error: e.message || 'Erro ao criar visita' });
  } finally {
    client.release();
  }
});

function normalizarResposta(r) {
  const resp = r.resposta;
  if (resp === 'Sim' || resp === 'Não' || resp === 'N/A') return resp;
  return null;
}

router.post('/:id/respostas', async (req, res, next) => {
  try {
    const { respostas } = req.body;
    if (!Array.isArray(respostas) || !respostas.length) {
      return res.status(400).json({ error: 'Lista de respostas obrigatória' });
    }
    const idVisita = Number(req.params.id);
    const { rows: visitaRows } = await pool.query(
      'SELECT status, id_loja FROM visitas WHERE id_visita = $1',
      [idVisita],
    );
    if (!visitaRows[0]) return res.status(404).json({ error: 'Visita não encontrada' });
    if (visitaRows[0].status !== 'Rascunho') {
      return res.status(409).json({ error: 'Visita finalizada — reabra para editar' });
    }
    if (!usuarioPodeLoja(req.user, visitaRows[0].id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const tipoVisita = await obterTipoChecklistDaVisita(idVisita);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (tipoVisita) {
        const ids = [...new Set(respostas.map((r) => Number(r.id_pergunta)).filter(Boolean))];
        if (ids.length) {
          const { rows: okRows } = await client.query(
            `SELECT p.id_pergunta FROM perguntas p
             JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
             WHERE p.id_pergunta = ANY($1::int[]) AND c.id_tipo_checklist = $2`,
            [ids, tipoVisita.id_tipo_checklist],
          );
          const okSet = new Set(okRows.map((row) => Number(row.id_pergunta)));
          const invalida = ids.find((id) => !okSet.has(id));
          if (invalida != null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Pergunta não pertence ao checklist desta visita' });
          }
        }
      }

      const rowsOut = [];
      for (const r of respostas) {
        const resposta = normalizarResposta(r);
        const nota =
          r.nota_estrelas != null && r.nota_estrelas !== ''
            ? Number(r.nota_estrelas)
            : null;
        const notaValida = nota != null && !Number.isNaN(nota) && nota >= 1 && nota <= 5;
        const fotoCls = classificarFotoCliente(
          Object.prototype.hasOwnProperty.call(r, 'foto_url') ? r.foto_url ?? null : undefined,
        );
        if (!resposta && !notaValida && fotoCls.acao === 'manter' && r.observacao == null) {
          continue;
        }
        rowsOut.push({
          id_pergunta: Number(r.id_pergunta),
          resposta,
          nota: notaValida ? nota : null,
          observacao: r.observacao ?? null,
          foto_url_raw: r.foto_url ?? null,
          foto_acao: fotoCls.acao,
        });
      }

      if (rowsOut.length) {
        const idsGravar = rowsOut.filter((x) => x.foto_acao === 'gravar').map((x) => x.id_pergunta);
        let prevFotos = new Map();
        if (idsGravar.length) {
          const { rows: prevRows } = await client.query(
            `SELECT id_pergunta, foto_url FROM respostas
             WHERE id_visita = $1 AND id_pergunta = ANY($2::int[])`,
            [idVisita, idsGravar],
          );
          prevFotos = new Map(prevRows.map((row) => [Number(row.id_pergunta), row.foto_url]));
        }

        for (const row of rowsOut) {
          if (row.foto_acao === 'gravar') {
            const novas = await persistirFotos(idVisita, row.id_pergunta, row.foto_url_raw);
            row.foto_salva = mesclarFotoUrlSalva(prevFotos.get(row.id_pergunta) ?? null, novas);
          } else {
            row.foto_salva = null;
          }
        }

        const upsertGrupo = async (grupo, modoFoto) => {
          if (!grupo.length) return;
          const ids = grupo.map((x) => x.id_pergunta);
          const respArr = grupo.map((x) => x.resposta);
          const notas = grupo.map((x) => x.nota);
          const obsArr = grupo.map((x) => x.observacao);
          const fotosArr = grupo.map((x) => x.foto_salva);
          const setFoto =
            modoFoto === 'gravar'
              ? 'foto_url = EXCLUDED.foto_url'
              : modoFoto === 'limpar'
                ? 'foto_url = NULL'
                : null;
          await client.query(
            `INSERT INTO respostas (id_visita, id_pergunta, resposta, nota_estrelas, observacao, foto_url)
             SELECT
               $1::int,
               u.id_pergunta,
               u.resposta::resposta_checklist,
               u.nota_estrelas,
               u.observacao,
               u.foto_url
             FROM unnest(
               $2::int[],
               $3::text[],
               $4::int[],
               $5::text[],
               $6::text[]
             ) AS u(id_pergunta, resposta, nota_estrelas, observacao, foto_url)
             ON CONFLICT (id_visita, id_pergunta)
             DO UPDATE SET
               resposta = COALESCE(EXCLUDED.resposta, respostas.resposta),
               nota_estrelas = COALESCE(EXCLUDED.nota_estrelas, respostas.nota_estrelas),
               observacao = EXCLUDED.observacao
               ${setFoto ? `, ${setFoto}` : ''}`,
            [idVisita, ids, respArr, notas, obsArr, fotosArr],
          );
        };

        await upsertGrupo(
          rowsOut.filter((x) => x.foto_acao === 'manter'),
          'manter',
        );
        await upsertGrupo(
          rowsOut.filter((x) => x.foto_acao === 'limpar'),
          'limpar',
        );
        await upsertGrupo(
          rowsOut.filter((x) => x.foto_acao === 'gravar'),
          'gravar',
        );
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Nenhuma resposta válida para salvar' });
      }

      await client.query('COMMIT');
      const detail = await client.query('SELECT * FROM visitas WHERE id_visita = $1', [idVisita]);
      res.json(serializarVisita(detail.rows[0]));
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[respostas]', e.message);
      res.status(500).json({ error: e.message || 'Erro ao salvar respostas' });
      return;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/finalizar', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { hora_fim, duracao_minutos, observacoes_gerais } = req.body;
    const idVisita = Number(req.params.id);

    await client.query('BEGIN');

    const atual = await client.query(
      'SELECT hora_inicio, data_visita, id_loja FROM visitas WHERE id_visita = $1',
      [idVisita],
    );
    if (!atual.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visita não encontrada' });
    }
    if (!usuarioPodeLoja(req.user, atual.rows[0].id_loja)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Acesso negado' });
    }

    let duracao = duracao_minutos != null ? Number(duracao_minutos) : null;
    if ((duracao == null || Number.isNaN(duracao)) && atual.rows[0].hora_inicio) {
      const { rows: calc } = await client.query(
        `SELECT GREATEST(1, EXTRACT(EPOCH FROM (
           (timezone('America/Sao_Paulo', now()))::time - hora_inicio
         )) / 60)::int AS mins
         FROM visitas WHERE id_visita = $1 AND hora_inicio IS NOT NULL`,
        [idVisita],
      );
      duracao = calc[0]?.mins ?? null;
    }

    const { rows } = await client.query(
      `UPDATE visitas SET
         status = 'Finalizada',
         hora_fim = COALESCE($2::time, (timezone('America/Sao_Paulo', now()))::time),
         duracao_minutos = COALESCE($3, duracao_minutos),
         observacoes_gerais = COALESCE($4, observacoes_gerais),
         updated_at = NOW()
       WHERE id_visita = $1
       RETURNING *`,
      [idVisita, hora_fim ?? null, duracao, observacoes_gerais ?? null],
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visita não encontrada' });
    }

    const ncResult = await gerarNcsFromVisita(client, idVisita);

    await client.query('COMMIT');

    const { rows: lojaRow } = await pool.query('SELECT name FROM lojas WHERE id_loja = $1', [
      rows[0].id_loja,
    ]);
    await auditar(req, {
      modulo: 'visitas',
      acao: 'finalizar',
      entidade: 'visita',
      idReferencia: rows[0].id_visita,
      descricao: `Finalizou visita #${rows[0].id_visita} na loja ${lojaRow[0]?.name || rows[0].id_loja} (${rows[0].duracao_minutos ?? '?'} min)${ncResult.criadas ? ` — gerou ${ncResult.criadas} NC(s)` : ''}`,
    });

    processarVisitaTimeCampoReprovada(idVisita).catch((e) => {
      console.error('[time-campo] Falha ao notificar reprovação:', e.message);
    });

    void processarEnvioRelatorioVisita(idVisita).catch((e) => {
      console.error('[visita-email] Falha ao enviar relatório:', e.message);
    });

    res.json({ ...serializarVisita(rows[0]), ncs_geradas: ncResult.criadas });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

/**
 * Reenvio manual do relatório de Auditoria Operacional por e-mail.
 * Sempre force=true (mesmo se já tiver sido enviado).
 */
router.post('/:id/enviar-relatorio-email', requirePermissao('portal.visitas.ver'), async (req, res, next) => {
  try {
    const idVisita = Number(req.params.id);
    if (!Number.isFinite(idVisita) || idVisita <= 0) {
      return res.status(400).json({ error: 'Visita inválida' });
    }

    const { rows } = await pool.query(
      `SELECT v.id_visita, v.id_loja, v.status, v.data_visita,
              l.name AS nome_loja,
              tc.codigo AS tipo_checklist_codigo
       FROM visitas v
       JOIN lojas l ON l.id_loja = v.id_loja
       LEFT JOIN tipos_checklist tc ON tc.id_tipo_checklist = v.id_tipo_checklist
       WHERE v.id_visita = $1`,
      [idVisita],
    );
    const visita = rows[0];
    if (!visita) return res.status(404).json({ error: 'Visita não encontrada' });
    if (!usuarioPodeLoja(req.user, visita.id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (visita.status !== 'Finalizada') {
      return res.status(409).json({ error: 'Somente visitas finalizadas podem enviar relatório' });
    }
    const codigo = String(visita.tipo_checklist_codigo || '').trim();
    if (codigo && codigo !== 'auditoria_operacional') {
      return res.status(409).json({
        error: 'Por enquanto só é possível enviar e-mail de Auditoria Operacional',
      });
    }

    const result = await processarEnvioRelatorioVisita(idVisita, { force: true });
    if (result?.ignorado) {
      const msgs = {
        smtp_desabilitado: 'SMTP não configurado ou e-mail de relatório desabilitado',
        visita_nao_encontrada: 'Visita não encontrada',
        nao_finalizada: 'Visita não está finalizada',
        somente_auditoria_operacional: 'Somente Auditoria Operacional',
        sem_destinatarios: 'Nenhum destinatário encontrado para a loja',
        ja_enviado: 'Relatório já enviado',
      };
      const motivo = String(result.motivo || '');
      return res.status(409).json({
        error: msgs[motivo] || `Não foi possível enviar (${motivo || 'erro'})`,
        motivo,
      });
    }

    await auditar(req, {
      modulo: 'visitas',
      acao: 'enviar_email',
      entidade: 'visita',
      idReferencia: idVisita,
      descricao: `Enviou relatório por e-mail da visita #${idVisita} (${visita.nome_loja})`,
      detalhes: {
        subject: result?.subject,
        to: result?.destinatarios,
        cc: result?.cc,
      },
    });

    res.json({
      ok: true,
      subject: result?.subject,
      destinatarios: result?.destinatarios,
      cc: result?.cc,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Reabre visita finalizada para edição — permissão portal.visitas.reabrir.
 * Remove NCs e histórico gerados na finalização; registra auditoria.
 */
router.patch('/:id/reabrir', requireReabrirVisita, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const idVisita = Number(req.params.id);
    if (!Number.isFinite(idVisita) || idVisita <= 0) {
      return res.status(400).json({ error: 'Visita inválida' });
    }

    await client.query('BEGIN');

    const { rows: atuais } = await client.query(
      `SELECT v.id_visita, v.id_loja, v.status, v.nota_final, v.data_visita,
              l.name AS nome_loja
       FROM visitas v
       JOIN lojas l ON l.id_loja = v.id_loja
       WHERE v.id_visita = $1
       FOR UPDATE OF v`,
      [idVisita],
    );
    const visita = atuais[0];
    if (!visita) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visita não encontrada' });
    }
    if (!usuarioPodeLoja(req.user, visita.id_loja)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (visita.status !== 'Finalizada') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Somente visitas finalizadas podem ser reabertas' });
    }

    const { rows } = await client.query(
      `UPDATE visitas SET
         status = 'Rascunho',
         hora_fim = NULL,
         updated_at = NOW()
       WHERE id_visita = $1
       RETURNING *`,
      [idVisita],
    );

    const ncDel = await client.query(
      `DELETE FROM nao_conformidades WHERE id_visita = $1`,
      [idVisita],
    );
    await client.query(`DELETE FROM historico_notas WHERE id_visita = $1`, [idVisita]);
    await limparEnvioRelatorioVisita(idVisita, client);
    await sincronizarNotaLoja(client, visita.id_loja);

    await client.query('COMMIT');

    await auditar(req, {
      modulo: 'visitas',
      acao: 'reabrir',
      entidade: 'visita',
      idReferencia: idVisita,
      descricao: `Reabriu visita #${idVisita} na loja ${visita.nome_loja} (nota anterior: ${visita.nota_final ?? '—'})`,
      detalhes: {
        nota_anterior: visita.nota_final,
        ncs_removidas: ncDel.rowCount ?? 0,
        data_visita: visita.data_visita,
      },
    });

    res.json(serializarVisita(rows[0]));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

/**
 * Recalcula lojas.nota_atual / ultima_visita a partir da última visita finalizada.
 * Necessário ao apagar relatório — o trigger só atualiza a loja ao finalizar.
 */
async function sincronizarNotaLoja(client, idLoja) {
  const { rows } = await client.query(
    `SELECT nota_final, data_visita
     FROM visitas
     WHERE id_loja = $1 AND status = 'Finalizada' AND nota_final IS NOT NULL
     ORDER BY data_visita DESC, id_visita DESC
     LIMIT 1`,
    [idLoja],
  );
  if (rows[0]) {
    await client.query(
      `UPDATE lojas
       SET nota_atual = $1, ultima_visita = $2, updated_at = NOW()
       WHERE id_loja = $3`,
      [rows[0].nota_final, rows[0].data_visita, idLoja],
    );
  } else {
    await client.query(
      `UPDATE lojas
       SET nota_atual = 0, ultima_visita = NULL, updated_at = NOW()
       WHERE id_loja = $1`,
      [idLoja],
    );
  }
}

/** Apaga visita/relatório (respostas em CASCADE; NCs e histórico limpos). */
router.delete('/:id', requireApagarVisita, async (req, res, next) => {
  try {
    const idVisita = Number(req.params.id);
    if (!Number.isFinite(idVisita) || idVisita <= 0) {
      return res.status(400).json({ error: 'Visita inválida' });
    }

    const { rows } = await pool.query(
      `SELECT v.id_visita, v.id_loja, v.status, v.data_visita, v.nota_final,
              l.name AS nome_loja, u.nome AS nome_usuario
       FROM visitas v
       JOIN lojas l ON l.id_loja = v.id_loja
       JOIN usuarios u ON u.id_usuario = v.id_usuario
       WHERE v.id_visita = $1`,
      [idVisita],
    );
    const visita = rows[0];
    if (!visita) return res.status(404).json({ error: 'Visita não encontrada' });
    if (!usuarioPodeLoja(req.user, visita.id_loja)) {
      return res.status(403).json({ error: 'Acesso negado a esta loja' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM nao_conformidades WHERE id_visita = $1`, [idVisita]);
      await client.query(`DELETE FROM historico_notas WHERE id_visita = $1`, [idVisita]);
      const del = await client.query(`DELETE FROM visitas WHERE id_visita = $1 RETURNING id_visita`, [
        idVisita,
      ]);
      if (!del.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Visita não encontrada' });
      }
      await sincronizarNotaLoja(client, visita.id_loja);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    await auditar(req, {
      modulo: 'visitas',
      acao: 'excluir',
      entidade: 'visita',
      idReferencia: idVisita,
      descricao: `Apagou relatório/visita #${idVisita} (${visita.nome_loja}, ${visita.status}, auditor ${visita.nome_usuario})`,
    });

    res.json({ ok: true, id_visita: idVisita });
  } catch (e) {
    next(e);
  }
});

export default router;
