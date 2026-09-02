-- Participação na conferência, independente de insumos.ativo.
-- Default TRUE: a lista da mensal/diária/semanal permanece igual após a migration.

BEGIN;

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS participa_contagem BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN insumos.participa_contagem IS
  'TRUE = entra em novas contagens desta loja. FALSE = some da conferência sem desativar o cadastro/ficha/baixa.';

CREATE INDEX IF NOT EXISTS idx_insumos_participa_contagem
  ON insumos (id_loja)
  WHERE participa_contagem = TRUE AND ativo = TRUE;

COMMIT;
