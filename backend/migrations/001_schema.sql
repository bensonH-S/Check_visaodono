-- Vision Check — Grupo Alvim (PostgreSQL)
-- Gestão operacional de lojas BK

BEGIN;

-- Limpar schema anterior
DROP VIEW IF EXISTS vw_metricas_dashboard CASCADE;
DROP VIEW IF EXISTS vw_ranking_lojas CASCADE;
DROP TRIGGER IF EXISTS trg_resposta_nota ON respostas;
DROP TRIGGER IF EXISTS trg_visita_loja ON visitas;
DROP FUNCTION IF EXISTS fn_atualizar_nota_visita() CASCADE;
DROP FUNCTION IF EXISTS fn_atualizar_loja_apos_visita() CASCADE;

DROP TABLE IF EXISTS historico_notas CASCADE;
DROP TABLE IF EXISTS nao_conformidades CASCADE;
DROP TABLE IF EXISTS respostas CASCADE;
DROP TABLE IF EXISTS visitas CASCADE;
DROP TABLE IF EXISTS perguntas CASCADE;
DROP TABLE IF EXISTS categorias_checklist CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS lojas CASCADE;

DROP TYPE IF EXISTS status_loja CASCADE;
DROP TYPE IF EXISTS status_visita CASCADE;
DROP TYPE IF EXISTS resposta_checklist CASCADE;
DROP TYPE IF EXISTS gravidade_nc CASCADE;
DROP TYPE IF EXISTS status_nc CASCADE;

-- ENUMs
CREATE TYPE status_loja AS ENUM ('Ativa', 'Inativa', 'Alerta');
CREATE TYPE status_visita AS ENUM ('Rascunho', 'Finalizada');
CREATE TYPE resposta_checklist AS ENUM ('Sim', 'Não', 'N/A');
CREATE TYPE gravidade_nc AS ENUM ('Crítica', 'Moderada', 'Baixa');
CREATE TYPE status_nc AS ENUM ('Em aberto', 'Resolvida', 'Em andamento');

-- 1. Lojas
CREATE TABLE lojas (
    id_loja SERIAL PRIMARY KEY,
    codigo_bkn VARCHAR(20) UNIQUE NOT NULL,
    nome_loja VARCHAR(100) NOT NULL,
    setor VARCHAR(60),
    endereco TEXT,
    gerente VARCHAR(100),
    status status_loja NOT NULL DEFAULT 'Ativa',
    data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE,
    ultima_visita DATE,
    nota_atual NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Usuários
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    cargo VARCHAR(60),
    avatar_inicial VARCHAR(5),
    senha_hash VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Categorias do checklist
CREATE TABLE categorias_checklist (
    id_categoria SERIAL PRIMARY KEY,
    nome VARCHAR(80) NOT NULL,
    icone VARCHAR(50),
    ordem INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Perguntas
CREATE TABLE perguntas (
    id_pergunta SERIAL PRIMARY KEY,
    id_categoria INT NOT NULL REFERENCES categorias_checklist(id_categoria) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    obrigatoria BOOLEAN NOT NULL DEFAULT TRUE,
    peso NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    ordem INT NOT NULL DEFAULT 0,
    requer_foto BOOLEAN NOT NULL DEFAULT FALSE,
    requer_obs_em_nao BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Visitas
CREATE TABLE visitas (
    id_visita SERIAL PRIMARY KEY,
    id_loja INT NOT NULL REFERENCES lojas(id_loja),
    id_usuario INT NOT NULL REFERENCES usuarios(id_usuario),
    data_visita DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inicio TIME,
    hora_fim TIME,
    duracao_minutos INT,
    nota_final NUMERIC(5,2),
    status status_visita NOT NULL DEFAULT 'Rascunho',
    observacoes_gerais TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Respostas
CREATE TABLE respostas (
    id_resposta SERIAL PRIMARY KEY,
    id_visita INT NOT NULL REFERENCES visitas(id_visita) ON DELETE CASCADE,
    id_pergunta INT NOT NULL REFERENCES perguntas(id_pergunta),
    resposta resposta_checklist NOT NULL,
    observacao TEXT,
    foto_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id_visita, id_pergunta)
);

-- 7. Não conformidades
CREATE TABLE nao_conformidades (
    id_nc SERIAL PRIMARY KEY,
    id_visita INT REFERENCES visitas(id_visita) ON DELETE SET NULL,
    id_loja INT NOT NULL REFERENCES lojas(id_loja),
    area VARCHAR(80),
    descricao TEXT NOT NULL,
    gravidade gravidade_nc NOT NULL DEFAULT 'Moderada',
    status status_nc NOT NULL DEFAULT 'Em aberto',
    data_cadastro DATE NOT NULL DEFAULT CURRENT_DATE,
    prazo_resolucao DATE,
    responsavel VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Histórico de notas
CREATE TABLE historico_notas (
    id SERIAL PRIMARY KEY,
    id_loja INT NOT NULL REFERENCES lojas(id_loja),
    id_visita INT REFERENCES visitas(id_visita) ON DELETE SET NULL,
    nota NUMERIC(5,2) NOT NULL,
    data_registro DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_visitas_loja_data ON visitas(id_loja, data_visita DESC);
CREATE INDEX idx_visitas_status ON visitas(status);
CREATE INDEX idx_nc_loja_status ON nao_conformidades(id_loja, status);
CREATE INDEX idx_nc_gravidade ON nao_conformidades(gravidade);
CREATE INDEX idx_lojas_setor ON lojas(setor);
CREATE INDEX idx_lojas_nota ON lojas(nota_atual DESC);
CREATE INDEX idx_perguntas_categoria ON perguntas(id_categoria, ordem);

-- Views
CREATE VIEW vw_ranking_lojas AS
SELECT
    id_loja,
    codigo_bkn,
    nome_loja,
    setor,
    nota_atual,
    ultima_visita,
    RANK() OVER (ORDER BY nota_atual DESC NULLS LAST) AS posicao_ranking
FROM lojas
WHERE status = 'Ativa'
ORDER BY nota_atual DESC NULLS LAST;

CREATE VIEW vw_metricas_dashboard AS
SELECT
    (SELECT ROUND(AVG(nota_atual)::numeric, 1) FROM lojas WHERE status = 'Ativa') AS media_geral,
    (SELECT COUNT(*) FROM visitas
     WHERE data_visita >= date_trunc('month', CURRENT_DATE)::date) AS visitas_mes,
    (SELECT COUNT(*) FROM nao_conformidades WHERE status = 'Em aberto') AS total_ncs_abertas,
    (SELECT COUNT(*) FROM nao_conformidades
     WHERE status = 'Em aberto' AND gravidade = 'Crítica') AS ncs_criticas,
    (SELECT COUNT(*) FROM lojas WHERE status = 'Ativa' AND nota_atual < 75) AS lojas_abaixo_75,
    (SELECT COUNT(*) FROM lojas WHERE status = 'Ativa') AS lojas_ativas;

-- Função: recalcula nota da visita
CREATE OR REPLACE FUNCTION fn_atualizar_nota_visita()
RETURNS TRIGGER AS $$
DECLARE
    v_nota NUMERIC(5,2);
BEGIN
    SELECT ROUND(
        AVG(
            CASE
                WHEN r.resposta = 'Sim' THEN 100
                WHEN r.resposta = 'Não' THEN 0
                ELSE 50
            END * p.peso
        )::numeric, 2
    ) INTO v_nota
    FROM respostas r
    JOIN perguntas p ON r.id_pergunta = p.id_pergunta
    WHERE r.id_visita = COALESCE(NEW.id_visita, OLD.id_visita);

    UPDATE visitas
    SET nota_final = v_nota, updated_at = NOW()
    WHERE id_visita = COALESCE(NEW.id_visita, OLD.id_visita);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resposta_nota
AFTER INSERT OR UPDATE OR DELETE ON respostas
FOR EACH ROW EXECUTE PROCEDURE fn_atualizar_nota_visita();

-- Função: ao finalizar visita, atualiza loja e histórico
CREATE OR REPLACE FUNCTION fn_atualizar_loja_apos_visita()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Finalizada' AND (OLD.status IS DISTINCT FROM 'Finalizada') AND NEW.nota_final IS NOT NULL THEN
        UPDATE lojas
        SET nota_atual = NEW.nota_final,
            ultima_visita = NEW.data_visita,
            updated_at = NOW()
        WHERE id_loja = NEW.id_loja;

        INSERT INTO historico_notas (id_loja, id_visita, nota, data_registro)
        VALUES (NEW.id_loja, NEW.id_visita, NEW.nota_final, NEW.data_visita);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visita_loja
AFTER UPDATE ON visitas
FOR EACH ROW EXECUTE PROCEDURE fn_atualizar_loja_apos_visita();

-- Seeds: usuários
INSERT INTO usuarios (nome, email, cargo, avatar_inicial) VALUES
('Gabriela Vicentini', 'gabriela.vicentini@grupoalvim.com.br', 'Supervisora', 'GV'),
('Marcos Teixeira', 'marcos.teixeira@grupoalvim.com.br', 'Auditor', 'MT');

-- Seeds: lojas
INSERT INTO lojas (codigo_bkn, nome_loja, setor, gerente, nota_atual, ultima_visita, status) VALUES
('27984', 'BK Planaltina', 'Centro/Norte', 'Adelaine S.', 78.00, '2026-03-04', 'Ativa'),
('27201', 'BK Taguatinga Norte', 'Oeste', 'Ricardo M.', 94.00, '2026-03-01', 'Ativa'),
('27312', 'BK Águas Claras', 'Oeste', 'Fernanda L.', 91.00, '2026-02-28', 'Ativa'),
('27445', 'BK Brazlândia', 'Oeste', 'Paulo R.', 68.00, '2026-02-25', 'Alerta'),
('27556', 'BK Sobradinho II', 'Norte', 'Camila F.', 76.00, '2026-02-27', 'Ativa'),
('27245', 'BK Ceilândia Sul', 'Oeste', 'Roberto A.', 89.00, '2026-03-02', 'Ativa'),
('27389', 'BK Samambaia', 'Sul', 'Juliana P.', 83.00, '2026-03-03', 'Ativa'),
('27612', 'BK Gama', 'Sul', 'Thiago S.', 81.00, '2026-03-01', 'Ativa');

-- Seeds: categorias
INSERT INTO categorias_checklist (nome, icone, ordem) VALUES
('Segurança dos Alimentos', 'droplet', 1),
('Experiência do Cliente', 'users', 2),
('Qualidade Operacional', 'temperature', 3),
('Limpeza e Higiene', 'brush', 4),
('Equipamentos', 'tools', 5),
('Documentos e Registros', 'file-text', 6),
('Gestão de Pessoas', 'users-group', 7);

-- Seeds: perguntas (amostra representativa)
INSERT INTO perguntas (id_categoria, texto, obrigatoria, peso, ordem, requer_obs_em_nao) VALUES
(1, 'A lavagem das mãos é feita quando necessário?', TRUE, 1.0, 1, TRUE),
(1, 'Os padrões de lavagem das mãos são seguidos corretamente?', TRUE, 1.0, 2, TRUE),
(1, 'Os dispensadores de papel toalha, sabão e álcool em gel estão abastecidos?', TRUE, 0.8, 3, FALSE),
(2, 'Os colaboradores estão disponíveis para atender e agem de maneira atenciosa?', TRUE, 1.0, 1, TRUE),
(2, 'Os 5 passos de atendimento são seguidos corretamente?', TRUE, 1.0, 2, TRUE),
(2, 'Todos os Totens estão limpos e funcionam normalmente?', TRUE, 1.0, 3, FALSE),
(3, 'Existe um pirômetro disponível e em boas condições de uso?', TRUE, 1.0, 1, FALSE),
(3, 'Produtos potencialmente perigosos atendem aos padrões de temperatura?', TRUE, 1.2, 2, TRUE),
(4, 'As áreas de preparo estão limpas e organizadas?', TRUE, 1.0, 1, FALSE),
(4, 'Lixeiras identificadas e em bom estado?', TRUE, 0.8, 2, FALSE),
(5, 'Equipamentos de cozinha em bom funcionamento?', TRUE, 1.0, 1, FALSE),
(6, 'Registros de temperatura preenchidos corretamente?', TRUE, 1.0, 1, TRUE),
(7, 'Equipe uniformizada e com crachá visível?', TRUE, 0.9, 1, FALSE);

-- Seeds: não conformidades (exemplo)
INSERT INTO nao_conformidades (id_loja, area, descricao, gravidade, status, data_cadastro) VALUES
(1, 'Seg. Alimentos', 'Temperatura mínima da carne não atingida — item descartado', 'Crítica', 'Em aberto', '2026-03-04'),
(1, 'Câmaras', 'Carne no chão da câmara fria', 'Crítica', 'Em aberto', '2026-03-04'),
(1, 'Câmaras', 'Estante com ferrugem na câmara fria', 'Moderada', 'Em aberto', '2026-03-04'),
(1, 'Salão', 'Sofás rasgados, luminárias queimadas', 'Moderada', 'Em aberto', '2026-03-04'),
(1, 'Qualidade', 'Alface com folhas oxidadas', 'Crítica', 'Resolvida', '2026-03-04'),
(1, 'Equipamentos', 'Micro-ondas com calibração errada', 'Moderada', 'Em aberto', '2026-03-04'),
(4, 'Operação', 'Nota abaixo do mínimo — plano de ação pendente', 'Moderada', 'Em aberto', '2026-02-25');

COMMIT;
