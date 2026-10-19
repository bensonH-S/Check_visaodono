import { api } from '../api/client';

type Payload = {
  modulo: string;
  acao?: 'download' | 'exportar' | 'imprimir' | 'operacao';
  descricao: string;
  entidade?: string;
  id_referencia?: string | number;
  detalhes?: Record<string, unknown>;
};

/** Registra ação de negócio gerada no browser (CSV/PNG/PDF). Falhas são silenciosas. */
export function registrarAcaoAuditoria(payload: Payload): void {
  const descricao = String(payload.descricao || '').trim();
  if (!descricao) return;
  void api
    .auditoriaEvento({
      modulo: payload.modulo,
      acao: payload.acao || 'download',
      descricao,
      entidade: payload.entidade,
      id_referencia: payload.id_referencia != null ? String(payload.id_referencia) : undefined,
      detalhes: payload.detalhes,
    })
    .catch(() => undefined);
}
