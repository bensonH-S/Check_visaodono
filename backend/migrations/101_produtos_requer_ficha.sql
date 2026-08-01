-- Produtos de venda que NÃO precisam de ficha técnica (ex.: lata de refrigerante, brinquedo).
-- requer_ficha = FALSE → unitário: baixa 1:1 o insumo de mesmo código (se existir) ou só processa a venda.

BEGIN;

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS requer_ficha BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN produtos.requer_ficha IS
  'TRUE = precisa de ficha técnica (composição). FALSE = produto unitário (Coca, brinquedo, etc.).';

-- Marca unitários conhecidos (todas as lojas) — refrigerantes lata, extras avulsos, brinquedos, refill
UPDATE produtos
SET requer_ficha = FALSE, atualizado_em = NOW()
WHERE codigo IN (
  '7210474', -- COCA COLA LATA BALCAO BK
  '7210479', -- COCA COLA ZERO LATA BALCAO BK
  '7210467', -- COCA COLA LATA DLV BK
  '7210472', -- COCA COLA ZERO LATA DLV BK
  '7210478', -- SPRITE LATA BALCAO BK
  '7210471', -- SPRITE LATA DLV BK
  '7210475', -- GUARANA LATA BALCAO BK
  '7210468', -- GUARANA LATA DLV BK
  '7210476', -- GUARANA ZERO LATA BALCAO BK
  '7210480', -- FANTA LARANJA LATA BALCAO BK
  '7210473', -- FANTA LARANJA LATA DLV BK
  '7210495', -- SUCO 180ML
  '9008',    -- FREE REFIL
  '8800010', -- SACHET BACONESE 1 UN
  '8800001', -- EXTRA MOLHO BBQ 21G
  '8800017', -- MOLHO DE MAIONESE TEMPERADA SACHET
  '30003',   -- BRINQUEDO EMOJI
  '5000891', -- BRINQUEDO
  '30000',   -- BRINQUEDO VENDA COMBO
  '8000092', -- BK BROWNIE RECHEIO BRIGADEIRO (venda unitária)
  '7210107', -- MOLHAO CHEDDAR 240G
  '7210549'  -- MINIONS BURGER (promo / sem composição no momento)
);

COMMIT;
