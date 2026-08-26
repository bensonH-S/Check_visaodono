-- Auditoria Operacional: códigos 01, 02, 03… na ordem atual das seções/perguntas.
-- Não altera ordem das categorias nem das perguntas — só o número exibido.

BEGIN;

DO $$
DECLARE
  v_tipo INT;
  r RECORD;
  n INT := 0;
BEGIN
  SELECT id_tipo_checklist INTO v_tipo
  FROM tipos_checklist
  WHERE codigo = 'auditoria_operacional';

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo auditoria_operacional não encontrado';
  END IF;

  -- Temporários para não colidir (varchar(5): x0001 … x9999)
  FOR r IN
    SELECT p.id_pergunta
    FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo
    ORDER BY c.ordem, p.ordem, p.id_pergunta
  LOOP
    n := n + 1;
    UPDATE perguntas SET codigo = 'x' || LPAD(n::text, 4, '0') WHERE id_pergunta = r.id_pergunta;
  END LOOP;

  n := 0;
  FOR r IN
    SELECT p.id_pergunta
    FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo
    ORDER BY c.ordem, p.ordem, p.id_pergunta
  LOOP
    n := n + 1;
    UPDATE perguntas
    SET codigo = CASE WHEN n < 100 THEN LPAD(n::text, 2, '0') ELSE n::text END
    WHERE id_pergunta = r.id_pergunta;
  END LOOP;
END $$;

COMMIT;
