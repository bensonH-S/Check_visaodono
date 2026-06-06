CREATE TABLE IF NOT EXISTS manut_atualizacoes (
  id_atualizacao SERIAL PRIMARY KEY,
  id_chamado INT NOT NULL REFERENCES manut_chamados(id_chamado) ON DELETE CASCADE,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario),
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manut_atualizacoes_chamado ON manut_atualizacoes(id_chamado);
