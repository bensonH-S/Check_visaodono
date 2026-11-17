/**
 * Autenticação da API Mycto: Bearer da env MYCTO_API_TOKEN ou SHA-256 em api_clientes.
 * O token nunca é gravado em claro nem escrito no log.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { logger } from '../logger.js';
import { pool } from '../db.js';

const JANELA_MS = 60_000;
const cotas = new Map();

export function hashToken(token) {
  return createHash('sha256').update(String(token), 'utf8').digest('hex');
}

/** Compara sem vazar tamanho nem prefixo pelo tempo de resposta. */
export function tokensIguais(informado, esperado) {
  if (!informado || !esperado) return false;
  const a = Buffer.from(hashToken(informado), 'hex');
  const b = Buffer.from(hashToken(esperado), 'hex');
  return timingSafeEqual(a, b);
}

export function limitePorMinuto(env = process.env) {
  const n = Number(env.MYCTO_RATE_LIMIT_PER_MIN || 120);
  if (!Number.isFinite(n) || n < 1) return 120;
  return Math.min(1000, Math.floor(n));
}

/**
 * Janela fixa por chave. `mapa` é injetável para o teste.
 * @returns {{ ok: boolean, restante: number, retry_em_ms: number }}
 */
export function consumirCota(mapa, chave, agora, { limite, janelaMs = JANELA_MS } = {}) {
  const teto = Math.max(1, Number(limite) || 1);
  const slot = mapa.get(chave);
  if (!slot || agora - slot.inicio >= janelaMs) {
    mapa.set(chave, { inicio: agora, count: 1 });
    return { ok: true, restante: teto - 1, retry_em_ms: janelaMs };
  }
  if (slot.count >= teto) {
    return { ok: false, restante: 0, retry_em_ms: Math.max(0, janelaMs - (agora - slot.inicio)) };
  }
  slot.count += 1;
  return { ok: true, restante: teto - slot.count, retry_em_ms: Math.max(0, janelaMs - (agora - slot.inicio)) };
}

function podarCotas(agora) {
  if (cotas.size < 5000) return;
  for (const [chave, slot] of cotas) {
    if (agora - slot.inicio >= JANELA_MS) cotas.delete(chave);
  }
}

export function ipDe(req) {
  const fwd = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return fwd || req.ip || req.socket?.remoteAddress || '';
}

export async function autenticarMycto(token) {
  const bruto = String(token || '').trim();
  if (!bruto) return null;
  const envToken = String(process.env.MYCTO_API_TOKEN || '').trim();
  if (envToken && tokensIguais(bruto, envToken)) {
    return { id: null, nome: 'mycto', origem: 'env' };
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, nome
       FROM api_clientes
       WHERE ativo = TRUE AND token_hash = $1
       LIMIT 1`,
      [hashToken(bruto)],
    );
    const cliente = rows[0];
    if (!cliente) return null;
    pool
      .query(`UPDATE api_clientes SET ultimo_acesso_em = NOW() WHERE id = $1`, [cliente.id])
      .catch(() => {});
    return { id: cliente.id, nome: cliente.nome, origem: 'tabela' };
  } catch (err) {
    if (err?.code === '42P01') return null;
    throw err;
  }
}

export async function registrarAcesso({ cliente, req, status, detalhe } = {}) {
  const caminho = String(req?.originalUrl || req?.url || '').slice(0, 500);
  const meta = {
    cliente: cliente?.nome || null,
    method: req?.method,
    status,
    ip: ipDe(req || {}),
    ...(detalhe && typeof detalhe === 'object' ? detalhe : {}),
  };
  try {
    logger.info('mycto', `${req?.method || 'GET'} ${caminho} ${status}`, meta);
  } catch {
    /* log em arquivo não pode derrubar a resposta */
  }
  try {
    await pool.query(
      `INSERT INTO api_acesso_log (id_cliente, cliente_nome, metodo, caminho, status, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        cliente?.id || null,
        cliente?.nome || null,
        String(req?.method || 'GET').slice(0, 12),
        caminho,
        status ?? null,
        ipDe(req || {}).slice(0, 80),
      ],
    );
  } catch (err) {
    if (err?.code === '42P01') return;
    try {
      logger.warn('mycto', 'Falha ao gravar log de acesso', {
        error: err?.message || err?.code || 'erro',
      });
    } catch {
      /* ignore */
    }
  }
}

export function middlewareMycto(req, res, next) {
  const header = String(req.headers?.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const agora = Date.now();
  podarCotas(agora);

  autenticarMycto(token)
    .then((cliente) => {
      if (!cliente) {
        const anon = consumirCota(cotas, `anon:${ipDe(req)}`, agora, { limite: 30 });
        if (!anon.ok) {
          res.setHeader('Retry-After', String(Math.max(1, Math.ceil(anon.retry_em_ms / 1000))));
          return res.status(429).json({ error: 'Muitas tentativas. Tente de novo em instantes.' });
        }
        void registrarAcesso({ cliente: null, req, status: 401 });
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const limite = limitePorMinuto();
      const cota = consumirCota(cotas, `cli:${cliente.origem}:${cliente.id ?? cliente.nome}`, agora, { limite });
      res.setHeader('X-RateLimit-Limit', String(limite));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, cota.restante)));
      if (!cota.ok) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil(cota.retry_em_ms / 1000))));
        void registrarAcesso({ cliente, req, status: 429 });
        return res.status(429).json({ error: 'Limite de requisições atingido.' });
      }

      req.mycto = cliente;
      res.on('finish', () => {
        void registrarAcesso({
          cliente,
          req,
          status: res.statusCode,
          detalhe: req.myctoLog,
        });
      });
      next();
    })
    .catch((err) => {
      logger.exception('mycto', err, { etapa: 'auth' });
      if (!res.headersSent) res.status(500).json({ error: 'Falha ao autenticar' });
    });
}
