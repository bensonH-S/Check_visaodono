BEGIN;

-- ⚠️  SQL DESTRUTIVO — exige: npm run migrate:checklist-time-campo -- --force
-- Apaga TODAS as respostas de visitas e substitui perguntas/seções do checklist.
-- NÃO apaga: usuários, lojas, chamados, visitas (ficam sem respostas).
-- O deploy.sh NÃO roda este arquivo.

-- Checklist Relatório Time de Campo (visita estrutural)
TRUNCATE respostas, perguntas, categorias_checklist RESTART IDENTITY;

INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('Dados da visita', 'assignment', 1);
INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('Itens primordiais', 'verified', 2);
INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('Calendário de limpeza, manutenção e equipamentos', 'event_note', 3);
INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('Indicadores de satisfação do cliente', 'trending_up', 4);
INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('Gerenciamento', 'manage_accounts', 5);
INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('Material de marketing', 'campaign', 6);
INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('Saúde do negócio', 'business', 7);
INSERT INTO categorias_checklist (nome, icone, ordem) VALUES ('Administrativo', 'description', 8);

-- Dados da visita
INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
(1, 'D01', 'Gerente da loja identificado e presente na visita?', 'sim_nao', TRUE, 1.0, 1, false, true, false),
(1, 'D02', 'Coordenadores de turno (1º dia, 2º dia e madrugada) registrados?', 'sim_nao', TRUE, 1.0, 2, false, true, false),
(1, 'D03', 'Território e quantidade do time total conferidos no relatório?', 'sim_nao', TRUE, 1.0, 3, false, true, false);

-- Itens primordiais (numeração do relatório original)
INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
(2, '01', 'Certificado Serv Safe em dia e disponível?', 'sim_nao', TRUE, 1.0, 4, false, true, false),
(2, '02', 'Certificado de dedetização vigente e documentado na pasta REV?', 'sim_nao', TRUE, 1.0, 5, false, true, false),
(2, '03', 'Certificado de limpeza da coifa vigente? (última limpeza registrada)', 'sim_nao', TRUE, 1.0, 6, false, true, false),
(2, '04', 'Checklist diário preenchido (Zenput)?', 'sim_nao', TRUE, 1.0, 7, false, true, false),
(2, '05', 'Certificado de licenciamento do estabelecimento em dia?', 'sim_nao', TRUE, 1.0, 8, false, true, false),
(2, '06', 'Escala de folga de funcionários e guia de posicionamento atualizados?', 'sim_nao', TRUE, 1.0, 9, false, true, false),
(2, '07', 'Armário Taylor em conformidade?', 'sim_nao', TRUE, 1.0, 10, false, true, false),
(2, '08', 'Escovas Taylor (4) e petrogel com validade em dia?', 'sim_nao', TRUE, 1.0, 11, false, true, false),
(2, '09', 'Produtos de limpeza com rótulos, validades e apenas itens homologados?', 'sim_nao', TRUE, 1.0, 12, false, true, false),
(2, '10', 'Identificação das PHUs conforme modelo Topema?', 'sim_nao', TRUE, 1.0, 13, false, true, false),
(2, '11', 'Todas as PHUs com abafadores e em bom estado?', 'sim_nao', TRUE, 1.0, 14, false, true, false),
(2, '12', 'Identificação da fritadeira completa (adesivo dia D — qualidade da batata)?', 'sim_nao', TRUE, 1.0, 15, false, true, false),
(2, '13', 'Medidor da qualidade do óleo disponível e teste realizado?', 'sim_nao', TRUE, 1.0, 16, false, true, false),
(2, '14', 'Identificação das lixeiras em conformidade?', 'sim_nao', TRUE, 1.0, 17, false, true, false),
(2, '15', 'Tabela dos 8 pontos críticos atualizada?', 'sim_nao', TRUE, 1.0, 18, false, true, false),
(2, '16', 'POP de higienização das mãos atualizado?', 'sim_nao', TRUE, 1.0, 19, false, true, false),
(2, '17', 'Tabela de retenção atualizada?', 'sim_nao', TRUE, 1.0, 20, false, true, false),
(2, '18', 'Fatiador de tomates sem avarias (equipamento e lâmina)?', 'sim_nao', TRUE, 1.0, 21, false, true, false),
(2, '19', 'Fita para medir concentração do sanitizante disponível?', 'sim_nao', TRUE, 1.0, 22, false, true, false),
(2, '20', 'Todos os produtos de limpeza estão identificados (datas visíveis)?', 'sim_nao', TRUE, 1.0, 23, false, true, false),
(2, '21', 'Band Aid colorido disponível e ninguém com piercing/bijuteria descoberta?', 'sim_nao', TRUE, 1.2, 24, false, true, true),
(2, '23', 'Luvas de corte e de recolher o lixo disponíveis e em quantidade adequada?', 'sim_nao', TRUE, 1.0, 25, false, true, false),
(2, '24', 'Todos os produtos estão dentro do prazo de validade?', 'sim_nao', TRUE, 1.0, 26, false, true, false),
(2, '26', 'Recipientes sem trincas? (kit REV/REC reserva de utensílios)', 'sim_nao', TRUE, 1.0, 27, false, true, false);

-- Calendário de limpeza, manutenção e equipamentos
INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
(3, 'C01', 'Piso da câmara congelada limpo e em condições adequadas?', 'sim_nao_foto', TRUE, 1.0, 28, false, true, false),
(3, 'C02', 'Pista do drive limpa (sem manchas de pneu/óleo)?', 'sim_nao_foto', TRUE, 1.0, 29, false, true, false),
(3, 'C03', 'Área externa em condições (matagal, obra, bitucas, lona drive)?', 'sim_nao_foto', TRUE, 1.0, 30, false, true, false),
(3, 'C04', 'Lista de manutenção atualizada e encaminhada por e-mail?', 'sim_nao', TRUE, 1.0, 31, false, true, false);

-- Indicadores de satisfação do cliente
INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
(4, 'I01', 'Resultado do Cliente Misterioso (CM) informado ao time?', 'sim_nao', TRUE, 1.0, 32, false, true, false),
(4, 'I02', 'NPS: time de gestores presente nos horários de pico e anfitriã atuante?', 'sim_nao', TRUE, 1.0, 33, false, true, false),
(4, 'I03', 'Rating Delivery dentro da meta (qualidade e erro zero)?', 'sim_nao', TRUE, 1.0, 34, false, true, false),
(4, 'I04', 'Cartinhas de incentivo à avaliação Delivery sendo enviadas?', 'sim_nao', TRUE, 1.0, 35, false, true, false),
(4, 'I05', 'Comentários das avaliações repassados a todo o time?', 'sim_nao', TRUE, 1.0, 36, false, true, false),
(4, 'I06', 'Google: anfitriã atuante e evolução da nota monitorada?', 'sim_nao', TRUE, 1.0, 37, false, true, false);

-- Gerenciamento
INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
(5, 'G01', 'Abertura dos sacos de pães conforme orientação (lado oposto da etiqueta)?', 'sim_nao', TRUE, 1.0, 38, false, true, false),
(5, 'G02', 'Política "sujou limpou" sendo aplicada nas mesas?', 'sim_nao', TRUE, 1.0, 39, false, true, false),
(5, 'G03', 'Sem ruptura de baldes e insumos críticos na operação?', 'sim_nao', TRUE, 1.0, 40, false, true, false),
(5, 'G04', 'Novatos treinados em lavagem correta das mãos ao entrar?', 'sim_nao', TRUE, 1.0, 41, false, true, false),
(5, 'G05', 'BKU dos novatos em andamento e cobrança da liderança?', 'sim_nao', TRUE, 1.0, 42, false, true, false),
(5, 'G06', 'Sem achados críticos em queijo (contaminação/pontinho preto)?', 'sim_nao_foto', TRUE, 1.2, 43, true, true, true),
(5, 'G07', 'Sem achados críticos na área de batata (ex.: cabelo)?', 'sim_nao_foto', TRUE, 1.2, 44, true, true, true);

-- Material de marketing
INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
(6, 'M01', 'Material de marketing atualizado (sem itens fora do cardápio no display)?', 'sim_nao_foto', TRUE, 1.0, 45, false, true, false);

-- Saúde do negócio
INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
(7, 'S01', 'Planilha CMV atualizada?', 'sim_nao', TRUE, 1.0, 46, false, true, false),
(7, 'S02', 'Controle de uso de insumos na mesa, sobremesas e batata?', 'sim_nao', TRUE, 1.0, 47, false, true, false),
(7, 'S03', 'Operação sem perda de venda em nenhuma faixa de horário?', 'sim_nao', TRUE, 1.0, 48, false, true, false);

-- Administrativo
INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
(8, 'A01', 'Folhas de ponto assinadas em dia?', 'sim_nao', TRUE, 1.0, 49, false, true, false),
(8, 'A02', 'Prazos das tarefas administrativas sendo cumpridos?', 'sim_nao', TRUE, 1.0, 50, false, true, false),
(8, 'A03', 'Protege em dia?', 'sim_nao', TRUE, 1.0, 51, false, true, false);

COMMIT;
