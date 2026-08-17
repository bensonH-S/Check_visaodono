-- Horário de trabalho do delivery por dia da semana + agenda de lojas dos técnicos.
CREATE TABLE IF NOT EXISTS escala_visitas_delivery_horario (
  id_semana INTEGER NOT NULL REFERENCES escala_visitas_semana(id_semana) ON DELETE CASCADE,
  dia SMALLINT NOT NULL CHECK (dia >= 0 AND dia <= 6),
  hora_inicio TIME,
  hora_fim TIME,
  PRIMARY KEY (id_semana, dia)
);

CREATE TABLE IF NOT EXISTS escala_manutencao_visita (
  id_celula SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  data DATE NOT NULL,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  UNIQUE (id_usuario, data, id_loja)
);

CREATE INDEX IF NOT EXISTS idx_escala_manutencao_visita_data
  ON escala_manutencao_visita (data, id_usuario);
