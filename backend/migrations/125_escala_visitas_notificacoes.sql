BEGIN;

CREATE TABLE IF NOT EXISTS escala_visitas_notificacoes (
  id_notificacao SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('pendente_aprovacao', 'aprovado', 'recusado')),
  mensagem TEXT NOT NULL,
  id_semana INT REFERENCES escala_visitas_semana(id_semana) ON DELETE SET NULL,
  id_regiao INT REFERENCES frota_regioes(id_regiao) ON DELETE SET NULL,
  semana_inicio DATE,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escala_visitas_notif_usuario
  ON escala_visitas_notificacoes(id_usuario, lida, created_at DESC);

COMMIT;
