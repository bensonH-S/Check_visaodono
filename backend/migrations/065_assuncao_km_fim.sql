-- KM informado na devolução do veículo
BEGIN;

ALTER TABLE frota_assuncoes
  ADD COLUMN IF NOT EXISTS km_fim INT;

COMMIT;
