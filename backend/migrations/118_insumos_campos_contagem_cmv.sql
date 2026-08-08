-- Campos da planilha Terraço:
-- - permite_contagem_*: célula preta = campo desabilitado na contagem
-- - entra_cmv: itens da faixa I7:I231 entram no TOTAL/CMV; demais não

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS permite_contagem_caixa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS permite_contagem_pc_fd BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS permite_contagem_kg_und BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS entra_cmv BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN insumos.permite_contagem_caixa IS
  'FALSE = célula preta na coluna CAIXA da planilha (campo bloqueado).';
COMMENT ON COLUMN insumos.permite_contagem_pc_fd IS
  'FALSE = célula preta na coluna PC/FD da planilha (campo bloqueado).';
COMMENT ON COLUMN insumos.permite_contagem_kg_und IS
  'FALSE = célula preta na coluna KG/UND da planilha (campo bloqueado).';
COMMENT ON COLUMN insumos.entra_cmv IS
  'TRUE = item entra no TOTAL CMV (planilha SUM I7:I231).';
