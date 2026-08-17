-- Turno, desperdício (completo/incompleto) e empréstimo no controle de break.

ALTER TABLE estoque_break DROP CONSTRAINT IF EXISTS estoque_break_tipo_check;
ALTER TABLE estoque_break
  ADD CONSTRAINT estoque_break_tipo_check
  CHECK (tipo IN (
    'refeicao',
    'outro',
    'desperdicio_completo',
    'desperdicio_incompleto',
    'emprestimo'
  ));

ALTER TABLE estoque_break
  ADD COLUMN IF NOT EXISTS turno TEXT,
  ADD COLUMN IF NOT EXISTS id_loja_destino INTEGER REFERENCES lojas(id_loja) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_codigo TEXT;

ALTER TABLE estoque_break DROP CONSTRAINT IF EXISTS estoque_break_turno_check;
ALTER TABLE estoque_break
  ADD CONSTRAINT estoque_break_turno_check
  CHECK (turno IS NULL OR turno IN ('manha', 'tarde', 'noite'));

CREATE INDEX IF NOT EXISTS idx_estoque_break_turno
  ON estoque_break (id_loja, data_break, turno);
