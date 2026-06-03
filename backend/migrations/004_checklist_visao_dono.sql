BEGIN;

-- Novos campos para tipos de resposta (estrelas, sim/não, foto)
DO $$ BEGIN
  CREATE TYPE tipo_resposta_checklist AS ENUM ('estrelas', 'sim_nao', 'estrelas_foto', 'sim_nao_foto');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE perguntas
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(5),
  ADD COLUMN IF NOT EXISTS tipo_resposta tipo_resposta_checklist NOT NULL DEFAULT 'sim_nao',
  ADD COLUMN IF NOT EXISTS critica BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE respostas
  ADD COLUMN IF NOT EXISTS nota_estrelas SMALLINT CHECK (nota_estrelas IS NULL OR (nota_estrelas >= 1 AND nota_estrelas <= 5)),
  ALTER COLUMN resposta DROP NOT NULL;

-- Recalcula nota: estrelas (1-5 → %) + Sim/Não
CREATE OR REPLACE FUNCTION fn_atualizar_nota_visita()
RETURNS TRIGGER AS $$
DECLARE
    v_nota NUMERIC(5,2);
BEGIN
    SELECT ROUND(AVG(
        CASE
            WHEN p.tipo_resposta IN ('estrelas', 'estrelas_foto') AND r.nota_estrelas IS NOT NULL
                THEN (r.nota_estrelas::numeric / 5.0) * 100
            WHEN r.resposta = 'Sim' THEN 100
            WHEN r.resposta = 'Não' THEN 0
            WHEN r.resposta = 'N/A' THEN 50
            ELSE NULL
        END * p.peso
    )::numeric, 2)
    INTO v_nota
    FROM respostas r
    JOIN perguntas p ON r.id_pergunta = p.id_pergunta
    WHERE r.id_visita = COALESCE(NEW.id_visita, OLD.id_visita)
      AND (
        r.nota_estrelas IS NOT NULL
        OR r.resposta IS NOT NULL
      );

    UPDATE visitas
    SET nota_final = v_nota, updated_at = NOW()
    WHERE id_visita = COALESCE(NEW.id_visita, OLD.id_visita);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Substituir perguntas antigas (reinicia IDs 1–7)
TRUNCATE respostas, perguntas, categorias_checklist RESTART IDENTITY;

INSERT INTO categorias_checklist (nome, icone, ordem) VALUES
('Experiência do cliente', 'users', 1),
('Qualidade do produto', 'food', 2),
('Limpeza e conservação', 'clean', 3),
('Liderança e cultura', 'leader', 4),
('Patrimônio e manutenção', 'tools', 5),
('Rentabilidade e controle', 'chart', 6),
('Segurança e documentos', 'shield', 7);

INSERT INTO perguntas (id_categoria, codigo, texto, tipo_resposta, obrigatoria, peso, ordem, requer_foto, requer_obs_em_nao, critica) VALUES
-- 1. Experiência do cliente
(1, '01', 'Qual a nota geral da experiência ao entrar na loja? (impacto visual, cheiro, som, temperatura)', 'estrelas', TRUE, 1.0, 1, FALSE, FALSE, FALSE),
(1, '02', 'Os colaboradores demonstram energia, disposição e atenção ao cliente?', 'estrelas', TRUE, 1.0, 2, FALSE, FALSE, FALSE),
(1, '03', 'Os 5 passos de atendimento são seguidos corretamente?', 'sim_nao', TRUE, 1.2, 3, FALSE, TRUE, TRUE),
(1, '04', 'Tempo de atendimento dentro do padrão TMA/TME (03:30)?', 'sim_nao', TRUE, 1.0, 4, FALSE, FALSE, FALSE),
(1, '05', 'Todos os itens do menu estão disponíveis? (sem ruptura no totem)', 'sim_nao', TRUE, 1.0, 5, FALSE, FALSE, FALSE),
(1, '06', 'O Líder de Experiência está presente no salão interagindo ativamente com os clientes?', 'sim_nao', TRUE, 1.2, 6, FALSE, TRUE, TRUE),
-- 2. Qualidade do produto
(2, '07', 'Qual a qualidade visual do sanduíche entregue (montagem, apresentação, porção)?', 'estrelas_foto', TRUE, 1.0, 7, TRUE, FALSE, FALSE),
(2, '08', 'As batatas fritas estão no ponto ideal de crocância e temperatura?', 'estrelas', TRUE, 1.0, 8, FALSE, FALSE, FALSE),
(2, '09', 'A qualidade dos hortifruti está dentro do padrão? (alface, tomate, cebola)', 'sim_nao_foto', TRUE, 1.2, 9, TRUE, TRUE, TRUE),
(2, '10', 'A qualidade das carnes na PHU está de acordo com os padrões de temperatura e suculência?', 'sim_nao_foto', TRUE, 1.2, 10, TRUE, TRUE, TRUE),
(2, '11', 'Produtos potencialmente perigosos atendem aos padrões mínimos de temperatura?', 'sim_nao', TRUE, 1.2, 11, FALSE, TRUE, TRUE),
-- 3. Limpeza e conservação
(3, '12', 'Qual a nota geral de limpeza e conservação da loja? (fachada, salão, cozinha)', 'estrelas_foto', TRUE, 1.0, 12, TRUE, FALSE, FALSE),
(3, '13', 'Salão — mesas, cadeiras, sofás e decoração estão limpos e sem danos visíveis?', 'sim_nao_foto', TRUE, 1.0, 13, TRUE, FALSE, FALSE),
(3, '14', 'Banheiros estão limpos, abastecidos e em bom estado de conservação?', 'sim_nao', TRUE, 1.0, 14, FALSE, FALSE, FALSE),
(3, '15', 'Pisos, paredes, ralos e teto da área interna estão limpos e conservados?', 'sim_nao_foto', TRUE, 1.0, 15, TRUE, FALSE, FALSE),
(3, '16', 'Broiler, fritadeira e tostadeiras estão limpos?', 'sim_nao_foto', TRUE, 1.0, 16, TRUE, FALSE, FALSE),
(3, '17', 'Câmara fria e freezers estão limpos, sem ferrugem nas estantes e sem produto no chão?', 'sim_nao_foto', TRUE, 1.2, 17, TRUE, TRUE, FALSE),
(3, '18', 'Área externa — fachada, calçada e entorno estão limpos e sem acúmulo de caixas ou sujeira?', 'sim_nao_foto', TRUE, 1.0, 18, TRUE, FALSE, FALSE),
-- 4. Liderança e cultura
(4, '19', 'O gerente de turno demonstra presença ativa, senso de urgência e controle do restaurante?', 'estrelas', TRUE, 1.0, 19, FALSE, FALSE, FALSE),
(4, '20', 'A equipe demonstra conhecer os processos sem depender constantemente de supervisão?', 'estrelas', TRUE, 1.0, 20, FALSE, FALSE, FALSE),
(4, '21', 'A liderança está posicionada no balcão nos horários de pico?', 'sim_nao', TRUE, 1.0, 21, FALSE, FALSE, FALSE),
(4, '22', 'O quadro de equipe está completo? (lideranças e LEC presentes)', 'sim_nao', TRUE, 1.0, 22, FALSE, FALSE, FALSE),
(4, '23', 'O King Board está atualizado e em uso?', 'sim_nao', TRUE, 1.0, 23, FALSE, FALSE, FALSE),
(4, '24', 'O sistema de gerenciamento de cozinha (Tabela PLS) está atualizado e em uso?', 'sim_nao', TRUE, 1.0, 24, FALSE, FALSE, FALSE),
-- 5. Patrimônio e manutenção
(5, '25', 'A estrutura física da loja passa impressão de cuidado e investimento ao cliente?', 'estrelas', TRUE, 1.0, 25, FALSE, FALSE, FALSE),
(5, '26', 'Há equipamentos com necessidade de manutenção corretiva não reportada?', 'sim_nao_foto', TRUE, 1.0, 26, TRUE, FALSE, FALSE),
(5, '27', 'Há danos em mobiliário, paredes, pisos ou fachada sem plano de ação aberto?', 'sim_nao_foto', TRUE, 1.0, 27, TRUE, FALSE, FALSE),
(5, '28', 'Totens de autoatendimento estão limpos e funcionando corretamente?', 'sim_nao', TRUE, 1.0, 28, FALSE, FALSE, FALSE),
(5, '29', 'Iluminação interna está funcionando completamente (sem lâmpadas queimadas ou de tonalidade diferente)?', 'sim_nao_foto', TRUE, 1.0, 29, TRUE, FALSE, FALSE),
(5, '30', 'Há risco de acidente visível para colaboradores ou clientes? (piso molhado sem placa, fio exposto, etc.)', 'sim_nao_foto', TRUE, 1.2, 30, TRUE, TRUE, TRUE),
-- 6. Rentabilidade e controle
(6, '31', 'O gerente sabe informar o resultado de vendas do dia/semana sem consultar sistema?', 'estrelas', TRUE, 1.0, 31, FALSE, FALSE, FALSE),
(6, '32', 'Há desperdício visível de produto? (descarte excessivo, porções fora do padrão)', 'sim_nao_foto', TRUE, 1.0, 32, TRUE, FALSE, FALSE),
(6, '33', 'O restaurante realiza o cálculo de Overrun da máquina de sorvete diariamente?', 'sim_nao', TRUE, 1.0, 33, FALSE, FALSE, FALSE),
(6, '34', 'O sistema de rotação PVPS está sendo aplicado corretamente no estoque?', 'sim_nao', TRUE, 1.0, 34, FALSE, FALSE, FALSE),
(6, '35', 'O responsável conhece a nota atual da loja no Google/iFood e há respostas pendentes?', 'sim_nao', TRUE, 1.0, 35, FALSE, FALSE, FALSE),
-- 7. Segurança e documentos
(7, '36', 'Foi identificada oportunidade de contaminação cruzada durante a visita?', 'sim_nao_foto', TRUE, 1.2, 36, TRUE, TRUE, TRUE),
(7, '37', 'Pragas — foi encontrado evidência de roedores, baratas ou moscas?', 'sim_nao_foto', TRUE, 1.2, 37, TRUE, TRUE, TRUE),
(7, '38', 'O laudo de limpeza da exaustão e o relatório de controle de pragas estão válidos?', 'sim_nao', TRUE, 1.0, 38, FALSE, FALSE, FALSE),
(7, '39', 'O plano de ação da última visita está 100% aprovado?', 'sim_nao', TRUE, 1.2, 39, FALSE, TRUE, TRUE),
(7, '40', 'Certificado ServSafe disponível e válido para o responsável?', 'sim_nao', TRUE, 1.0, 40, FALSE, FALSE, FALSE);

COMMIT;
