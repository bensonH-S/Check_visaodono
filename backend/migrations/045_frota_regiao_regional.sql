BEGIN;

ALTER TABLE frota_regioes
  ADD COLUMN IF NOT EXISTS id_regional INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_frota_regioes_regional ON frota_regioes(id_regional);

COMMIT;
