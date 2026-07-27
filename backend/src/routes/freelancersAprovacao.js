/**
 * Proxy para FreeControl — aprovação regional de turnos freelancer.
 * Escopo: lojas do usuário (região) via bk_number.
 */
import { Router } from 'express';
import { pool } from '../db.js';
import { acessoTodasLojas, temPermissao } from '../permissoes.js';
import { carregarLojasIds } from '../lojasUsuario.js';
import { logger } from '../logger.js';

const router = Router();

async function usuarioPodeAprovarFreelancers(user) {
  if (!user) return false;
  if (temPermissao(user, 'freelancers.aprovar')) return true;
  if (acessoTodasLojas(user)) return true;
  if (String(user.perfil || '').toLowerCase() === 'administrador') return true;

  let cargo = String(user.cargo_aprovacao || user.perfil || '').toLowerCase();
  if ((!cargo || cargo === 'usuario') && user.sub) {
    try {
      const { rows } = await pool.query(
        `SELECT cargo_aprovacao, perfil FROM usuarios WHERE id_usuario = $1 LIMIT 1`,
        [user.sub],
      );
      cargo = String(rows[0]?.cargo_aprovacao || rows[0]?.perfil || '').toLowerCase();
    } catch {
      cargo = '';
    }
  }
  return (
    cargo === 'supervisor_regional' ||
    cargo === 'regional' ||
    cargo === 'diretor' ||
    cargo === 'ceo' ||
    cargo === 'dono' ||
    cargo === 'ti'
  );
}

async function requireAprovarFreelancers(req, res, next) {
  try {
    if (!(await usuarioPodeAprovarFreelancers(req.user))) {
      return res.status(403).json({ error: 'Sem permissão para aprovar freelancers' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

function freecontrolBaseUrl() {
  return String(process.env.FREECONTROL_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
}

function freecontrolToken() {
  return String(
    process.env.FREECONTROL_APPROVAL_TOKEN || process.env.REGIONAL_APPROVAL_API_TOKEN || '',
  ).trim();
}

async function bkNumbersDoUsuario(user) {
  const idsRegiao = await carregarLojasIds(user);
  // Também une lojas ligadas direto ao usuário (usuario_lojas), para não perder unidade
  // se a região de frota estiver incompleta.
  let idsUsuario = [];
  if (user?.sub && !acessoTodasLojas(user)) {
    const { rows } = await pool.query(
      `SELECT ul.id_loja
       FROM usuario_lojas ul
       JOIN lojas l ON l.id_loja = ul.id_loja AND l.is_active = TRUE
       WHERE ul.id_usuario = $1`,
      [user.sub],
    );
    idsUsuario = rows.map((r) => r.id_loja);
  }
  const ids = [...new Set([...idsRegiao, ...idsUsuario].map(Number).filter(Boolean))];
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT NULLIF(BTRIM(COALESCE(bk_number, '')), '') AS bk_number,
            id_loja, name AS nome
     FROM lojas
     WHERE id_loja = ANY($1::int[]) AND is_active = TRUE
     ORDER BY name`,
    [ids],
  );
  return rows.filter((r) => r.bk_number);
}

async function callFreeControl(path, { method = 'GET', query, body } = {}) {
  const base = freecontrolBaseUrl();
  const token = freecontrolToken();
  if (!base || !token) {
    const err = new Error(
      'Integração FreeControl não configurada (FREECONTROL_API_URL / FREECONTROL_APPROVAL_TOKEN).',
    );
    err.status = 503;
    throw err;
  }
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-service-token': token,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `FreeControl HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

router.get('/', requireAprovarFreelancers, async (req, res, next) => {
  try {
    const lojas = await bkNumbersDoUsuario(req.user);
    const bkNumbers = lojas.map((l) => l.bk_number);
    if (!bkNumbers.length) {
      return res.json({
        items: [],
        count: 0,
        lojas: [],
        aviso: 'Nenhuma unidade com código BKN no escopo da sua região.',
      });
    }

    // Fallback: semana passada (seg–dom) se o client não mandar datas
    const agora = new Date();
    const diaSemana = (agora.getUTCDay() + 6) % 7;
    const inicioEsta = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
    inicioEsta.setUTCDate(inicioEsta.getUTCDate() - diaSemana);
    const fimPassada = new Date(inicioEsta);
    fimPassada.setUTCDate(inicioEsta.getUTCDate() - 1);
    const inicioPassada = new Date(inicioEsta);
    inicioPassada.setUTCDate(inicioEsta.getUTCDate() - 7);
    const ymd = (d) => d.toISOString().slice(0, 10);
    const dateFrom = String(req.query.date_from || req.query.from || ymd(inicioPassada)).slice(0, 10);
    const dateTo = String(req.query.date_to || req.query.to || ymd(fimPassada)).slice(0, 10);
    const status = String(req.query.status || 'ALL').trim().toUpperCase() || 'ALL';

    // FreeControl trata status ausente como PENDING — sempre enviar ALL explicitamente.
    const query = {
      bk_numbers: bkNumbers.join(','),
      date_from: dateFrom,
      date_to: dateTo,
      status: status === 'ALL' ? 'ALL' : status,
    };

    const data = await callFreeControl('/api/regional-approvals', { query });

    return res.json({
      items: data.items || [],
      count: data.count ?? (data.items || []).length,
      lojas: lojas.map((l) => ({
        id_loja: l.id_loja,
        nome: l.nome,
        bk_number: l.bk_number,
      })),
      date_from: dateFrom,
      date_to: dateTo,
      status,
    });
  } catch (e) {
    if (e.status) {
      logger.warn('freelancers-aprovacao', e.message);
      // Nunca devolver 401 do FreeControl ao app — o front faz logout em qualquer 401.
      const status =
        e.status === 401 || e.status === 403 ? 502 : e.status >= 400 && e.status < 600 ? e.status : 502;
      return res.status(status).json({
        error:
          e.status === 401 || e.status === 403
            ? 'Falha na integração FreeControl (token/URL). Confira FREECONTROL_* no .env do Meridian e REGIONAL_APPROVAL_API_TOKEN no FreeControl.'
            : e.message,
      });
    }
    next(e);
  }
});

async function decidir(req, res, next, acao) {
  try {
    const checkinId = parseInt(String(req.params.checkinId || ''), 10);
    if (!Number.isFinite(checkinId) || checkinId < 1) {
      return res.status(400).json({ error: 'checkinId inválido' });
    }
    const lojas = await bkNumbersDoUsuario(req.user);
    const bkNumbers = lojas.map((l) => l.bk_number);
    if (!bkNumbers.length) {
      return res.status(403).json({ error: 'Sem unidades no escopo' });
    }

    const byName = String(req.user?.nome || req.body?.approved_by_name || '').trim();
    const note = String(req.body?.note || '').trim();

    const data = await callFreeControl(`/api/regional-approvals/${checkinId}/${acao}`, {
      method: 'POST',
      body: {
        bk_numbers: bkNumbers,
        approved_by_name: byName,
        note,
      },
    });

    return res.json(data);
  } catch (e) {
    if (e.status) {
      const status =
        e.status === 401 || e.status === 403 ? 502 : e.status >= 400 && e.status < 600 ? e.status : 502;
      return res.status(status).json({
        error:
          e.status === 401 || e.status === 403
            ? 'Falha na integração FreeControl (token/URL).'
            : e.message,
        ...(e.data && e.status !== 401 && e.status !== 403 ? e.data : {}),
      });
    }
    next(e);
  }
}

router.post('/:checkinId/approve', requireAprovarFreelancers, (req, res, next) =>
  decidir(req, res, next, 'approve'),
);
router.post('/:checkinId/reject', requireAprovarFreelancers, (req, res, next) =>
  decidir(req, res, next, 'reject'),
);

export default router;

export { usuarioPodeAprovarFreelancers };
