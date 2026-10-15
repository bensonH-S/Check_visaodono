-- Anotações por usuário: colaborador vê só as próprias (máx. 2); TI vê todas.

BEGIN;

ALTER TABLE ti_notas
  ADD COLUMN IF NOT EXISTS id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE;

UPDATE ti_notas
SET id_usuario = atualizado_por
WHERE id_usuario IS NULL
  AND atualizado_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ti_notas_usuario ON ti_notas(id_usuario);

COMMIT;
