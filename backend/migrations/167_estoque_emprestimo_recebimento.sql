-- Empréstimo entre lojas: origem baixa na hora; destino confirma o recebimento.
-- Itens guardam CAIXA / PC/FD / KG/UND (mesma conta da conferência).

BEGIN;

ALTER TABLE estoque_break
  ADD COLUMN IF NOT EXISTS recebimento_status TEXT,
  ADD COLUMN IF NOT EXISTS recebido_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recebido_em TIMESTAMPTZ;

ALTER TABLE estoque_break DROP CONSTRAINT IF EXISTS estoque_break_recebimento_status_check;
ALTER TABLE estoque_break
  ADD CONSTRAINT estoque_break_recebimento_status_check
  CHECK (recebimento_status IS NULL OR recebimento_status IN ('pendente', 'recebido'));

CREATE INDEX IF NOT EXISTS idx_estoque_break_receber
  ON estoque_break (id_loja_destino, recebimento_status)
  WHERE tipo = 'emprestimo' AND recebimento_status = 'pendente';

ALTER TABLE estoque_break_itens
  ADD COLUMN IF NOT EXISTS contagem_caixa NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS contagem_pc_fd NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS contagem_kg_und NUMERIC(14, 4);

COMMIT;
