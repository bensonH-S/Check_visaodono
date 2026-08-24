-- Coloca itens novos na faixa certa da planilha e tira cabeçalho fantasma.

BEGIN;

CREATE TEMP TABLE tmp_bk_lojas AS
SELECT id_loja FROM lojas
WHERE COALESCE(is_active, TRUE)
  AND name ILIKE '%burger king%';

-- Copo 550 ml: embalagens, logo após os 440.
UPDATE insumos i
SET secao_contagem = 'EMBALAGENS E ESTOCAVEIS',
    ordem_contagem = COALESCE(
      (
        SELECT MIN(x.ordem_contagem) + 1
        FROM insumos x
        WHERE x.id_loja = i.id_loja
          AND x.codigo IN ('35293', '10337')
          AND x.ordem_contagem IS NOT NULL
      ),
      80
    ),
    atualizado_em = NOW()
WHERE i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND i.codigo = '042242';

-- Bags Coca/Fanta/Sprite no bloco de refrigerantes.
UPDATE insumos i
SET secao_contagem = COALESCE(
      i.secao_contagem,
      'REFRIGERANTES COCA-COLA - LATAS - CO2'
    ),
    ordem_contagem = COALESCE(
      i.ordem_contagem,
      (
        SELECT MAX(x.ordem_contagem)
        FROM insumos x
        WHERE x.id_loja = i.id_loja
          AND x.secao_contagem ILIKE 'REFRIGERANTES%'
          AND x.ordem_contagem IS NOT NULL
      )
    ),
    atualizado_em = NOW()
WHERE i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND i.ativo = TRUE
  AND i.codigo LIKE 'BK-%BAG%';

-- Queijo cheddar e alface na faixa RESFRIADOS.
UPDATE insumos i
SET secao_contagem = 'RESFRIADOS',
    ordem_contagem = COALESCE(
      i.ordem_contagem,
      (
        SELECT MAX(x.ordem_contagem)
        FROM insumos x
        WHERE x.id_loja = i.id_loja
          AND x.secao_contagem ILIKE 'RESFRIADOS%'
          AND x.ordem_contagem IS NOT NULL
      )
    ),
    atualizado_em = NOW()
WHERE i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND i.ativo = TRUE
  AND i.codigo IN ('35619', '037466');

-- Linha de seção que vazou como insumo.
UPDATE insumos
SET ativo = FALSE, contagem_diaria = FALSE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = 'TRC-RESFRIADOS';

DELETE FROM estoque_itens ei
USING estoque_contagens c, insumos i
WHERE ei.id_contagem = c.id_contagem
  AND ei.id_insumo = i.id_insumo
  AND c.status = 'aberta'
  AND i.ativo = FALSE
  AND i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas);

COMMIT;
