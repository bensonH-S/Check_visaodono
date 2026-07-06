BEGIN;

ALTER TABLE metas_rankings
  ADD COLUMN IF NOT EXISTS nome_loja_planilha TEXT,
  ADD COLUMN IF NOT EXISTS ordem_linha INT;

ALTER TABLE metas_rankings
  DROP CONSTRAINT IF EXISTS metas_rankings_id_periodo_id_indicador_id_loja_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_rankings_periodo_ind_ordem
  ON metas_rankings (id_periodo, id_indicador, ordem_linha)
  WHERE ordem_linha IS NOT NULL;

COMMIT;
