-- Etapa 7 — saneamento cadastral (idempotente).
-- Não mexe em saldo, movimento, conversão, contagem histórica nem custo.
-- Não exclui insumo. Corrigir só referência futura e participação na contagem.

BEGIN;

-- 1) Cheddar fatia (35619): operador conta UND; saldo permanece KG.
--    Fator UND→KG 0,0115 não é alterado.
UPDATE insumos
SET unidade_fracionada = 'UND'
WHERE codigo = '35619'
  AND UPPER(COALESCE(NULLIF(BTRIM(unidade_fracionada), ''), unidade_contagem))
      IS DISTINCT FROM 'UND';

-- 2) Ovomaltine duplicado: NF/ficha = 039300; TRC-* é o mesmo CX 12x750g (9 kg).
--    Fora da contagem futura. Mantém ativo e saldo (sem somar, sem transferir).
UPDATE insumos
SET participa_contagem = FALSE
WHERE codigo = 'TRC-OVOMALTINEBKABCX9K'
  AND participa_contagem IS DISTINCT FROM FALSE;

-- 3) 3029 água-copo na ficha de sanduíche com unidade fatia = cheddar 35619.
--    Produto 9049 (água, 1 UND) permanece em 3029.
UPDATE ficha_tecnica_itens
SET codigo_insumo = '35619',
    observacao = CASE
      WHEN observacao IS NULL OR BTRIM(observacao) = '' THEN 'etapa7: 3029→35619 (fatia cheddar)'
      WHEN observacao LIKE '%etapa7: 3029→35619%' THEN observacao
      ELSE observacao || ' | etapa7: 3029→35619 (fatia cheddar)'
    END
WHERE codigo_insumo = '3029'
  AND LOWER(BTRIM(unidade_receita)) = 'fatia';

-- 4) 38454 calda pistache 1 UND em casquinha+água: contaminação (sobremesa pistache usa 0,025 kg).
--    Remove só o vínculo futuro; histórico de movimento/contagem do SKU 38454 permanece.
DELETE FROM ficha_tecnica_itens fi
USING ficha_tecnica f, produtos p
WHERE fi.id_ficha = f.id_ficha
  AND f.id_produto = p.id_produto
  AND fi.codigo_insumo = '38454'
  AND LOWER(BTRIM(fi.unidade_receita)) IN ('und', 'un', 'unid')
  AND p.codigo = '6005261';

COMMIT;
