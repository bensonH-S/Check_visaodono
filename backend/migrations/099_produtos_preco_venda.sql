-- Preço de venda do cardápio (tabela PRECO GA) nos produtos
BEGIN;

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(14, 2);

COMMENT ON COLUMN produtos.preco_venda IS 'Preço de venda (tabela PRECO GA / Grupo Alvim)';

COMMIT;
