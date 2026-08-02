-- Contagem estilo planilha Terraço:
--   QTD = CAIXA * und_convertida + PC/FD * und_parcial + KG/UND

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS und_parcial NUMERIC(14, 4) NOT NULL DEFAULT 1;

COMMENT ON COLUMN insumos.und_parcial IS
  'Fator do campo PC/FD na fórmula QTD (ex.: bag parcial 1.1 kg). Default 1.';

ALTER TABLE estoque_itens
  ADD COLUMN IF NOT EXISTS contagem_caixa NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS contagem_pc_fd NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS contagem_kg_und NUMERIC(14, 4);

COMMENT ON COLUMN estoque_itens.contagem_caixa IS 'Entrada CAIXA da planilha Terraço';
COMMENT ON COLUMN estoque_itens.contagem_pc_fd IS 'Entrada PC/FD da planilha Terraço';
COMMENT ON COLUMN estoque_itens.contagem_kg_und IS 'Entrada KG/UND (sobra) da planilha Terraço';
