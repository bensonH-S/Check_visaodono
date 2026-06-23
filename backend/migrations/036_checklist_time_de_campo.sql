BEGIN;

-- DEPRECADO: não use este arquivo.
-- A migration 036 apagava todo o checklist (TRUNCATE).
-- Use em sequência:
--   npm run migrate:tipos-checklist
--   npm run migrate:time-campo-dados

SELECT 1;

COMMIT;
