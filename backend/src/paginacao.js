/**
 * Paginação opcional e retrocompatível para listagens do estoque.
 *
 * Por padrão (sem parâmetros de paginação na query) os endpoints continuam
 * devolvendo o array puro de sempre — nada muda para quem já consome a API.
 *
 * Quando o cliente envia `paginate=1`, o endpoint passa a responder no
 * formato envelope: `{ data: [...], meta: { page, pageSize, total, hasMore } }`.
 *
 * Estilo único: offset (`page` + `pageSize`) — previsível e fácil de integrar
 * em qualquer cliente (UI, integrações, testes).
 */

export function paginacaoAtiva(req) {
  return String(req.query?.paginate || '') === '1';
}

/**
 * @param {import('express').Request} req
 * @param {{ defaultPageSize?: number, maxPageSize?: number }} [opts]
 * @returns {{ ativo: boolean, page: number, pageSize: number, offset: number }}
 */
export function parsePaginacaoOffset(req, opts = {}) {
  const defaultPageSize = opts.defaultPageSize ?? 50;
  const maxPageSize = opts.maxPageSize ?? 200;

  const ativo = paginacaoAtiva(req);
  const pageRaw = Number(req.query?.page);
  const pageSizeRaw = Number(req.query?.pageSize);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(Math.floor(pageSizeRaw), maxPageSize)
      : defaultPageSize;

  return { ativo, page, pageSize, offset: (page - 1) * pageSize };
}

export function montarEnvelopeOffset(rows, { page, pageSize, total }) {
  return {
    data: rows,
    meta: {
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
    },
  };
}
