-- Pontos críticos + Qualidade / Gerenciamento na Auditoria Operacional.
-- Foto obrigatória (tirar ou anexar) em todos os itens.
-- Idempotente: seções e perguntas só entram se ainda não existirem.

BEGIN;

DO $$
DECLARE
  v_tipo INT;
  cat_crit INT;
  cat_qual INT;
  v_cod INT;
  v_ordem INT;
  r RECORD;
BEGIN
  SELECT id_tipo_checklist INTO v_tipo
  FROM tipos_checklist
  WHERE codigo = 'auditoria_operacional';

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo auditoria_operacional não encontrado';
  END IF;

  -- Seções no início do checklist (antes de Tipo de coleta).
  SELECT id_categoria INTO cat_crit
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Pontos críticos'
  LIMIT 1;

  IF cat_crit IS NULL THEN
    UPDATE categorias_checklist
    SET ordem = ordem + 1
    WHERE id_tipo_checklist = v_tipo;

    INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Pontos críticos', 'warning', 1, v_tipo)
    RETURNING id_categoria INTO cat_crit;
  END IF;

  SELECT id_categoria INTO cat_qual
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Qualidade / Gerenciamento'
  LIMIT 1;

  IF cat_qual IS NULL THEN
    UPDATE categorias_checklist
    SET ordem = ordem + 1
    WHERE id_tipo_checklist = v_tipo
      AND ordem >= 2
      AND id_categoria <> cat_crit;

    INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Qualidade / Gerenciamento', 'verified', 2, v_tipo)
    RETURNING id_categoria INTO cat_qual;
  END IF;

  SELECT COALESCE(MAX(
    CASE WHEN p.codigo ~ '^\d+$' THEN p.codigo::int ELSE 0 END
  ), 0)
  INTO v_cod
  FROM perguntas p
  JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
  WHERE c.id_tipo_checklist = v_tipo;

  SELECT COALESCE(MAX(p.ordem), 0)
  INTO v_ordem
  FROM perguntas p
  JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
  WHERE c.id_tipo_checklist = v_tipo;

  FOR r IN
    SELECT * FROM (VALUES
      -- Pontos críticos (Sim = conforme, exceto as marcadas com sim_indica_problema)
      (
        cat_crit,
        'câmara fria está entre 1°C e 4°C',
        'A temperatura de alface, cebola, queijo e mix na câmara fria está entre 1°C e 4°C? Anexe foto da temperatura e da validade dos produtos.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'máquina de sorvete Taylor está entre 1°C',
        'A temperatura da máquina de sorvete Taylor está entre 1°C e 4°C, sem sujidade no batedor de shake e no agitador de mix? Anexe foto da temperatura e dos equipamentos.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'pia de lavagem das mãos está entre 38',
        'A temperatura da água quente na pia de lavagem das mãos está entre 38°C e 43°C? Anexe foto da temperatura.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'água quente no WOSH',
        'A temperatura da água quente no WOSH está entre 43°C e 48°C? Anexe foto da temperatura.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'carne/frango cozidos na PHU',
        'A temperatura da carne/frango cozidos na PHU está no mínimo 60°C? Anexe foto da temperatura.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'dispensador de gelo da máquina de refrigerante',
        'Foi encontrada alguma sujidade no dispensador de gelo da máquina de refrigerante? Anexe foto.',
        1.2, TRUE, TRUE
      ),
      (
        cat_crit,
        'sujidade em algum bico',
        'Foi encontrada sujidade em algum bico da máquina de refrigerante? Anexe foto.',
        1.2, TRUE, TRUE
      ),
      (
        cat_crit,
        'ponto preto ou pelo',
        'Foi encontrado algum ponto preto ou pelo em utensílios ou produtos? Anexe foto.',
        1.2, TRUE, TRUE
      ),
      (
        cat_crit,
        'alguma barata na loja',
        'Foi encontrada alguma barata na loja? Anexe foto.',
        1.2, TRUE, TRUE
      ),
      (
        cat_crit,
        'band-aid colorido e Petrogel',
        'Laudo da coifa, controle de pragas, ServSafe, Foundation, band-aid colorido e Petrogel estão disponíveis e vigentes? Anexe foto de cada evidência.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'kit de escovas Taylor',
        'O kit de escovas Taylor está presente e em boas condições? Anexe foto.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'saleiro está presente',
        'O saleiro está presente e em boas condições? Anexe foto.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'produtos alergênicos estão separados',
        'Os produtos alergênicos estão separados corretamente? Anexe foto.',
        1.2, TRUE, FALSE
      ),
      (
        cat_crit,
        'cursos de alergênicos dos colaboradores',
        'Os cursos de alergênicos dos colaboradores estão evidentes, juntamente com a escala de folgas? Anexe foto.',
        1.2, TRUE, FALSE
      ),

      -- Qualidade / Gerenciamento
      (
        cat_qual,
        'algum item vencido na loja',
        'Foi encontrado algum item vencido na loja? Anexe foto.',
        1.0, FALSE, TRUE
      ),
      (
        cat_qual,
        'qualidade e as condições dos pães',
        'A qualidade e as condições dos pães estão de acordo com o padrão? Anexe foto.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        'tostadeira está limpa e calibrada',
        'A tostadeira está limpa e calibrada? Anexe foto.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        'Whopper Ouro',
        'O membro da equipe sabe preparar o Whopper Ouro corretamente? Anexe foto da evidência.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        'algum equipamento com defeito',
        'Existe algum equipamento com defeito? Anexe foto.',
        1.0, FALSE, TRUE
      ),
      (
        cat_qual,
        'PLS está atualizada',
        'A PLS está atualizada? Anexe foto.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        'limpeza do broiler está',
        'A limpeza do broiler está de acordo com o padrão? Anexe foto.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        'limpeza da coifa está',
        'A limpeza da coifa está de acordo com o padrão? Anexe foto.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        '6 bobinas reservas do DSS',
        'O restaurante possui 6 bobinas reservas do DSS? Anexe foto.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        'escala dos membros de equipe',
        'A escala dos membros de equipe está disponível e atualizada? Anexe foto da escala.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        'guia de posicionamento está disponível',
        'O guia de posicionamento está disponível? Anexe foto do guia.',
        1.0, FALSE, FALSE
      ),
      (
        cat_qual,
        'curso DSS está completo',
        'O curso DSS está completo? Anexe foto da evidência.',
        1.0, FALSE, FALSE
      )
    ) AS t(id_cat, marker, texto, peso, critica, sim_prob)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM perguntas p
      JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
      WHERE c.id_tipo_checklist = v_tipo
        AND p.texto ILIKE '%' || r.marker || '%'
    ) THEN
      v_cod := v_cod + 1;
      v_ordem := v_ordem + 1;
      INSERT INTO perguntas (
        id_categoria, codigo, texto, tipo_resposta,
        obrigatoria, peso, ordem,
        requer_foto, requer_obs_em_nao, critica, sim_indica_problema, max_fotos
      )
      VALUES (
        r.id_cat,
        v_cod::text,
        r.texto,
        'sim_nao_foto',
        TRUE,
        r.peso,
        v_ordem,
        TRUE,
        TRUE,
        r.critica,
        r.sim_prob,
        5
      );
    END IF;
  END LOOP;

  UPDATE perguntas p
  SET max_fotos = 6
  FROM categorias_checklist c
  WHERE c.id_categoria = p.id_categoria
    AND c.id_tipo_checklist = v_tipo
    AND p.texto ILIKE '%band-aid colorido e Petrogel%';

  -- Remove duplicata se o marker antigo da tostadeira não batia no texto.
  DELETE FROM perguntas p
  WHERE p.texto = 'A tostadeira está limpa e calibrada? Anexe foto.'
    AND p.id_pergunta NOT IN (
      SELECT MIN(p2.id_pergunta)
      FROM perguntas p2
      JOIN categorias_checklist c2 ON c2.id_categoria = p2.id_categoria
      WHERE c2.id_tipo_checklist = v_tipo
        AND p2.texto = 'A tostadeira está limpa e calibrada? Anexe foto.'
    );
END $$;

COMMIT;
