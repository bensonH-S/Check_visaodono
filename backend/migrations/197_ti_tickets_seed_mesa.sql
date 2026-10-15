-- Seed: demandas consolidadas da Mesa Redangular (ADM + CentralGA + Operações).

BEGIN;

INSERT INTO ti_tickets (titulo, descricao, status, prioridade, area, origem, ordem)
SELECT v.titulo, v.descricao, 'chamado', v.prioridade, v.area, 'mesa', v.ordem
FROM (VALUES
  -- Tecnologia e automação
  ('Integrar Agente Alvim aos grupos de WhatsApp', 'Coletar, resumir e apoiar divulgação das informações, com etapa de conferência.', 'alta', 'tecnologia', 10),
  ('Automatizar conciliações dos caixas', 'Automação das conciliações de caixa das lojas.', 'alta', 'tecnologia', 20),
  ('Plano de implantação da automação de e-mails', 'Estruturar o plano de implantação da automação dos e-mails.', 'media', 'tecnologia', 30),
  ('Automatizar conferência e organização do Drive', 'Conferência e organização automática dos arquivos no Drive.', 'media', 'tecnologia', 40),
  ('NF → agendamento e organização financeira', 'Evoluir o sistema para que a entrada da nota fiscal encaminhe informações ao agendamento e à organização financeira.', 'alta', 'tecnologia', 50),
  ('RH: folhas e contratos com apoio de IA', 'Organizar folhas de pagamento e contratos com apoio de IA.', 'media', 'rh', 60),
  ('Ampliar APIs e IA nas rotinas administrativas', 'APIs e IA em rotinas administrativas, conciliações e atendimento ao cliente.', 'media', 'tecnologia', 70),

  -- Financeiro e reembolsos
  ('Processo de reembolso Kings → Meridian', 'Organizar o processo de reembolso realizado pelas Kings e sua execução pelo Meridian.', 'alta', 'financeiro', 80),
  ('Corrigir fluxo de freelancers', 'Confirmações tardias dos regionais, faltas não informadas e dados inconsistentes.', 'alta', 'financeiro', 90),
  ('Comprovantes automáticos no sistema', 'Integração para disponibilizar comprovantes automaticamente e encaminhar ao gestor.', 'alta', 'financeiro', 100),
  ('Alinhar tratativas gestores × ADM', 'Alinhar comunicação e tratativas entre gestores e ADM.', 'media', 'financeiro', 110),
  ('Acompanhar estornos e orçamentos (Financeiro)', 'Manter com o Financeiro o acompanhamento dos estornos e dos orçamentos.', 'media', 'financeiro', 120),
  ('Cadastrar impostos por restaurante', 'Organizar impostos por restaurante, garantindo atribuição à loja correta.', 'media', 'financeiro', 130),
  ('Reforçar uso de contas-salário', 'Reforçar com os gestores o uso de contas-salário para colaboradores registrados.', 'baixa', 'financeiro', 140),
  ('Boletos a terceiros só com confirmação do Felipe', 'Não encaminhar boletos para pagamento a terceiros sem confirmação prévia do Felipe.', 'alta', 'financeiro', 150),

  -- Estornos
  ('Formulário de duplicidade de estorno', 'Criar formulário para casos de duplicidade, envio somente com informações completas.', 'alta', 'financeiro', 160),
  ('Padronizar comunicação de estorno ao cliente', 'Padronizar a comunicação ao cliente sobre o procedimento de estorno.', 'media', 'financeiro', 170),
  ('Auditoria na confirmação dos estornos', 'Incluir a Auditoria na confirmação da execução dos estornos.', 'media', 'financeiro', 180),

  -- Conciliação / gestores
  ('Reforçar conciliação Platlog (dupla/tripla checagem)', 'Reforçar importância da conciliação da Platlog com dupla ou tripla checagem.', 'alta', 'operacoes', 190),
  ('Tratar conciliação Platlog em reunião', 'Tratar o assunto em reunião, além do comunicado escrito.', 'media', 'operacoes', 200),
  ('Demonstrar evoluções Meridian e CentralGA', 'Demonstrar aos gestores as evoluções do Meridian e da CentralGA.', 'media', 'operacoes', 210),

  -- Operações prioritárias
  ('Tecnologia de apoio a pedidos e pendências', 'Desenvolver tecnologia para apoiar pedidos e alertar sobre pendências.', 'alta', 'operacoes', 220),
  ('Ferramentas de apoio às contratações', 'Criar ferramentas de apoio às contratações.', 'media', 'operacoes', 230),
  ('Agilidade dos retornos do escritório às lojas', 'Melhorar a agilidade dos retornos do escritório às lojas.', 'alta', 'operacoes', 240),
  ('Controle de estoques (menos transferências)', 'Aprimorar controle dos estoques, reduzindo necessidade recorrente de transferências.', 'alta', 'operacoes', 250),
  ('Acompanhar produtividade via CentralGA', 'Acompanhar a produtividade de perto utilizando os dados da CentralGA.', 'media', 'operacoes', 260),
  ('Experiência do cliente como prioridade máxima', 'Tratar a experiência do cliente como prioridade máxima.', 'alta', 'operacoes', 270),
  ('Avaliar DRE de caixa diária + CMV', 'DRE de caixa a partir dos extratos, atualização diária; definir integração para CMV.', 'alta', 'financeiro', 280),
  ('Evoluir alertas do Zenput (Meridian)', 'Evoluir os alertas do Zenput, já em tratamento no Meridian.', 'media', 'tecnologia', 290),
  ('Notificar aumentos de preços Platlog no app', 'Notificar no aplicativo os aumentos de preços da Platlog.', 'media', 'tecnologia', 300),
  ('Ampliar espaço do e-mail do Clemerson', 'Ampliar o espaço do e-mail do Clemerson.', 'baixa', 'tecnologia', 310),
  ('Aprovar compra de 3 tablets para LTs', 'Encaminhar para aprovação a compra de três tablets para os LTs.', 'media', 'operacoes', 320),
  ('Agente de pendências e BKUs', 'Criar agente para identificar pendências e acompanhar os BKUs.', 'alta', 'tecnologia', 330),
  ('Comunicados diários de vendas e metas', 'Avaliar comunicados diários de vendas e metas para os gestores.', 'media', 'operacoes', 340),

  -- Controles diários e metas
  ('Cobrança de faltas e desvios nas metas', 'Iniciar cobrança de faltas e desvios, com impacto nas metas conforme critérios a definir.', 'alta', 'operacoes', 350),
  ('Comunicar novos valores do sistema de metas', 'Consolidar e comunicar os novos valores do sistema de metas.', 'alta', 'operacoes', 360),
  ('Incluir CL do anfitrião para o gerente', 'Incluir para o gerente o CL do anfitrião.', 'media', 'operacoes', 370),
  ('Portas dos fundos e estoques trancados', 'Reforçar orientação de manter portas dos fundos e estoques trancados.', 'media', 'operacoes', 380),
  ('Instalar alertas nas portas dos fundos', 'Encaminhar a instalação dos alertas nas portas dos fundos.', 'media', 'manutencao', 390),

  -- Manutenção
  ('Manutenção Regional Plínio — 2 profissionais', 'Registro de dois profissionais de manutenção atendendo às demandas (Plínio).', 'media', 'manutencao', 400),
  ('Manutenção Regional Bárbara — 2 profissionais', 'Registro de dois profissionais de manutenção atendendo às demandas (Bárbara).', 'media', 'manutencao', 410),
  ('Manutenção Regional Fagno — substituir 2', 'Necessidade de substituir dois profissionais (Fagno).', 'alta', 'manutencao', 420),
  ('Gestor acompanha checklist da manutenção', 'Gestor responsável por acompanhar cumprimento do checklist quando a manutenção estiver na loja.', 'media', 'manutencao', 430),
  ('Tinta de maior durabilidade (drive/meios-fio)', 'Avaliar tinta de maior durabilidade para pista do drive e meios-fios.', 'baixa', 'manutencao', 440),
  ('Amarelo nos meios-fios no lugar do branco', 'Confirmar possibilidade de utilizar amarelo nos meios-fios em substituição ao branco.', 'baixa', 'manutencao', 450),

  -- LTs definidos (registro)
  ('LTs definidos — Satélite / Norte / Sul', 'Satélite: Harley · Norte: Gabriela Camilo · Sul: Julia.', 'baixa', 'operacoes', 460),

  -- Pontos que precisam de complementação
  ('Complementar: escopo da frente Benson', 'Definir escopo da nova frente de trabalho do Benson.', 'alta', 'tecnologia', 470),
  ('Complementar: exclusão de pagamento de Pix', 'Esclarecer significado e alcance da anotação "exclusão de pagamento de Pix".', 'media', 'financeiro', 480),
  ('Complementar: auxílio R$ 20 em manutenção', 'Finalidade e condições do auxílio de R$ 20 citado em manutenção.', 'media', 'manutencao', 490),
  ('Complementar: CL anfitrião e metas', 'Detalhar CL do anfitrião e alterações no sistema de metas.', 'media', 'operacoes', 500)
) AS v(titulo, descricao, prioridade, area, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM ti_tickets t WHERE t.titulo = v.titulo AND t.origem = 'mesa'
);

COMMIT;
