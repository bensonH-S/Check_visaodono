BEGIN;

-- Contagem: não trabalhamos mais com Pepsi/BEG. Mix e latas passam a ser Coca-Cola.
-- Produtos Platlog (demais insumos) permanecem.

UPDATE insumos
SET ativo = FALSE,
    contagem_critica = FALSE,
    atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'PEPSI';

-- Mix antigo da fonte BEG (Ambev/PepsiCo), substituído pela Coca.
UPDATE insumos
SET ativo = FALSE,
    contagem_critica = FALSE,
    atualizado_em = NOW()
WHERE ativo = TRUE
  AND (
    descricao ~* 'LIPTON'
    OR descricao ~* 'SUKITA'
    OR descricao ~* 'SODA LIMONADA'
    OR descricao ~* 'ANTAR[CT]ICA'
  );

UPDATE insumos
SET secao_contagem = 'REFRIGERANTES COCA-COLA - LATAS - CO2'
WHERE secao_contagem = 'REFRIGERANTES BEG - LATAS - CO2';

-- Replica latas Coca/Fanta/Sprite do Terraço para as demais lojas.
INSERT INTO insumos (
  id_loja, codigo, descricao, unidade_contagem, preco_caixa, und_convertida, und_parcial,
  ativo, custo_fonte, contagem_critica, grupo_critico, secao_contagem, ordem_contagem,
  permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und, entra_cmv
)
SELECT
  dest.id_loja,
  src.codigo,
  src.descricao,
  src.unidade_contagem,
  src.preco_caixa,
  src.und_convertida,
  src.und_parcial,
  TRUE,
  src.custo_fonte,
  TRUE,
  'lata',
  'REFRIGERANTES COCA-COLA - LATAS - CO2',
  src.ordem_contagem,
  src.permite_contagem_caixa,
  src.permite_contagem_pc_fd,
  src.permite_contagem_kg_und,
  src.entra_cmv
FROM insumos src
JOIN (SELECT DISTINCT id_loja FROM insumos) dest ON dest.id_loja <> src.id_loja
WHERE src.id_loja = 21
  AND src.descricao IN (
    'COCA-COLA LATA 310 ML15 UND',
    'COCA-COLA ZERO LATA 310 ML 6 UND',
    'FANTA GUARANA  LATA 310 ML 6 UND',
    'FANTA LARANJA LATA 6 UND',
    'SPRITE  310ML 6 UND'
  )
  AND NOT EXISTS (
    SELECT 1 FROM insumos x
    WHERE x.id_loja = dest.id_loja
      AND (
        x.codigo = src.codigo
        OR upper(trim(x.descricao)) = upper(trim(src.descricao))
      )
  );

-- Bags Coca (fonte) em toda loja que ainda não tem.
INSERT INTO insumos (
  id_loja, codigo, descricao, unidade_contagem, preco_caixa, und_convertida, und_parcial,
  ativo, contagem_critica, grupo_critico, secao_contagem,
  permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und, entra_cmv
)
SELECT
  dest.id_loja,
  bag.codigo,
  bag.descricao,
  'L',
  bag.preco_caixa,
  18,
  1,
  TRUE,
  TRUE,
  'mix',
  'REFRIGERANTES COCA-COLA - LATAS - CO2',
  TRUE,
  TRUE,
  TRUE,
  TRUE
FROM (SELECT DISTINCT id_loja FROM insumos) dest
CROSS JOIN (VALUES
  ('BK-COCA-BAG-18', 'COCA-COLA BAG 18 LT', 355.80),
  ('BK-COCA-ZERO-BAG-18', 'COCA-COLA ZERO BAG 18 LT', 355.80),
  ('BK-SPRITE-BAG-18', 'SPRITE BAG 18 LT', 197.67),
  ('BK-FANTA-LAR-BAG-18', 'FANTA LARANJA BAG 18 LT', 197.67),
  ('BK-FANTA-GUA-BAG-18', 'FANTA GUARANA BAG 18 LT', 197.67)
) AS bag(codigo, descricao, preco_caixa)
WHERE NOT EXISTS (
  SELECT 1 FROM insumos x
  WHERE x.id_loja = dest.id_loja
    AND (
      x.codigo = bag.codigo
      OR upper(trim(x.descricao)) = upper(trim(bag.descricao))
    )
);

UPDATE insumos
SET ativo = TRUE,
    contagem_critica = TRUE,
    grupo_critico = 'lata',
    secao_contagem = COALESCE(secao_contagem, 'REFRIGERANTES COCA-COLA - LATAS - CO2'),
    atualizado_em = NOW()
WHERE descricao ~* 'LATA'
  AND descricao ~* 'COCA|SPRITE|FANTA'
  AND descricao !~* 'BRINDE|CART|COPO|CANUDO|TAMPA|MASTER';

UPDATE insumos
SET ativo = TRUE,
    contagem_critica = TRUE,
    grupo_critico = 'mix',
    secao_contagem = COALESCE(secao_contagem, 'REFRIGERANTES COCA-COLA - LATAS - CO2'),
    atualizado_em = NOW()
WHERE descricao ~* 'BAG'
  AND descricao ~* 'COCA|SPRITE|FANTA'
  AND descricao !~* 'MAIONESE|BARBECUE|MOLHO|BRINDE|CART';

-- Tira Pepsi/mix antigo das contagens abertas e inclui Coca.
DELETE FROM estoque_itens ei
USING estoque_contagens c, insumos i
WHERE ei.id_contagem = c.id_contagem
  AND ei.id_insumo = i.id_insumo
  AND c.status = 'aberta'
  AND i.descricao ~* 'PEPSI|LIPTON|SUKITA|SODA LIMONADA|ANTAR[CT]ICA';

INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
FROM estoque_contagens c
JOIN insumos p
  ON p.id_loja = c.id_loja
 AND p.ativo = TRUE
 AND (
   (p.descricao ~* 'LATA' AND p.descricao ~* 'COCA|SPRITE|FANTA' AND p.descricao !~* 'MASTER')
   OR (p.descricao ~* 'BAG' AND p.descricao ~* 'COCA|SPRITE|FANTA')
 )
LEFT JOIN estoque_saldos s
  ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
WHERE c.status = 'aberta'
  AND (c.tipo = 'completa' OR p.contagem_critica = TRUE)
  AND NOT EXISTS (
    SELECT 1 FROM estoque_itens ei
    WHERE ei.id_contagem = c.id_contagem AND ei.id_insumo = p.id_insumo
  );

COMMIT;
