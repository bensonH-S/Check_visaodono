-- Contagens abertas ainda tinham unidade_entrada=KG depois do cadastro
-- virar UND (papel, suco, lacre…). Isso gerava kg → und sem fator.

BEGIN;

UPDATE estoque_itens ei
SET
  contagem_unidade_entrada = 'UND',
  estoque_contado = ROUND((
    COALESCE(ei.contagem_caixa, 0) * COALESCE(NULLIF(p.und_convertida, 0), 1)
    + COALESCE(ei.contagem_pc_fd, 0) * COALESCE(NULLIF(p.und_parcial, 0), 1)
    + COALESCE(ei.contagem_kg_und, 0)
  )::numeric, 4)
FROM insumos p, estoque_contagens c
WHERE ei.id_insumo = p.id_insumo
  AND c.id_contagem = ei.id_contagem
  AND c.status = 'aberta'
  AND UPPER(TRIM(p.unidade_contagem)) = 'UND'
  AND UPPER(TRIM(COALESCE(ei.contagem_unidade_entrada, ''))) = 'KG'
  AND (
    ei.contagem_caixa IS NOT NULL
    OR ei.contagem_pc_fd IS NOT NULL
    OR ei.contagem_kg_und IS NOT NULL
  );

COMMIT;
