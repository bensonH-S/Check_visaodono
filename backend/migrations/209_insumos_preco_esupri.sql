-- Preço e presença no catálogo eSupri. O pedido Platlog usa este preço.
-- preco_caixa / custo_fonte continuam sendo o custo da nota (CMV).

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS preco_esupri NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS vende_esupri BOOLEAN;

COMMENT ON COLUMN insumos.preco_esupri IS 'Preço da caixa no catálogo eSupri da loja. Null se ainda não leu o portal.';
COMMENT ON COLUMN insumos.vende_esupri IS 'True se o código está no catálogo eSupri. False se a loja não vende. Null se ainda não conferiu.';
