-- Ranking e métricas só consideram lojas com visita finalizada (checklist concluído)
BEGIN;

UPDATE lojas l
SET nota_atual = 0,
    ultima_visita = NULL,
    updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM visitas v
  WHERE v.id_loja = l.id_loja
    AND v.status = 'Finalizada'
);

DROP VIEW IF EXISTS vw_metricas_dashboard CASCADE;
DROP VIEW IF EXISTS vw_ranking_lojas CASCADE;

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
WHERE is_active = TRUE
  AND bk_number IS NOT NULL
  AND ultima_visita IS NOT NULL
ORDER BY nota_atual DESC NULLS LAST;

CREATE VIEW vw_metricas_dashboard AS
SELECT
    (
      SELECT ROUND(AVG(nota_atual)::numeric, 1)
      FROM lojas
      WHERE is_active = TRUE
        AND bk_number IS NOT NULL
        AND ultima_visita IS NOT NULL
    ) AS media_geral,
    (
      SELECT COUNT(*)
      FROM visitas
      WHERE data_visita >= date_trunc('month', CURRENT_DATE)::date
    ) AS visitas_mes,
    (SELECT COUNT(*) FROM nao_conformidades WHERE status = 'Em aberto') AS total_ncs_abertas,
    (
      SELECT COUNT(*)
      FROM nao_conformidades
      WHERE status = 'Em aberto' AND gravidade = 'Crítica'
    ) AS ncs_criticas,
    (
      SELECT COUNT(*)
      FROM lojas
      WHERE is_active = TRUE
        AND bk_number IS NOT NULL
        AND ultima_visita IS NOT NULL
        AND nota_atual < 75
    ) AS lojas_abaixo_75,
    (SELECT COUNT(*) FROM lojas WHERE is_active = TRUE AND bk_number IS NOT NULL) AS lojas_ativas;

COMMIT;
