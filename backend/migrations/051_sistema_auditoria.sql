CREATE TABLE IF NOT EXISTS sistema_auditoria (
  id_auditoria SERIAL PRIMARY KEY,
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  modulo VARCHAR(40) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  entidade VARCHAR(60),
  id_referencia VARCHAR(80),
  descricao TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_created ON sistema_auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_modulo ON sistema_auditoria(modulo);
