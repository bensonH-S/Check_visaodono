-- Histórico permanente de fechamento e reabertura de chamados
BEGIN;

CREATE TABLE IF NOT EXISTS manut_chamado_eventos (
  id_evento SERIAL PRIMARY KEY,
  id_chamado INT NOT NULL REFERENCES manut_chamados(id_chamado) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL,
  status_ref VARCHAR(40),
  id_usuario INT REFERENCES usuarios(id_usuario),
  texto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manut_eventos_chamado
  ON manut_chamado_eventos(id_chamado, created_at ASC);

COMMIT;
