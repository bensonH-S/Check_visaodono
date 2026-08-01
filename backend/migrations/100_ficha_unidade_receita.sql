-- Ficha: quantidade de produção (g/fatia/und) ≠ quantidade de baixa no estoque (kg/peça)
BEGIN;

ALTER TABLE ficha_tecnica_itens
  ADD COLUMN IF NOT EXISTS unidade_receita TEXT NOT NULL DEFAULT 'und';

ALTER TABLE ficha_tecnica_itens
  ADD COLUMN IF NOT EXISTS qtde_estoque NUMERIC(14, 6);

COMMENT ON COLUMN ficha_tecnica_itens.quantidade IS
  'Quantidade na receita de produção (ex.: 21 gramas, 2 fatias)';
COMMENT ON COLUMN ficha_tecnica_itens.unidade_receita IS
  'Unidade da receita: g, fatia, und, concha, volta, kg';
COMMENT ON COLUMN ficha_tecnica_itens.qtde_estoque IS
  'Equivalente na unidade de estoque/compra (kg ou peça) para baixa e custo';

UPDATE ficha_tecnica_itens
SET qtde_estoque = quantidade
WHERE qtde_estoque IS NULL;

ALTER TABLE ficha_tecnica_itens
  ALTER COLUMN qtde_estoque SET DEFAULT 0;

COMMIT;
