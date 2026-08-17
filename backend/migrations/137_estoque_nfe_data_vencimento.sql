BEGIN;

ALTER TABLE estoque_nfe
  ADD COLUMN IF NOT EXISTS data_vencimento DATE;

CREATE INDEX IF NOT EXISTS idx_estoque_nfe_loja_vencimento
  ON estoque_nfe (id_loja, data_vencimento);

COMMENT ON COLUMN estoque_nfe.data_vencimento IS
  'Vencimento da NF (primeira duplicata dVenc). Compras do mês no app usam esta data, independente de entrada no estoque.';

COMMIT;
