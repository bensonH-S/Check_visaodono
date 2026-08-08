-- Colaborador que recebe o break (consumo).
ALTER TABLE estoque_break
  ADD COLUMN IF NOT EXISTS id_colaborador INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS colaborador_nome TEXT;

CREATE INDEX IF NOT EXISTS idx_estoque_break_colaborador
  ON estoque_break (id_loja, id_colaborador)
  WHERE id_colaborador IS NOT NULL;
