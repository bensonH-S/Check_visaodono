-- Nota cancelada na Receita sai da fila de conferência do gestor.

BEGIN;

ALTER TABLE estoque_nfe DROP CONSTRAINT IF EXISTS chk_estoque_nfe_status_entrega;

ALTER TABLE estoque_nfe
  ADD CONSTRAINT chk_estoque_nfe_status_entrega
  CHECK (status_entrega IN (
    'aguardando_portal',
    'em_transito',
    'aguardando_conferencia',
    'conferida',
    'divergente',
    'cancelada'
  ));

COMMIT;
