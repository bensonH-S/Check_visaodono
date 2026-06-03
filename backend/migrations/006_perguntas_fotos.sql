-- Regras de foto por pergunta (26 = múltiplas opcionais)
ALTER TABLE perguntas
  ADD COLUMN IF NOT EXISTS max_fotos SMALLINT NOT NULL DEFAULT 1;

UPDATE perguntas SET max_fotos = 5, requer_foto = FALSE WHERE codigo = '26';
