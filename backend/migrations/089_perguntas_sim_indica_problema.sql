BEGIN;

-- Perguntas em que "Sim" = problema (ex.: "possui alguma obstrução?").
-- Nesses casos: Não = 100 pts, Sim = 0 pts.
ALTER TABLE perguntas
  ADD COLUMN IF NOT EXISTS sim_indica_problema BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN perguntas.sim_indica_problema IS
  'Quando TRUE, a resposta Sim indica problema (Não pontua 100 e Sim pontua 0).';

UPDATE perguntas
SET sim_indica_problema = TRUE
WHERE
  texto ~* 'possui alguma obstru'
  OR texto ~* 'foi encontrad'
  OR texto ~* 'h[aá] presença'
  OR texto ~* 'ha presenca'
  OR texto ~* 'evid[eê]ncia de'
  OR texto ~* 'evidencia de'
  OR texto ~* 'existe vazamento'
  OR texto ~* 'h[aá] vazamento'
  OR texto ~* 'ha vazamento';

CREATE OR REPLACE FUNCTION fn_atualizar_nota_visita()
RETURNS TRIGGER AS $$
DECLARE
    v_nota NUMERIC(5,2);
BEGIN
    SELECT ROUND(AVG(
        CASE
            WHEN p.tipo_resposta IN ('estrelas', 'estrelas_foto') AND r.nota_estrelas IS NOT NULL
                THEN (r.nota_estrelas::numeric / 5.0) * 100
            WHEN r.resposta = 'N/A' THEN 50
            WHEN COALESCE(p.sim_indica_problema, FALSE) AND r.resposta = 'Não' THEN 100
            WHEN COALESCE(p.sim_indica_problema, FALSE) AND r.resposta = 'Sim' THEN 0
            WHEN r.resposta = 'Sim' THEN 100
            WHEN r.resposta = 'Não' THEN 0
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

-- Recalcula notas já gravadas com a regra corrigida
UPDATE visitas v
SET nota_final = sub.nota,
    updated_at = NOW()
FROM (
  SELECT r.id_visita,
         ROUND(AVG(
           CASE
             WHEN p.tipo_resposta IN ('estrelas', 'estrelas_foto') AND r.nota_estrelas IS NOT NULL
               THEN (r.nota_estrelas::numeric / 5.0) * 100
             WHEN r.resposta = 'N/A' THEN 50
             WHEN COALESCE(p.sim_indica_problema, FALSE) AND r.resposta = 'Não' THEN 100
             WHEN COALESCE(p.sim_indica_problema, FALSE) AND r.resposta = 'Sim' THEN 0
             WHEN r.resposta = 'Sim' THEN 100
             WHEN r.resposta = 'Não' THEN 0
             ELSE NULL
           END * p.peso
         )::numeric, 2) AS nota
  FROM respostas r
  JOIN perguntas p ON p.id_pergunta = r.id_pergunta
  WHERE r.nota_estrelas IS NOT NULL OR r.resposta IS NOT NULL
  GROUP BY r.id_visita
) sub
WHERE v.id_visita = sub.id_visita;

COMMIT;
