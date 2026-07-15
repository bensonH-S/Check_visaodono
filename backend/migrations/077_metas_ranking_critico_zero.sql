BEGIN;

-- Permite crítico = 0 no ranking R.E.V. (antes só 1–12).
ALTER TABLE metas_rankings DROP CONSTRAINT IF EXISTS metas_rankings_critico_check;

ALTER TABLE metas_rankings
  ADD CONSTRAINT metas_rankings_critico_check
  CHECK (critico IS NULL OR (critico >= 0 AND critico <= 12));

COMMIT;
