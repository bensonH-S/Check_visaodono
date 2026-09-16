-- Terraço: bebida láctea em bag é litro, não quilo.
-- Doce de leite CX10X2UN e baunilha 10 L x 2 UN.
-- Dispenser 22,2 KG não entra.

BEGIN;

UPDATE insumos i
SET unidade_contagem = 'L',
    unidade_fracionada = 'L',
    atualizado_em = NOW()
FROM lojas l
WHERE i.id_loja = l.id_loja
  AND TRIM(COALESCE(l.bk_number, '')) = '30797'
  AND i.descricao ~* 'BEBIDA LACTEA'
  AND i.descricao ~* '(DOCE DE LEITE UHT BK CX10X2UN|UHT BAUNILHA BK 10[[:space:]]*L)'
  AND i.descricao !~* '22[,.]2[[:space:]]*KG'
  AND UPPER(TRIM(i.unidade_contagem)) = 'KG';

UPDATE estoque_itens ei
SET
  contagem_unidade_entrada = 'L',
  estoque_contado = ROUND((
    COALESCE(ei.contagem_caixa, 0) * COALESCE(NULLIF(p.und_convertida, 0), 1)
    + COALESCE(ei.contagem_pc_fd, 0) * COALESCE(NULLIF(p.und_parcial, 0), 1)
    + COALESCE(ei.contagem_kg_und, 0)
  )::numeric, 4)
FROM insumos p, estoque_contagens c, lojas l
WHERE ei.id_insumo = p.id_insumo
  AND c.id_contagem = ei.id_contagem
  AND c.id_loja = l.id_loja
  AND TRIM(COALESCE(l.bk_number, '')) = '30797'
  AND c.status = 'aberta'
  AND p.descricao ~* 'BEBIDA LACTEA'
  AND p.descricao ~* '(DOCE DE LEITE UHT BK CX10X2UN|UHT BAUNILHA BK 10[[:space:]]*L)'
  AND UPPER(TRIM(p.unidade_contagem)) = 'L'
  AND UPPER(TRIM(COALESCE(ei.contagem_unidade_entrada, ''))) IN ('KG', 'UND')
  AND (
    ei.contagem_caixa IS NOT NULL
    OR ei.contagem_pc_fd IS NOT NULL
    OR ei.contagem_kg_und IS NOT NULL
  );

COMMIT;
