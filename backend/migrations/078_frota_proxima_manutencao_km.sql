-- KM da próxima manutenção informado pelo técnico (ex.: troca de óleo a cada ~10.000 km)
ALTER TABLE frota_manutencoes_veiculo
  ADD COLUMN IF NOT EXISTS proxima_manutencao_km INT;
