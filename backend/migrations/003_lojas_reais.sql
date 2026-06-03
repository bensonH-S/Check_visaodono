BEGIN;

DROP VIEW IF EXISTS vw_metricas_dashboard CASCADE;
DROP VIEW IF EXISTS vw_ranking_lojas CASCADE;

-- Limpar dados dependentes das lojas antigas
TRUNCATE respostas, visitas, historico_notas, nao_conformidades RESTART IDENTITY CASCADE;
TRUNCATE lojas RESTART IDENTITY CASCADE;

-- Renomear / ajustar colunas para o cadastro real
ALTER TABLE lojas RENAME COLUMN nome_loja TO name;
ALTER TABLE lojas RENAME COLUMN codigo_bkn TO bk_number;
ALTER TABLE lojas RENAME COLUMN endereco TO address;

ALTER TABLE lojas DROP COLUMN IF EXISTS setor;
ALTER TABLE lojas DROP COLUMN IF EXISTS gerente;
ALTER TABLE lojas DROP COLUMN IF EXISTS status;

ALTER TABLE lojas ALTER COLUMN bk_number DROP NOT NULL;
ALTER TABLE lojas ALTER COLUMN address TYPE TEXT;

ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS city VARCHAR(80),
  ADD COLUMN IF NOT EXISTS state CHAR(2),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(120),
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20),
  ADD COLUMN IF NOT EXISTS corporate_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

DROP INDEX IF EXISTS idx_lojas_setor;
CREATE INDEX IF NOT EXISTS idx_lojas_city ON lojas(city);
CREATE INDEX IF NOT EXISTS idx_lojas_active ON lojas(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lojas_bk_number ON lojas(bk_number) WHERE bk_number IS NOT NULL;

CREATE VIEW vw_ranking_lojas AS
SELECT
    id_loja,
    bk_number,
    name,
    city,
    state,
    neighborhood,
    nota_atual,
    ultima_visita,
    RANK() OVER (ORDER BY nota_atual DESC NULLS LAST) AS posicao_ranking
FROM lojas
WHERE is_active = TRUE AND bk_number IS NOT NULL
ORDER BY nota_atual DESC NULLS LAST;

CREATE VIEW vw_metricas_dashboard AS
SELECT
    (SELECT ROUND(AVG(nota_atual)::numeric, 1) FROM lojas WHERE is_active = TRUE AND bk_number IS NOT NULL) AS media_geral,
    (SELECT COUNT(*) FROM visitas
     WHERE data_visita >= date_trunc('month', CURRENT_DATE)::date) AS visitas_mes,
    (SELECT COUNT(*) FROM nao_conformidades WHERE status = 'Em aberto') AS total_ncs_abertas,
    (SELECT COUNT(*) FROM nao_conformidades
     WHERE status = 'Em aberto' AND gravidade = 'Crítica') AS ncs_criticas,
    (SELECT COUNT(*) FROM lojas WHERE is_active = TRUE AND bk_number IS NOT NULL AND nota_atual < 75) AS lojas_abaixo_75,
    (SELECT COUNT(*) FROM lojas WHERE is_active = TRUE AND bk_number IS NOT NULL) AS lojas_ativas;

-- Cadastro real das lojas (Grupo Alvim)
INSERT INTO lojas (name, address, zip_code, city, state, neighborhood, bk_number, cnpj, corporate_name, is_active, nota_atual) VALUES
('BURGER KING - UNAÍ', 'Rua Nossa Senhora do Carmo', '38610034', 'Unaí', 'MG', 'Centro', '32338', '35257416000174', 'SENHOR ALVIM COMERCIO DE ALIMENTOS LTDA ME', TRUE, 0),
('BURGER KING - 201 NORTE', 'Quadra CLN 201 Bloco C', '70832530', 'Brasília', 'DF', 'Asa Norte', '19929', '35238002000106', 'REGENTE ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - CEILÂNDIA', 'Quadra CNM 1, Bloco K, Loja 05, 05E, 01C', '72215500', 'Brasília', 'DF', 'Cruzeiro Novo', '24820', '28428268000148', 'PRÍNCIPE ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - CALDAS NOVAS', 'Avenida Orcalino Santos Quadra 11 - loja 297', '75690000', 'Caldas Novas', 'GO', 'Centro', '23194', '26075154000136', 'REI ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('POPYES - VALPARAÍSO', 'QUADRA 1 S N LT 01 LJ', '72876301', 'Valparaíso de Goiás', 'GO', 'Parque Esplanada III', '15022', '52193038000121', 'POP VAL COMERCIO DE ALIMENTOS', TRUE, 0),
('BURGER KING - VENÂNCIO SHOPPING', 'SCS Quadra 7 Bloco A', '70307902', 'Brasília', 'DF', 'Asa Sul', '25261', '35378393000156', 'CAVALEIRO ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - 706/7 NORTE', 'SCRN Quadra 706/707 Bloco E Loja 32', '70740650', 'Brasília', 'DF', 'Asa Norte', '23531', '26428809000102', 'IMPERADOR ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('GA - ESCRITORIO', 'Q SCRN 706/707 BLOCO E', '70740650', 'Brasília', 'DF', 'Asa Norte', NULL, '64031684000171', 'SUPER KING ASSESSORIA LTDA', TRUE, 0),
('BURGER KING - SUDOESTE', 'SIG Quadra 6 Número 15. Edifício Office 300.', '70610460', 'Brasília', 'DF', 'Sudoeste', '23240', '26332112000133', 'LORD ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - PLANALTINA', 'Quadra 3 Conjunto A', '73350301', 'Brasília', 'DF', 'Setor Residencial Leste (Planaltina)', '27984', '34840241000160', 'BARÃO ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('GA - KING ASSESSORIA E CONSULTORIA', 'Quadra SCRN 706/707 Bloco G', '70740670', 'Brasília', 'DF', 'Asa Norte', NULL, '62405047000192', 'KING ASSESSORIA E CONSULTORIA EMPRESARIAL LTDA', TRUE, 0),
('BURGER KING - NOROESTE', 'Área Especial CRENW 3', '70687400', 'Brasília', 'DF', 'Setor Noroeste', '31608', '47994803000172', 'RAINHA ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - SAMBAIA', 'Quadra 201 Conjunto 1', '72341001', 'Brasília', 'DF', 'Samambaia Norte', '31614', '52360597000189', 'IMPERATRIZ ALVIM COMÉRCIO DE ALIMENTOS', TRUE, 0),
('BURGER KING - ESTRUTURAL', 'Setor SCIA Quadra 10 Conjunto 1 LT 09 LJ 01', '71250610', 'Brasília', 'DF', 'Zona Industrial (Guará)', '32555', '55949831000104', 'DONZELA ALVIM COMERCIO DE ALIMENTOS', TRUE, 0),
('BURGER KING - LAGO SUL', 'Quadra SHIS QI 5 Bloco A Gilberto Salomão', '71615510', 'Brasília', 'DF', 'Setor de Habitações Individuais Sul', '20415', '29087671000113', 'DUQUE ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - 408 SUL', 'Quadra CLS 408 Bloco D LJ 33 E 35', '70257540', 'Brasília', 'DF', 'Asa Sul', '18915', '28953109000162', 'GLADIADOR COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - DF PLAZA SHOPPING', 'Rua Copaíba Lote 01', '71919540', 'Brasília', 'DF', 'Norte (Águas Claras)', '21583', '35359111000173', 'VISCONDE ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - SOBRADINHO', 'Comper Sobradinho Q 14 AREA ESPECIAL LT DE 12 A16 SL 01', '73050150', 'Brasília', 'DF', 'Sobradinho', '30784', '35254858000167', 'ARQUIDUQUE COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - SÃO SEBASTIÃO', 'Quadra 1 Conjunto 3 LT 04', '71691243', 'Brasília', 'DF', 'Morro Azul (São Sebastião)', '33104', '60158898000152', 'DAMA ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - RECANTO', 'Quadra 103', '72600300', 'Brasília', 'DF', 'Recanto das Emas', '30769', '47014641000169', 'ARQUEIRO ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - TERRAÇO SHOPPING', 'Quadra SHCES Quadra 707 Bloco E', '70655775', 'Brasília', 'DF', 'Cruzeiro Novo', '30797', '47397598000168', 'CAPITAO ALVIM COMERCIO DE ALIMENTOS LTDA', TRUE, 0),
('BURGER KING - GAMA', 'SH Ponte de Terra Ponte Alta Mall', '72400000', 'Brasília', 'DF', 'Ponte Alta Norte (Gama)', '31782', '52160093000115', 'CONDESSA ALVIM COMERCIO DE ALIMENTOS', TRUE, 0);

COMMIT;
