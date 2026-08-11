-- Preço vindo do catálogo do portal (ex.: eSupri Pedido) — válido para CMV R$.
ALTER TABLE insumos
  DROP CONSTRAINT IF EXISTS insumos_custo_fonte_check;

ALTER TABLE insumos
  ADD CONSTRAINT insumos_custo_fonte_check
  CHECK (custo_fonte IS NULL OR custo_fonte IN ('nf', 'manual', 'catalogo'));

COMMENT ON COLUMN insumos.custo_fonte IS
  'nf = nota fiscal; manual = digitado; catalogo = portal fornecedor (ex. eSupri); NULL = sem custo confiável';
