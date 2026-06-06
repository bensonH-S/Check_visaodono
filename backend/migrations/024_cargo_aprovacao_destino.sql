-- Destino da aprovação (financeiro ou diretor) e cargo do aprovador no usuário
ALTER TABLE manut_chamados
  ADD COLUMN IF NOT EXISTS aprovacao_destino VARCHAR(20);

ALTER TABLE manut_chamados DROP CONSTRAINT IF EXISTS manut_chamados_aprovacao_destino_check;
ALTER TABLE manut_chamados ADD CONSTRAINT manut_chamados_aprovacao_destino_check
  CHECK (aprovacao_destino IS NULL OR aprovacao_destino IN ('financeiro', 'diretor'));

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cargo_aprovacao VARCHAR(20);

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_aprovacao_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_cargo_aprovacao_check
  CHECK (cargo_aprovacao IS NULL OR cargo_aprovacao IN ('financeiro', 'diretor'));
