import { Router } from 'express';
import { pool } from '../db.js';
import { requirePermissao } from '../permissoes.js';
import { auditar } from '../auditoriaHelpers.js';

const requireGestaoChecklist = requirePermissao('configuracoes.perguntas', 'checklist.gerenciar');
import {
  resolverTipoChecklist,
  tiposChecklistDoUsuario,
  schemaTiposChecklistAtivo,
  listarTiposChecklist,
} from '../checklistTipos.js';

const router = Router();

const TIPOS_RESPOSTA = ['estrelas', 'sim_nao', 'estrelas_foto', 'sim_nao_foto'];

async function carregarChecklistAgrupado(idTipoChecklist = null) {
  const schemaAtivo = await schemaTiposChecklistAtivo();
  const cats = schemaAtivo && idTipoChecklist != null
    ? await pool.query(
        'SELECT * FROM categorias_checklist WHERE id_tipo_checklist = $1 ORDER BY ordem',
        [idTipoChecklist],
      )
    : await pool.query('SELECT * FROM categorias_checklist ORDER BY ordem');
  const catIds = cats.rows.map((c) => c.id_categoria);
  const perguntas =
    catIds.length > 0
      ? await pool.query(
          'SELECT * FROM perguntas WHERE id_categoria = ANY($1::int[]) ORDER BY id_categoria, ordem',
          [catIds],
        )
      : { rows: [] };
  return cats.rows.map((c) => ({
    ...c,
    perguntas: perguntas.rows.filter((p) => p.id_categoria === c.id_categoria),
  }));
}

async function resolverIdTipoGestao(codigo) {
  const { rows } = await pool.query(
    'SELECT id_tipo_checklist FROM tipos_checklist WHERE codigo = $1 AND ativo = TRUE',
    [codigo || 'auditoria_operacional'],
  );
  return rows[0]?.id_tipo_checklist ?? null;
}

router.get('/tipos/catalogo', requirePermissao('configuracoes.ver', 'usuarios.gerenciar'), async (_req, res, next) => {
  try {
    if (!(await schemaTiposChecklistAtivo())) {
      return res.json([
        {
          id_tipo_checklist: 0,
          codigo: 'auditoria_operacional',
          nome: 'Auditoria Operacional',
          descricao: null,
          ordem: 1,
          ativo: true,
        },
      ]);
    }
    res.json(await listarTiposChecklist());
  } catch (e) {
    next(e);
  }
});

router.get('/tipos', async (req, res, next) => {
  try {
    if (!(await schemaTiposChecklistAtivo())) {
      return res.json([
        {
          id_tipo_checklist: 0,
          codigo: 'auditoria_operacional',
          nome: 'Auditoria Operacional',
          descricao: null,
          ordem: 1,
          ativo: true,
        },
      ]);
    }
    res.json(await tiposChecklistDoUsuario(req.user.sub));
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    if (!(await schemaTiposChecklistAtivo())) {
      return res.json(await carregarChecklistAgrupado());
    }
    const codigo = req.query.tipo ? String(req.query.tipo) : null;
    const resolved = await resolverTipoChecklist(req.user.sub, { codigo });
    if (resolved.error && !resolved.tipo) {
      return res.status(400).json({ error: resolved.error, tipos: resolved.tipos });
    }
    res.json(await carregarChecklistAgrupado(resolved.tipo.id_tipo_checklist));
  } catch (e) {
    next(e);
  }
});

router.get('/gestao', requireGestaoChecklist, async (req, res, next) => {
  try {
    const codigo = req.query.tipo ? String(req.query.tipo) : 'auditoria_operacional';
    if (!(await schemaTiposChecklistAtivo())) {
      return res.json(await carregarChecklistAgrupado());
    }
    const idTipo = await resolverIdTipoGestao(codigo);
    if (!idTipo) return res.status(404).json({ error: 'Tipo de checklist não encontrado' });
    res.json(await carregarChecklistAgrupado(idTipo));
  } catch (e) {
    next(e);
  }
});

router.post('/categorias', requireGestaoChecklist, async (req, res, next) => {
  try {
    const nome = String(req.body?.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Nome da seção é obrigatório' });
    const icone = String(req.body?.icone || 'folder').trim() || 'folder';
    let idTipo = Number(req.body?.id_tipo_checklist) || null;
    if (!idTipo && (await schemaTiposChecklistAtivo())) {
      idTipo = await resolverIdTipoGestao(req.body?.codigo_tipo_checklist || 'auditoria_operacional');
    }
    const filtroTipo = idTipo ? ' WHERE id_tipo_checklist = $1' : '';
    const paramsOrdem = idTipo ? [idTipo] : [];
    const { rows: ordemRows } = await pool.query(
      `SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM categorias_checklist${filtroTipo}`,
      paramsOrdem,
    );
    const ordem = Number(req.body?.ordem) || Number(ordemRows[0]?.prox) || 1;
    const cols = idTipo ? '(nome, icone, ordem, id_tipo_checklist)' : '(nome, icone, ordem)';
    const vals = idTipo ? '($1, $2, $3, $4)' : '($1, $2, $3)';
    const params = idTipo ? [nome, icone, ordem, idTipo] : [nome, icone, ordem];
    const { rows } = await pool.query(
      `INSERT INTO categorias_checklist ${cols} VALUES ${vals} RETURNING *`,
      params,
    );
    await auditar(req, {
      modulo: 'checklist',
      acao: 'criar',
      entidade: 'categoria',
      idReferencia: rows[0].id_categoria,
      descricao: `Seção de checklist criada: ${rows[0].nome}`,
    });
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/categorias/:id', requireGestaoChecklist, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sets = [];
    const vals = [];
    let i = 1;
    for (const campo of ['nome', 'icone', 'ordem']) {
      if (req.body?.[campo] !== undefined) {
        sets.push(`${campo} = $${i++}`);
        vals.push(req.body[campo]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE categorias_checklist SET ${sets.join(', ')} WHERE id_categoria = $${i} RETURNING *`,
      vals,
    );
    if (!rows[0]) return res.status(404).json({ error: 'Seção não encontrada' });
    await auditar(req, {
      modulo: 'checklist',
      acao: 'atualizar',
      entidade: 'categoria',
      idReferencia: id,
      descricao: `Seção de checklist atualizada: ${rows[0].nome}`,
    });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/perguntas', requireGestaoChecklist, async (req, res, next) => {
  try {
    const {
      id_categoria,
      codigo,
      texto,
      tipo_resposta,
      obrigatoria,
      peso,
      ordem,
      requer_foto,
      requer_obs_em_nao,
      critica,
    } = req.body;
    const idCat = Number(id_categoria);
    if (!idCat || !String(texto || '').trim()) {
      return res.status(400).json({ error: 'Seção e texto são obrigatórios' });
    }
    const tipo = TIPOS_RESPOSTA.includes(tipo_resposta) ? tipo_resposta : 'sim_nao';
    const { rows: cat } = await pool.query(
      'SELECT id_categoria FROM categorias_checklist WHERE id_categoria = $1',
      [idCat],
    );
    if (!cat[0]) return res.status(400).json({ error: 'Seção inválida' });

    let cod = String(codigo || '').trim();
    if (!cod) {
      const { rows: proxCod } = await pool.query(
        `SELECT LPAD((COALESCE(MAX(codigo::int), 0) + 1)::text, 2, '0') AS cod
         FROM perguntas p
         JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
         WHERE c.id_categoria = $1 AND p.codigo ~ '^\\d+$'`,
        [idCat],
      );
      cod = proxCod[0]?.cod || '01';
    }

    let ord = Number(ordem);
    if (!ord) {
      const { rows: proxOrd } = await pool.query(
        'SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM perguntas WHERE id_categoria = $1',
        [idCat],
      );
      ord = Number(proxOrd[0]?.prox) || 1;
    }

    const { rows } = await pool.query(
      `INSERT INTO perguntas (
         id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem,
         requer_foto, requer_obs_em_nao, critica
       ) VALUES ($1, $2, $3, $4::tipo_resposta_checklist, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        idCat,
        cod,
        String(texto).trim(),
        tipo,
        obrigatoria !== false,
        Number(peso) || 1,
        ord,
        !!requer_foto,
        !!requer_obs_em_nao,
        !!critica,
      ],
    );
    await auditar(req, {
      modulo: 'checklist',
      acao: 'criar',
      entidade: 'pergunta',
      idReferencia: rows[0].id_pergunta,
      descricao: `Pergunta criada: ${rows[0].codigo} — ${String(rows[0].texto).slice(0, 80)}`,
    });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Código da pergunta já existe' });
    }
    next(e);
  }
});

router.patch('/perguntas/:id', requireGestaoChecklist, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const campos = {
      id_categoria: 'int',
      codigo: 'text',
      texto: 'text',
      tipo_resposta: 'enum',
      obrigatoria: 'bool',
      peso: 'num',
      ordem: 'int',
      requer_foto: 'bool',
      requer_obs_em_nao: 'bool',
      critica: 'bool',
    };
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [campo, tipo] of Object.entries(campos)) {
      if (req.body?.[campo] === undefined) continue;
      if (tipo === 'enum') {
        if (!TIPOS_RESPOSTA.includes(req.body[campo])) {
          return res.status(400).json({ error: 'Tipo de resposta inválido' });
        }
        sets.push(`${campo} = $${i++}::tipo_resposta_checklist`);
        vals.push(req.body[campo]);
      } else {
        sets.push(`${campo} = $${i++}`);
        vals.push(req.body[campo]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE perguntas SET ${sets.join(', ')} WHERE id_pergunta = $${i} RETURNING *`,
      vals,
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pergunta não encontrada' });
    await auditar(req, {
      modulo: 'checklist',
      acao: 'atualizar',
      entidade: 'pergunta',
      idReferencia: id,
      descricao: `Pergunta atualizada: ${rows[0].codigo}`,
    });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Código da pergunta já existe' });
    }
    next(e);
  }
});

router.delete('/perguntas/:id', requireGestaoChecklist, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows: uso } = await pool.query(
      'SELECT 1 FROM respostas WHERE id_pergunta = $1 LIMIT 1',
      [id],
    );
    if (uso[0]) {
      return res.status(409).json({
        error: 'Pergunta já usada em visitas. Edite o texto em vez de excluir.',
      });
    }
    const { rows: antes } = await pool.query(
      'SELECT id_pergunta, texto, codigo FROM perguntas WHERE id_pergunta = $1',
      [id],
    );
    const { rowCount } = await pool.query('DELETE FROM perguntas WHERE id_pergunta = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Pergunta não encontrada' });
    const pergunta = antes[0];
    await auditar(req, {
      modulo: 'checklist',
      acao: 'excluir',
      entidade: 'pergunta',
      idReferencia: id,
      descricao: pergunta
        ? `Excluiu a pergunta do checklist “${String(pergunta.texto || pergunta.codigo || id).slice(0, 120)}”`
        : `Excluiu pergunta do checklist #${id}`,
      detalhes: pergunta ? { codigo: pergunta.codigo, texto: pergunta.texto } : null,
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
