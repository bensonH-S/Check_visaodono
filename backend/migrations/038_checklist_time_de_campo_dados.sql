BEGIN;

-- Insere perguntas do Relatório Time de Campo (independente da Auditoria Operacional).
-- Pré-requisito: npm run migrate:tipos-checklist

DO $$
DECLARE
  v_tipo INT;
  c1 INT; c2 INT; c3 INT; c4 INT; c5 INT; c6 INT; c7 INT;
BEGIN
  SELECT id_tipo_checklist INTO v_tipo FROM tipos_checklist WHERE codigo = 'time_de_campo';
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Rode antes: npm run migrate:tipos-checklist';
  END IF;

  IF EXISTS (SELECT 1 FROM categorias_checklist WHERE id_tipo_checklist = v_tipo LIMIT 1) THEN
    RAISE NOTICE 'Time de Campo já cadastrado — nenhuma alteração.';
    RETURN;
  END IF;

  INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Itens primordiais', 'verified', 1, v_tipo) RETURNING id_categoria INTO c1;
  INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Calendário de limpeza, manutenção e equipamentos', 'event_note', 2, v_tipo) RETURNING id_categoria INTO c2;
  INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Indicadores de satisfação do cliente', 'trending_up', 3, v_tipo) RETURNING id_categoria INTO c3;
  INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Gerenciamento', 'manage_accounts', 4, v_tipo) RETURNING id_categoria INTO c4;
  INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Material de marketing', 'campaign', 5, v_tipo) RETURNING id_categoria INTO c5;
  INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Saúde do negócio', 'business', 6, v_tipo) RETURNING id_categoria INTO c6;
  INSERT INTO categorias_checklist (nome, icone, ordem, id_tipo_checklist)
    VALUES ('Administrativo', 'description', 7, v_tipo) RETURNING id_categoria INTO c7;

  INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
  (c1, '01', 'Certificado Serv Safe em dia e disponível?', 'sim_nao', TRUE, 1.0, 1, false, true, false),
  (c1, '02', 'Certificado de dedetização vigente e documentado na pasta REV?', 'sim_nao', TRUE, 1.0, 2, false, true, false),
  (c1, '03', 'Certificado de limpeza da coifa vigente? (última limpeza registrada)', 'sim_nao', TRUE, 1.0, 3, false, true, false),
  (c1, '04', 'Checklist diário preenchido (Zenput)?', 'sim_nao', TRUE, 1.0, 4, false, true, false),
  (c1, '05', 'Certificado de licenciamento do estabelecimento em dia?', 'sim_nao', TRUE, 1.0, 5, false, true, false),
  (c1, '06', 'Escala de folga de funcionários e guia de posicionamento atualizados?', 'sim_nao', TRUE, 1.0, 6, false, true, false),
  (c1, '07', 'Armário Taylor em conformidade?', 'sim_nao', TRUE, 1.0, 7, false, true, false),
  (c1, '08', 'Escovas Taylor (4) e petrogel com validade em dia?', 'sim_nao', TRUE, 1.0, 8, false, true, false),
  (c1, '09', 'Produtos de limpeza com rótulos, validades e apenas itens homologados?', 'sim_nao', TRUE, 1.0, 9, false, true, false),
  (c1, '10', 'Identificação das PHUs conforme modelo Topema?', 'sim_nao', TRUE, 1.0, 10, false, true, false),
  (c1, '11', 'Todas as PHUs com abafadores e em bom estado?', 'sim_nao', TRUE, 1.0, 11, false, true, false),
  (c1, '12', 'Identificação da fritadeira completa (adesivo dia D — qualidade da batata)?', 'sim_nao', TRUE, 1.0, 12, false, true, false),
  (c1, '13', 'Medidor da qualidade do óleo disponível e teste realizado?', 'sim_nao', TRUE, 1.0, 13, false, true, false),
  (c1, '14', 'Identificação das lixeiras em conformidade?', 'sim_nao', TRUE, 1.0, 14, false, true, false),
  (c1, '15', 'Tabela dos 8 pontos críticos atualizada?', 'sim_nao', TRUE, 1.0, 15, false, true, false),
  (c1, '16', 'POP de higienização das mãos atualizado?', 'sim_nao', TRUE, 1.0, 16, false, true, false),
  (c1, '17', 'Tabela de retenção atualizada?', 'sim_nao', TRUE, 1.0, 17, false, true, false),
  (c1, '18', 'Fatiador de tomates sem avarias (equipamento e lâmina)?', 'sim_nao', TRUE, 1.0, 18, false, true, false),
  (c1, '19', 'Fita para medir concentração do sanitizante disponível?', 'sim_nao', TRUE, 1.0, 19, false, true, false),
  (c1, '20', 'Todos os produtos de limpeza estão identificados (datas visíveis)?', 'sim_nao', TRUE, 1.0, 20, false, true, false),
  (c1, '21', 'Band Aid colorido disponível e ninguém com piercing/bijuteria descoberta?', 'sim_nao', TRUE, 1.2, 21, false, true, true),
  (c1, '23', 'Luvas de corte e de recolher o lixo disponíveis e em quantidade adequada?', 'sim_nao', TRUE, 1.0, 22, false, true, false),
  (c1, '24', 'Todos os produtos estão dentro do prazo de validade?', 'sim_nao', TRUE, 1.0, 23, false, true, false),
  (c1, '26', 'Recipientes sem trincas? (kit REV/REC reserva de utensílios)', 'sim_nao', TRUE, 1.0, 24, false, true, false);

  INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
  (c2, 'C01', 'Piso da câmara congelada limpo e em condições adequadas?', 'sim_nao_foto', TRUE, 1.0, 25, false, true, false),
  (c2, 'C02', 'Pista do drive limpa (sem manchas de pneu/óleo)?', 'sim_nao_foto', TRUE, 1.0, 26, false, true, false),
  (c2, 'C03', 'Área externa em condições (matagal, obra, bitucas, lona drive)?', 'sim_nao_foto', TRUE, 1.0, 27, false, true, false),
  (c2, 'C04', 'Lista de manutenção atualizada e encaminhada por e-mail?', 'sim_nao', TRUE, 1.0, 28, false, true, false);

  INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
  (c3, 'I01', 'Resultado do Cliente Misterioso (CM) informado a todo o time?', 'sim_nao', TRUE, 1.0, 29, false, true, false),
  (c3, 'I02', 'NPS: time de gestores presente nos horários de pico e anfitriã atuante?', 'sim_nao', TRUE, 1.0, 30, false, true, false),
  (c3, 'I03', 'Rating Delivery dentro da meta (qualidade e erro zero)?', 'sim_nao', TRUE, 1.0, 31, false, true, false),
  (c3, 'I04', 'Cartinhas de incentivo à avaliação Delivery sendo enviadas?', 'sim_nao', TRUE, 1.0, 32, false, true, false),
  (c3, 'I05', 'Comentários das avaliações repassados a todo o time?', 'sim_nao', TRUE, 1.0, 33, false, true, false),
  (c3, 'I06', 'Google: anfitriã atuante e evolução da nota monitorada?', 'sim_nao', TRUE, 1.0, 34, false, true, false),
  (c3, 'I07', 'Resultados dos indicadores informados sempre a todo o time?', 'sim_nao', TRUE, 1.0, 35, false, true, false);

  INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
  (c4, 'G01', 'Abertura dos sacos de pães conforme orientação (lado oposto da etiqueta)?', 'sim_nao', TRUE, 1.0, 36, false, true, false),
  (c4, 'G02', 'Política "sujou limpou" sendo aplicada nas mesas?', 'sim_nao', TRUE, 1.0, 37, false, true, false),
  (c4, 'G03', 'Sem ruptura de baldes e insumos críticos na operação?', 'sim_nao', TRUE, 1.0, 38, false, true, false),
  (c4, 'G04', 'Novatos treinados em lavagem correta das mãos ao entrar?', 'sim_nao', TRUE, 1.0, 39, false, true, false),
  (c4, 'G05', 'BKU dos novatos em andamento e cobrança da liderança?', 'sim_nao', TRUE, 1.0, 40, false, true, false),
  (c4, 'G06', 'Sem achados críticos em queijo (contaminação/pontinho preto)?', 'sim_nao_foto', TRUE, 1.2, 41, true, true, true),
  (c4, 'G07', 'Sem achados críticos na área de batata (ex.: cabelo)?', 'sim_nao_foto', TRUE, 1.2, 42, true, true, true);

  INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
  (c5, 'M01', 'Material de marketing atualizado (sem itens fora do cardápio no display)?', 'sim_nao_foto', TRUE, 1.0, 43, false, true, false);

  INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
  (c6, 'S01', 'Planilha CMV atualizada?', 'sim_nao', TRUE, 1.0, 44, false, true, false),
  (c6, 'S02', 'Controle de uso de insumos na mesa, sobremesas e batata?', 'sim_nao', TRUE, 1.0, 45, false, true, false),
  (c6, 'S03', 'Operação sem perda de venda em nenhuma faixa de horário?', 'sim_nao', TRUE, 1.0, 46, false, true, false);

  INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
  (c7, 'A01', 'Folhas de ponto assinadas em dia?', 'sim_nao', TRUE, 1.0, 47, false, true, false),
  (c7, 'A02', 'Prazos das tarefas administrativas sendo cumpridos?', 'sim_nao', TRUE, 1.0, 48, false, true, false),
  (c7, 'A03', 'Protege em dia?', 'sim_nao', TRUE, 1.0, 49, false, true, false);

  RAISE NOTICE 'Relatório Time de Campo cadastrado (49 perguntas, 7 seções).';
END $$;

COMMIT;
