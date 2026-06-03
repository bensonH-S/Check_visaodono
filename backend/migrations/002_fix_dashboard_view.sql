BEGIN;

DROP VIEW IF EXISTS vw_metricas_dashboard;

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

COMMIT;
