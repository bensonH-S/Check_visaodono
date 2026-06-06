-- Cargos configuráveis (Financeiro, Diretor, etc.)
CREATE TABLE IF NOT EXISTS cargos (
  id_cargo SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  aprovador BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cargos (nome, codigo, aprovador) VALUES
  ('Financeiro', 'financeiro', TRUE),
  ('Diretor', 'diretor', TRUE)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_aprovacao_check;
ALTER TABLE manut_chamados DROP CONSTRAINT IF EXISTS manut_chamados_aprovacao_destino_check;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_aprovacao_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_cargo_aprovacao_fkey
  FOREIGN KEY (cargo_aprovacao) REFERENCES cargos(codigo)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE manut_chamados DROP CONSTRAINT IF EXISTS manut_chamados_aprovacao_destino_fkey;
ALTER TABLE manut_chamados ADD CONSTRAINT manut_chamados_aprovacao_destino_fkey
  FOREIGN KEY (aprovacao_destino) REFERENCES cargos(codigo)
  ON UPDATE CASCADE ON DELETE SET NULL;
