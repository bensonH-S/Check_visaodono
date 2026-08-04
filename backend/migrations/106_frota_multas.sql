-- Multas de veículos da frota (foto/scan do auto de infração).
CREATE TABLE IF NOT EXISTS frota_multas (
  id_multa SERIAL PRIMARY KEY,
  id_veiculo INTEGER NOT NULL REFERENCES frota_veiculos (id_veiculo) ON DELETE CASCADE,
  id_usuario INTEGER NOT NULL REFERENCES usuarios (id_usuario),
  descricao TEXT,
  valor NUMERIC(12, 2),
  data_multa DATE NOT NULL DEFAULT CURRENT_DATE,
  local_infracao TEXT,
  id_anexo INTEGER REFERENCES frota_anexos (id_anexo),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frota_multas_veiculo ON frota_multas (id_veiculo);
CREATE INDEX IF NOT EXISTS idx_frota_multas_data ON frota_multas (data_multa DESC);
