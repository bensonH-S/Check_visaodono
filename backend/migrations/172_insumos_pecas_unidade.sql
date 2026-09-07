-- Papel, bobina, lacre, brownie 50g e suco em pack são contados em UND.
-- Cadastro foi clonado do Venâncio como KG/KG em todas as lojas; o app
-- manda o 3º campo em UND e quebra (und → kg sem fator).

BEGIN;

UPDATE insumos
SET unidade_contagem = 'UND',
    unidade_fracionada = 'UND'
WHERE (
    regexp_replace(UPPER(TRIM(codigo)), '^0+', '') IN (
      '31887',
      '31883',
      '31888',
      '34298',
      '37842',
      '38595',
      '10138',
      '35046',
      '38021'
    )
    OR UPPER(TRIM(codigo)) IN (
      'RCNT-BOBINATERMICA79X40',
      'RCNT-SUCOUVAMACA6X180ML',
      'RCNT-FILTROPFRITADEIRAC',
      'RCNT-BISXTRAAOLEITECX4X'
    )
  )
  AND UPPER(TRIM(unidade_contagem)) = 'KG';

COMMIT;
