-- KM inicial do veículo (cadastro) + km_atual derivado dos registros de uso
BEGIN;

ALTER TABLE frota_veiculos
  ADD COLUMN IF NOT EXISTS km_inicial INT;

UPDATE frota_veiculos
SET km_inicial = km_atual
WHERE km_inicial IS NULL AND km_atual IS NOT NULL;

COMMIT;
