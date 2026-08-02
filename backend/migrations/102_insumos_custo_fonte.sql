-- Custo válido para CMV em R$ só vem de NF ou lançamento manual.
-- preco_caixa da planilha Platlog NÃO conta (custo_fonte IS NULL).

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS custo_fonte TEXT;

ALTER TABLE insumos
  DROP CONSTRAINT IF EXISTS insumos_custo_fonte_check;

ALTER TABLE insumos
  ADD CONSTRAINT insumos_custo_fonte_check
  CHECK (custo_fonte IS NULL OR custo_fonte IN ('nf', 'manual'));

COMMENT ON COLUMN insumos.custo_fonte IS
  'nf = nota fiscal; manual = digitado; NULL = sem custo confiável (não usar no CMV R$)';
