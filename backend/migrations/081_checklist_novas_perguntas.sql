-- Novas perguntas na Auditoria Operacional + suporte a N/A já existe no enum.
-- Idempotente: só insere se o código ainda não existir no tipo.

BEGIN;

DO $$
DECLARE
  v_tipo INT;
  cat_gente INT;
  cat_exp INT;
  cat_salao INT;
  cat_ext INT;
  v_ordem INT;
BEGIN
  SELECT id_tipo_checklist INTO v_tipo
  FROM tipos_checklist
  WHERE codigo = 'auditoria_operacional';

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Tipo auditoria_operacional não encontrado';
  END IF;

  SELECT id_categoria INTO cat_gente
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Gente e labor'
  LIMIT 1;

  SELECT id_categoria INTO cat_exp
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Experiência do cliente'
  LIMIT 1;

  SELECT id_categoria INTO cat_salao
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Salão'
  LIMIT 1;

  SELECT id_categoria INTO cat_ext
  FROM categorias_checklist
  WHERE id_tipo_checklist = v_tipo AND nome = 'Área externa e drive'
  LIMIT 1;

  IF cat_gente IS NULL OR cat_exp IS NULL OR cat_salao IS NULL OR cat_ext IS NULL THEN
    RAISE EXCEPTION 'Categorias da Auditoria Operacional incompletas (Gente/Experiência/Salão/Área externa)';
  END IF;

  SELECT COALESCE(MAX(p.ordem), 0) INTO v_ordem
  FROM perguntas p
  JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
  WHERE c.id_tipo_checklist = v_tipo;

  -- Gente e labor
  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '87'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_gente, '87',
      'Existem pelo menos três funcionários no plantão? (Caso não tenha, manter restaurante fechado pois afeta a segurança alimentar)',
      'sim_nao', TRUE, 1.2, v_ordem, false, true, true
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '88'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_gente, '88',
      'Todas as folhas de ponto estão assinadas?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '89'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_gente, '89',
      'Todos os uniformes são aprovados e em boas condições?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '90'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_gente, '90',
      'Joias e acessórios são usados de acordo com os padrões?',
      'sim_nao', TRUE, 1.2, v_ordem, false, true, true
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '91'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_gente, '91',
      'A porcentagem de conclusão no treinamento no BKU está acima de 95%?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '92'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_gente, '92',
      'Tem algum checklist aberto nos últimos 30 dias?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  -- Experiência do cliente / delivery
  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '93'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_exp, '93',
      'Loja possui Tablet para delivery carregado, portais abertos, todos os itens disponíveis?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '94'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_exp, '94',
      'O restaurante possui delivery aberto e funcionando?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '95'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_exp, '95',
      'A conduta do gerente responsável impulsiona a velocidade do serviço?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '96'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_exp, '96',
      'A liderança realiza pelo menos 2 toques de mesa por hora enquanto tiver cliente no salão?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '97'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_exp, '97',
      'Realiza as perguntas aos clientes após completarem suas refeições?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  -- Salão
  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '98'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_salao, '98',
      'O restaurante possui pelo menos um banheiro em funcionamento para os clientes?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  -- Área externa
  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '99'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_ext, '99',
      'Tetos, paredes, janelas e portas estão limpos e em boas condições?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM perguntas p
    JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
    WHERE c.id_tipo_checklist = v_tipo AND p.codigo = '100'
  ) THEN
    v_ordem := v_ordem + 1;
    INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica)
    VALUES (
      cat_ext, '100',
      'Luzes externas e sinalização (incluindo luzes do prédio, luzes do estacionamento e sinalização) estão limpas e em boas condições?',
      'sim_nao', TRUE, 1.0, v_ordem, false, true, false
    );
  END IF;
END $$;

COMMIT;
