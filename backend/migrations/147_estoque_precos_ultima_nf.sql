-- Preços de caixa a partir da última NF importada (Platlog / Brasal).
-- Casamento: código da NF com zeros à esquerda → SKU canônico da loja.

BEGIN;

CREATE TEMP TABLE tmp_bk_lojas AS
SELECT id_loja FROM lojas
WHERE COALESCE(is_active, TRUE)
  AND name ILIKE '%burger king%';

-- Pão Whopper 34754 = NF 034754 (planilha estava R$ 539,38).
UPDATE insumos i
SET und_parcial = COALESCE(NULLIF(src.und_parcial, 1), i.und_parcial),
    permite_contagem_pc_fd = TRUE,
    permite_contagem_kg_und = TRUE,
    atualizado_em = NOW()
FROM insumos src
WHERE i.id_loja = src.id_loja
  AND i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND i.codigo = '34754'
  AND src.codigo = '034754'
  AND COALESCE(src.und_parcial, 1) > 1;

UPDATE insumos
SET ativo = FALSE, contagem_diaria = FALSE, contagem_critica = FALSE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = '034754';

-- Copo sundae: a caixa impressa é 2000 UN, não 5000.
UPDATE insumos
SET und_convertida = 2000, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = '32678'
  AND descricao ~* 'SUNDAE'
  AND descricao ~* '2000'
  AND COALESCE(und_convertida, 0) > 2000;

-- Bags Brasal: Coca é 18 L; Zero / Fanta / Sprite na NF são 10 L.
UPDATE insumos
SET descricao = regexp_replace(descricao, '18\s*LT', '10 LT', 'i'),
    und_convertida = 10,
    atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND ativo = TRUE
  AND (
    codigo IN ('BK-COCA-ZERO-BAG-18', 'BK-FANTA-GUA-BAG-18', 'BK-FANTA-LAR-BAG-18', 'BK-SPRITE-BAG-18')
    OR (descricao ~* 'BAG' AND descricao ~* 'ZERO|FANTA|SPRITE' AND descricao ~* '18')
  )
  AND descricao !~* 'COCA-COLA BAG 18'
  AND descricao !~* '^COCA-COLA BAG';

UPDATE insumos
SET preco_caixa = v.preco,
    custo_fonte = 'nf',
    atualizado_em = NOW()
FROM (VALUES
  ('21403', 563.98),   -- CARNE WHOPPER CX 17,2KG  NF 573975 03/08
  ('34754', 133.83),   -- PAO WHOPPER / PAO BK 5   NF 573975 03/08
  ('38585', 172.27),   -- PAO BRIOCHE 192 UN       NF 566036 16/07
  ('34580', 260.01),   -- BK CHICKEN 12KG          NF 570941 27/07
  ('21055', 194.43),   -- BATATA 12,5KG            NF 573975 03/08
  ('019909', 99.74),   -- TOMATE CARMEM 7KG        NF 573974 03/08
  ('28582', 362.52),   -- BACON PRONTO 1187 UN     NF 038918 / 573975
  ('031896', 261.07),  -- COPO SHAKE 440ML 900 UN  NF 570940 27/07
  ('35293', 275.74),   -- COPO REFRIG 440ML (loja)
  ('042397', 275.74),
  ('10337', 275.74),
  ('BK-COCA-BAG-18', 355.80),
  ('BK-COCA-ZERO-BAG-18', 197.67),
  ('BK-FANTA-GUA-BAG-18', 197.67),
  ('BK-FANTA-LAR-BAG-18', 197.67),
  ('BK-SPRITE-BAG-18', 197.67)
) AS v(codigo, preco)
WHERE insumos.id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND insumos.codigo = v.codigo;

-- Bacon pronto: catálogo 28582, NF 038918 (mesmo item, código diferente).
UPDATE insumos
SET preco_caixa = 362.52, custo_fonte = 'nf', atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND descricao ~* 'BACON PRONTO'
  AND descricao ~* '1187'
  AND ABS(preco_caixa - 362.52) > 0.01;

-- Copo refrigerado 440 ml: preço confirmado pela loja (R$ 275,74).
UPDATE insumos
SET preco_caixa = 275.74, custo_fonte = 'manual', atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND ativo = TRUE
  AND descricao ~* 'COPO'
  AND descricao ~* 'REFRIG'
  AND descricao ~* '440'
  AND descricao !~* 'SHAKE|TAMPA|PORTA|CORTESIA';

DELETE FROM estoque_itens ei
USING estoque_contagens c, insumos i
WHERE ei.id_contagem = c.id_contagem
  AND ei.id_insumo = i.id_insumo
  AND c.status = 'aberta'
  AND i.ativo = FALSE
  AND i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas);

COMMIT;
