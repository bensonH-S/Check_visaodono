-- Cache diário de multas DETRAN-DF (Infosimples). Evita gastar saldo a cada abertura da tela.
CREATE TABLE IF NOT EXISTS frota_multas_detran_sync (
  id_sync SERIAL PRIMARY KEY,
  data_ref DATE NOT NULL,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalizado_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rodando',
  fonte TEXT,
  qtd_veiculos INTEGER NOT NULL DEFAULT 0,
  qtd_multas INTEGER NOT NULL DEFAULT 0,
  avisos JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT frota_multas_detran_sync_status_chk
    CHECK (status IN ('rodando', 'ok', 'erro', 'parcial'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_frota_multas_detran_sync_data_ref
  ON frota_multas_detran_sync (data_ref);

CREATE TABLE IF NOT EXISTS frota_multas_detran (
  id_multa_detran SERIAL PRIMARY KEY,
  id_sync INTEGER REFERENCES frota_multas_detran_sync (id_sync) ON DELETE SET NULL,
  id_veiculo INTEGER NOT NULL REFERENCES frota_veiculos (id_veiculo) ON DELETE CASCADE,
  placa TEXT NOT NULL,
  modelo TEXT,
  auto TEXT,
  descricao TEXT,
  local_infracao TEXT,
  valor NUMERIC(12, 2),
  valor_desconto NUMERIC(12, 2),
  data_multa DATE,
  data_vencimento DATE,
  situacao TEXT,
  orgao TEXT,
  pontos INTEGER,
  fonte TEXT NOT NULL DEFAULT 'infosimples',
  consultado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frota_multas_detran_veiculo
  ON frota_multas_detran (id_veiculo);

CREATE INDEX IF NOT EXISTS idx_frota_multas_detran_data
  ON frota_multas_detran (data_multa DESC NULLS LAST);
