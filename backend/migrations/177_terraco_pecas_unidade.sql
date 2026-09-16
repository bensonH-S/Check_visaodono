-- Terraço (BKN 30797 / id_loja 21): peça ainda cadastrada KG/KG.
-- Água em fardo, cartonagem batata, lápis e pazinha passam a UND/UND.
-- Não replica para a rede nesta etapa.

BEGIN;

UPDATE insumos i
SET unidade_contagem = 'UND',
    unidade_fracionada = 'UND',
    atualizado_em = NOW()
FROM lojas l
WHERE i.id_loja = l.id_loja
  AND TRIM(COALESCE(l.bk_number, '')) = '30797'
  AND regexp_replace(UPPER(TRIM(i.codigo)), '^0+', '') IN (
    '37466',
    '38742',
    '9266',
    '32605'
  )
  AND UPPER(TRIM(i.unidade_contagem)) = 'KG';

UPDATE estoque_itens ei
SET
  contagem_unidade_entrada = 'UND',
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
  AND regexp_replace(UPPER(TRIM(p.codigo)), '^0+', '') IN (
    '37466',
    '38742',
    '9266',
    '32605'
  )
  AND UPPER(TRIM(p.unidade_contagem)) = 'UND'
  AND UPPER(TRIM(COALESCE(ei.contagem_unidade_entrada, ''))) = 'KG'
  AND (
    ei.contagem_caixa IS NOT NULL
    OR ei.contagem_pc_fd IS NOT NULL
    OR ei.contagem_kg_und IS NOT NULL
  );

COMMIT;
