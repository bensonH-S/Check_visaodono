-- Diretor aprovou e devolveu ao Financeiro para aprovação final
ALTER TABLE manut_chamados
  ADD COLUMN IF NOT EXISTS aprovacao_diretor_ok BOOLEAN NOT NULL DEFAULT FALSE;
