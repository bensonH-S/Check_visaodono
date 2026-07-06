BEGIN;

ALTER TABLE metas_rankings
  ADD COLUMN IF NOT EXISTS critico INT CHECK (critico IS NULL OR (critico >= 1 AND critico <= 12));

COMMIT;
