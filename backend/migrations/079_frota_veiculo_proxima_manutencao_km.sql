-- Próxima manutenção (KM) no cadastro do veículo — independente de lançamentos
ALTER TABLE frota_veiculos
  ADD COLUMN IF NOT EXISTS proxima_manutencao_km INT;

-- Sugestão inicial: odômetro atual + 10.000 km (só onde já tem KM e ainda não tem próxima)
UPDATE frota_veiculos
SET proxima_manutencao_km = GREATEST(COALESCE(km_atual, 0), COALESCE(km_inicial, 0)) + 10000
WHERE ativo = TRUE
  AND proxima_manutencao_km IS NULL
  AND GREATEST(COALESCE(km_atual, 0), COALESCE(km_inicial, 0)) > 0;
