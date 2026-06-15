import { Router } from 'express';
import { pool } from '../db.js';
import { requirePermissao } from '../permissoes.js';

const router = Router();

const TIPOS_RESPOSTA = ['estrelas', 'sim_nao', 'estrelas_foto', 'sim_nao_foto'];

async function carregarChecklistAgrupado() {
  const cats = await pool.query('SELECT * FROM categorias_checklist ORDER BY ordem');
  const perguntas = await pool.query('SELECT * FROM perguntas ORDER BY id_categoria, ordem');
  return cats.rows.map((c) => ({
    ...c,
    perguntas: perguntas.rows.filter((p) => p.id_categoria === c.id_categoria),
  }));
}

router.get('/', async (_req, res, next) => {
  try {
    res.json(await carregarChecklistAgrupado());
  } catch (e) {
    next(e);
  }
});

router.get('/gestao', requirePermissao('configuracoes.ver'), async (_req, res, next) => {
  try {
    res.json(await carregarChecklistAgrupado());
  } catch (e) {
    next(e);
  }
});

router.post('/categorias', requirePermissao('configuracoes.ver'), async (req, res, next) => {
  try {
    const nome = String(req.body?.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Nome da seção é obrigatório' });
    const icone = String(req.body?.icone || 'folder').trim() || 'folder';
    const { rows: ordemRows } = await pool.query(
      'SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM categorias_checklist',
    );
    const ordem = Number(req.body?.ordem) || Number(ordemRows[0]?.prox) || 1;
    const { rows } = await pool.query(
      `INSERT INTO categorias_checklist (nome, icone, ordem)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nome, icone, ordem],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/categorias/:id', requirePermissao('configuracoes.ver'), async (req, res, next) => {
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
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/perguntas', requirePermissao('configuracoes.ver'), async (req, res, next) => {
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
        'SELECT LPAD((COALESCE(MAX(codigo::int), 0) + 1)::text, 2, \'0\') AS cod FROM perguntas WHERE codigo ~ \'^\\d+$\'',
      );
      cod = proxCod[0]?.cod || '01';
    }

    let ord = Number(ordem);
    if (!ord) {
      const { rows: proxOrd } = await pool.query(
        'SELECT COALESCE(MAX(ordem), 0) + 1 AS prox FROM perguntas',
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
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Código da pergunta já existe' });
    }
    next(e);
  }
});

router.patch('/perguntas/:id', requirePermissao('configuracoes.ver'), async (req, res, next) => {
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
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Código da pergunta já existe' });
    }
    next(e);
  }
});

router.delete('/perguntas/:id', requirePermissao('configuracoes.ver'), async (req, res, next) => {
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
    const { rowCount } = await pool.query('DELETE FROM perguntas WHERE id_pergunta = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Pergunta não encontrada' });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
