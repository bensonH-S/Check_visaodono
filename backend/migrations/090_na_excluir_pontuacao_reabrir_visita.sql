BEGIN;

-- N/A ("não se aplica") não entra na média — evita puxar a categoria para baixo
-- quando a área não existe na loja (ex.: Área externa e drive).
CREATE OR REPLACE FUNCTION fn_atualizar_nota_visita()
RETURNS TRIGGER AS $$
DECLARE
    v_nota NUMERIC(5,2);
BEGIN
    SELECT ROUND(AVG(
        CASE
            WHEN p.tipo_resposta IN ('estrelas', 'estrelas_foto') AND r.nota_estrelas IS NOT NULL
                THEN (r.nota_estrelas::numeric / 5.0) * 100
            WHEN r.resposta = 'N/A' THEN NULL
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
        OR (r.resposta IS NOT NULL AND r.resposta <> 'N/A')
      );

    UPDATE visitas
    SET nota_final = v_nota, updated_at = NOW()
    WHERE id_visita = COALESCE(NEW.id_visita, OLD.id_visita);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

UPDATE visitas v
SET nota_final = sub.nota,
    updated_at = NOW()
FROM (
  SELECT r.id_visita,
         ROUND(AVG(
           CASE
             WHEN p.tipo_resposta IN ('estrelas', 'estrelas_foto') AND r.nota_estrelas IS NOT NULL
               THEN (r.nota_estrelas::numeric / 5.0) * 100
             WHEN r.resposta = 'N/A' THEN NULL
             WHEN COALESCE(p.sim_indica_problema, FALSE) AND r.resposta = 'Não' THEN 100
             WHEN COALESCE(p.sim_indica_problema, FALSE) AND r.resposta = 'Sim' THEN 0
             WHEN r.resposta = 'Sim' THEN 100
             WHEN r.resposta = 'Não' THEN 0
             ELSE NULL
           END * p.peso
         )::numeric, 2) AS nota
  FROM respostas r
  JOIN perguntas p ON p.id_pergunta = r.id_pergunta
  WHERE r.nota_estrelas IS NOT NULL
     OR (r.resposta IS NOT NULL AND r.resposta <> 'N/A')
  GROUP BY r.id_visita
) sub
WHERE v.id_visita = sub.id_visita;

-- Permissão: reabrir visita finalizada (somente diretor)
INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('portal.visitas.reabrir', 'Reabrir visitas finalizadas para edição', 'Visitas', 22)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'portal.visitas.reabrir'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) = 'diretor'
ON CONFLICT DO NOTHING;

COMMIT;
