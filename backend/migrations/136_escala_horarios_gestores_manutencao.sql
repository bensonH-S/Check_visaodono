-- Horário de expediente dos gestores e dos técnicos de manutenção (agendas próprias).
CREATE TABLE IF NOT EXISTS escala_gestores_horario (
  id_gestor INTEGER NOT NULL REFERENCES escala_gestores(id_gestor) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  PRIMARY KEY (id_gestor, data)
);

CREATE TABLE IF NOT EXISTS escala_manutencao_horario (
  id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  PRIMARY KEY (id_usuario, data)
);
