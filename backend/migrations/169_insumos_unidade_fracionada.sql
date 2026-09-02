-- Unidade física do último nível da contagem (campo KG/UND).
-- O saldo continua canônico em unidade_contagem.
-- Retrocompat: herda unidade_contagem (KG→KG, UND→UND, L→L).
-- Não inferir UND para carnes nesta etapa.

BEGIN;

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS unidade_fracionada TEXT;

UPDATE insumos
SET unidade_fracionada = UPPER(TRIM(unidade_contagem))
WHERE unidade_fracionada IS NULL
   OR BTRIM(unidade_fracionada) = '';

COMMENT ON COLUMN insumos.unidade_fracionada IS
  'Unidade física digitada no último nível da contagem (KG, UND, L). '
  'Convertida para unidade_contagem via estoque_conversoes antes de gravar o saldo. '
  'Default = unidade_contagem (comportamento Terraço legado).';

COMMIT;
