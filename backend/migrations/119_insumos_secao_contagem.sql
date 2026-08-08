-- Seções da planilha Terraço (CONGELADOS, RESFRIADOS, BRINDES, …)
ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS secao_contagem TEXT,
  ADD COLUMN IF NOT EXISTS ordem_contagem INTEGER;

COMMENT ON COLUMN insumos.secao_contagem IS
  'Seção/categoria da planilha de contagem (ex.: CONGELADOS, BRINDES).';
COMMENT ON COLUMN insumos.ordem_contagem IS
  'Ordem do item na planilha (para manter a sequência da contagem).';

CREATE INDEX IF NOT EXISTS idx_insumos_loja_secao_ordem
  ON insumos (id_loja, secao_contagem, ordem_contagem NULLS LAST);
