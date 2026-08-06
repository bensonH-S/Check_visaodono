-- Campos extras das multas DETRAN (hora, grupo/natureza, velocidades)
ALTER TABLE frota_multas_detran ADD COLUMN IF NOT EXISTS hora_multa TEXT;
ALTER TABLE frota_multas_detran ADD COLUMN IF NOT EXISTS natureza TEXT;
ALTER TABLE frota_multas_detran ADD COLUMN IF NOT EXISTS velocidade_aferida NUMERIC(8, 2);
ALTER TABLE frota_multas_detran ADD COLUMN IF NOT EXISTS velocidade_permitida NUMERIC(8, 2);

-- Cache de débitos DETRAN-DF (IPVA / Licenciamento) via Infosimples detran/df/debitos
CREATE TABLE IF NOT EXISTS frota_debitos_detran (
  id_debito_detran SERIAL PRIMARY KEY,
  id_sync INTEGER REFERENCES frota_multas_detran_sync (id_sync) ON DELETE SET NULL,
  id_veiculo INTEGER NOT NULL REFERENCES frota_veiculos (id_veiculo) ON DELETE CASCADE,
  placa TEXT NOT NULL,
  modelo TEXT,
  tipo TEXT NOT NULL,
  ano_referencia TEXT,
  data_validade DATE,
  data_vencimento DATE,
  valor_total NUMERIC(12, 2),
  valor_original NUMERIC(12, 2),
  valor_pago NUMERIC(12, 2),
  valor_multa NUMERIC(12, 2),
  valor_mora NUMERIC(12, 2),
  valor_outros NUMERIC(12, 2),
  valor_diferenca NUMERIC(12, 2),
  boleto TEXT,
  status TEXT NOT NULL DEFAULT 'Em Aberto',
  cota TEXT,
  chave_unica TEXT,
  fonte TEXT NOT NULL DEFAULT 'infosimples',
  consultado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT frota_debitos_detran_tipo_chk
    CHECK (tipo IN ('IPVA', 'Licenciamento'))
);

CREATE INDEX IF NOT EXISTS idx_frota_debitos_detran_veiculo
  ON frota_debitos_detran (id_veiculo);

CREATE INDEX IF NOT EXISTS idx_frota_debitos_detran_tipo
  ON frota_debitos_detran (tipo);

CREATE UNIQUE INDEX IF NOT EXISTS uq_frota_debitos_detran_chave
  ON frota_debitos_detran (id_veiculo, chave_unica)
  WHERE chave_unica IS NOT NULL;
