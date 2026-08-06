-- Acelera sync de KM e subquery de km_assuncao (writes / detalhe)
CREATE INDEX IF NOT EXISTS idx_frota_abastecimentos_veiculo
  ON frota_abastecimentos (id_veiculo);

CREATE INDEX IF NOT EXISTS idx_frota_manutencoes_veiculo
  ON frota_manutencoes_veiculo (id_veiculo);

CREATE INDEX IF NOT EXISTS idx_frota_assuncoes_veiculo
  ON frota_assuncoes (id_veiculo);

CREATE INDEX IF NOT EXISTS idx_frota_assuncoes_veiculo_aberta
  ON frota_assuncoes (id_veiculo)
  WHERE data_fim IS NULL;

CREATE INDEX IF NOT EXISTS idx_frota_veiculos_ativo
  ON frota_veiculos (ativo)
  WHERE ativo = TRUE;
