-- Vínculo N:N usuário ↔ lojas (técnico, gerente, coordenador…)
BEGIN;

CREATE TABLE IF NOT EXISTS usuario_lojas (
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_loja INT NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_usuario, id_loja)
);

CREATE INDEX IF NOT EXISTS idx_usuario_lojas_loja ON usuario_lojas(id_loja);

INSERT INTO usuario_lojas (id_usuario, id_loja)
SELECT id_usuario, id_loja FROM usuarios WHERE id_loja IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
