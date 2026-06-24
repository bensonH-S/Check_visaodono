import { Router } from 'express';
import { pool } from '../db.js';
import { filtroSqlLojas } from '../lojasUsuario.js';

const router = Router();

const LOJA_FIELDS = [
  'name',
  'address',
  'zip_code',
  'city',
  'state',
  'neighborhood',
  'bk_number',
  'cnpj',
  'corporate_name',
  'is_active',
  'latitude',
  'longitude',
];

router.get('/', async (req, res, next) => {
  try {
    const { ativas, operacionais } = req.query;
    let q = 'SELECT * FROM lojas WHERE 1=1';
    const params = [];
    if (ativas === '1' || ativas === 'true') {
      q += ' AND is_active = TRUE';
    }
    if (operacionais === '1' || operacionais === 'true') {
      q += ' AND bk_number IS NOT NULL';
    }
    q += filtroSqlLojas(req.user, null, 'id_loja', params);
    q += ' ORDER BY name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM lojas WHERE id_loja = $1', [
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: 'Loja não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await pool.query(
      `INSERT INTO lojas (name, address, zip_code, city, state, neighborhood, bk_number, cnpj, corporate_name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, TRUE))
       RETURNING *`,
      [
        b.name,
        b.address,
        b.zip_code,
        b.city,
        b.state,
        b.neighborhood,
        b.bk_number || null,
        b.cnpj,
        b.corporate_name,
        b.is_active,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const sets = [];
    const vals = [];
    let i = 1;
    for (const f of LOJA_FIELDS) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${i++}`);
        vals.push(req.body[f]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada para atualizar' });
    sets.push('updated_at = NOW()');
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE lojas SET ${sets.join(', ')} WHERE id_loja = $${i} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Loja não encontrada' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
