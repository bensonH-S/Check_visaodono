-- Escala semanal dos técnicos de manutenção (folga / férias / falta).
CREATE TABLE IF NOT EXISTS escala_manutencao_celula (
  id_celula SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('folga', 'ferias', 'falta', 'ausencia')),
  UNIQUE (id_usuario, data)
);

CREATE INDEX IF NOT EXISTS idx_escala_manutencao_celula_data
  ON escala_manutencao_celula (data, id_usuario);
