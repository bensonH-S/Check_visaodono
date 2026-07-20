-- Renumerar códigos da Auditoria Operacional em ordem sequencial
-- (categoria.ordem, pergunta.ordem) — elimina saltos como 16 → 93.

BEGIN;

DO $$
DECLARE
  v_tipo INT;
  r RECORD;
  n INT := 0;
  cat_gente INT;
  cat_exp INT;
  cat_salao INT;
  cat_ext INT;
  ord_base INT;
BEGIN
  SELECT id_tipo_checklist INTO v_tipo
  FROM tipos_checklist
  WHERE codigo = 'auditoria_operacional';

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo auditoria_operacional não encontrado';
  END IF;

  SELECT id_categoria INTO cat_gente
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Gente e labor' LIMIT 1;
  SELECT id_categoria INTO cat_exp
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Experiência do cliente' LIMIT 1;
  SELECT id_categoria INTO cat_salao
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Salão' LIMIT 1;
  SELECT id_categoria INTO cat_ext
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Área externa e drive' LIMIT 1;

  -- Ordem das perguntas novas no fim de cada categoria (após as antigas).
  IF cat_exp IS NOT NULL THEN
    SELECT COALESCE(MAX(ordem), 0) INTO ord_base
    FROM perguntas
    WHERE id_categoria = cat_exp
      AND texto NOT ILIKE '%Tablet para delivery%'
      AND texto NOT ILIKE '%delivery aberto e funcionando%'
      AND texto NOT ILIKE '%conduta do gerente responsável%'
      AND texto NOT ILIKE '%2 toques de mesa%'
      AND texto NOT ILIKE '%perguntas aos clientes após completarem%';

    UPDATE perguntas SET ordem = ord_base + 1
    WHERE id_categoria = cat_exp AND texto ILIKE '%Tablet para delivery%';
    UPDATE perguntas SET ordem = ord_base + 2
    WHERE id_categoria = cat_exp AND texto ILIKE '%delivery aberto e funcionando%';
    UPDATE perguntas SET ordem = ord_base + 3
    WHERE id_categoria = cat_exp AND texto ILIKE '%conduta do gerente responsável%';
    UPDATE perguntas SET ordem = ord_base + 4
    WHERE id_categoria = cat_exp AND texto ILIKE '%2 toques de mesa%';
    UPDATE perguntas SET ordem = ord_base + 5
    WHERE id_categoria = cat_exp AND texto ILIKE '%perguntas aos clientes após completarem%';
  END IF;

  IF cat_salao IS NOT NULL THEN
    SELECT COALESCE(MAX(ordem), 0) INTO ord_base
    FROM perguntas
    WHERE id_categoria = cat_salao
      AND texto NOT ILIKE '%banheiro em funcionamento para os clientes%';
    UPDATE perguntas SET ordem = ord_base + 1
    WHERE id_categoria = cat_salao AND texto ILIKE '%banheiro em funcionamento para os clientes%';
  END IF;

  IF cat_ext IS NOT NULL THEN
    SELECT COALESCE(MAX(ordem), 0) INTO ord_base
    FROM perguntas
    WHERE id_categoria = cat_ext
      AND texto NOT ILIKE '%Tetos, paredes, janelas e portas%'
      AND texto NOT ILIKE '%Luzes externas e sinalização%';
    UPDATE perguntas SET ordem = ord_base + 1
    WHERE id_categoria = cat_ext AND texto ILIKE '%Tetos, paredes, janelas e portas%';
    UPDATE perguntas SET ordem = ord_base + 2
    WHERE id_categoria = cat_ext AND texto ILIKE '%Luzes externas e sinalização%';
  END IF;

  IF cat_gente IS NOT NULL THEN
    SELECT COALESCE(MAX(ordem), 0) INTO ord_base
    FROM perguntas
    WHERE id_categoria = cat_gente
      AND texto NOT ILIKE '%três funcionários no plantão%'
      AND texto NOT ILIKE '%folhas de ponto estão assinadas%'
      AND texto NOT ILIKE '%uniformes são aprovados%'
      AND texto NOT ILIKE '%Joias e acessórios%'
      AND texto NOT ILIKE '%treinamento no BKU%'
      AND texto NOT ILIKE '%checklist aberto nos últimos 30 dias%';

    UPDATE perguntas SET ordem = ord_base + 1
    WHERE id_categoria = cat_gente AND texto ILIKE '%três funcionários no plantão%';
    UPDATE perguntas SET ordem = ord_base + 2
    WHERE id_categoria = cat_gente AND texto ILIKE '%folhas de ponto estão assinadas%';
    UPDATE perguntas SET ordem = ord_base + 3
    WHERE id_categoria = cat_gente AND texto ILIKE '%uniformes são aprovados%';
    UPDATE perguntas SET ordem = ord_base + 4
    WHERE id_categoria = cat_gente AND texto ILIKE '%Joias e acessórios%';
    UPDATE perguntas SET ordem = ord_base + 5
    WHERE id_categoria = cat_gente AND texto ILIKE '%treinamento no BKU%';
    UPDATE perguntas SET ordem = ord_base + 6
    WHERE id_categoria = cat_gente AND texto ILIKE '%checklist aberto nos últimos 30 dias%';
  END IF;

  -- Códigos temporários
  FOR r IN
    SELECT p.id_pergunta
    FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo
    ORDER BY c.ordem, p.ordem, p.id_pergunta
  LOOP
    n := n + 1;
    -- varchar(5): x0001 … x9999
    UPDATE perguntas SET codigo = 'x' || LPAD(n::text, 4, '0') WHERE id_pergunta = r.id_pergunta;
  END LOOP;

  -- Códigos finais sequenciais (01..99, depois 100...)
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
    SET
      codigo = CASE WHEN n < 100 THEN LPAD(n::text, 2, '0') ELSE n::text END,
      ordem = n
    WHERE id_pergunta = r.id_pergunta;
  END LOOP;
END $$;

COMMIT;
