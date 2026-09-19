BEGIN;

CREATE TABLE IF NOT EXISTS app_modulos_canal (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  portal BOOLEAN NOT NULL DEFAULT FALSE,
  mobile BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_modulos_canal (codigo, nome, portal, mobile) VALUES
  ('checklist', 'AutoREV', FALSE, TRUE),
  ('chamados', 'Chamados', FALSE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
