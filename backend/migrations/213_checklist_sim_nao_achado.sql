-- Perguntas de achado: Sim = problema (NC), Não = conforme.
-- Ex.: "Foram observadas baratas?", "Foi identificada contaminação?",
-- "Algum produto vencido foi servido ao cliente?".
-- Antes, Não nessas perguntas zerava o ponto e abria NC, como se o achado tivesse ocorrido.

BEGIN;

CREATE OR REPLACE FUNCTION fn_texto_sim_indica_problema(p_texto TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
       COALESCE(p_texto, '') ~* 'foi encontrad'
    OR COALESCE(p_texto, '') ~* 'h[aá] presença'
    OR COALESCE(p_texto, '') ~* 'ha presenca'
    OR COALESCE(p_texto, '') ~* 'evid[eê]ncia de'
    OR COALESCE(p_texto, '') ~* 'evidencia de'
    OR COALESCE(p_texto, '') ~* 'possui alguma obstru'
    OR COALESCE(p_texto, '') ~* 'existe vazamento'
    OR COALESCE(p_texto, '') ~* 'h[aá] vazamento'
    OR COALESCE(p_texto, '') ~* 'ha vazamento'
    OR COALESCE(p_texto, '') ~* 'foram observad'
    OR COALESCE(p_texto, '') ~* 'foi observad'
    OR COALESCE(p_texto, '') ~* 'foi identificad'
    OR COALESCE(p_texto, '') ~* 'foram identificad'
    OR COALESCE(p_texto, '') ~* 'evidenciou'
    OR COALESCE(p_texto, '') ~* 'foi evidenc'
    OR COALESCE(p_texto, '') ~* 'foi servid'
    OR COALESCE(p_texto, '') ~* 'h[aá] equipamentos'
    OR COALESCE(p_texto, '') ~* 'ha equipamentos'
    OR COALESCE(p_texto, '') ~* 'h[aá] danos'
    OR COALESCE(p_texto, '') ~* 'ha danos'
    OR COALESCE(p_texto, '') ~* 'h[aá] risco'
    OR COALESCE(p_texto, '') ~* 'ha risco'
    OR COALESCE(p_texto, '') ~* 'h[aá] desperd'
    OR COALESCE(p_texto, '') ~* 'ha desperd'
    OR COALESCE(p_texto, '') ~* 'existe algum equipamento';
$$;

CREATE TEMP TABLE visitas_polaridade ON COMMIT DROP AS
SELECT DISTINCT r.id_visita
FROM respostas r
JOIN perguntas p ON p.id_pergunta = r.id_pergunta
WHERE p.sim_indica_problema = FALSE
  AND fn_texto_sim_indica_problema(p.texto)
  AND r.resposta IN ('Sim', 'Não');

UPDATE perguntas
SET sim_indica_problema = TRUE
WHERE sim_indica_problema = FALSE
  AND fn_texto_sim_indica_problema(texto);

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
            WHEN (COALESCE(p.sim_indica_problema, FALSE) OR fn_texto_sim_indica_problema(p.texto))
                 AND r.resposta = 'Não' THEN 100
            WHEN (COALESCE(p.sim_indica_problema, FALSE) OR fn_texto_sim_indica_problema(p.texto))
                 AND r.resposta = 'Sim' THEN 0
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
             WHEN (COALESCE(p.sim_indica_problema, FALSE) OR fn_texto_sim_indica_problema(p.texto))
                  AND r.resposta = 'Não' THEN 100
             WHEN (COALESCE(p.sim_indica_problema, FALSE) OR fn_texto_sim_indica_problema(p.texto))
                  AND r.resposta = 'Sim' THEN 0
             WHEN r.resposta = 'Sim' THEN 100
             WHEN r.resposta = 'Não' THEN 0
             ELSE NULL
           END * p.peso
         )::numeric, 2) AS nota
  FROM respostas r
  JOIN perguntas p ON p.id_pergunta = r.id_pergunta
  WHERE r.id_visita IN (SELECT id_visita FROM visitas_polaridade)
    AND (
      r.nota_estrelas IS NOT NULL
      OR (r.resposta IS NOT NULL AND r.resposta <> 'N/A')
    )
  GROUP BY r.id_visita
) sub
WHERE v.id_visita = sub.id_visita;

UPDATE historico_notas h
SET nota = v.nota_final
FROM visitas v
WHERE h.id_visita = v.id_visita
  AND v.id_visita IN (SELECT id_visita FROM visitas_polaridade)
  AND v.nota_final IS NOT NULL
  AND h.nota IS DISTINCT FROM v.nota_final;

UPDATE lojas l
SET nota_atual = ult.nota_final,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (v.id_loja) v.id_loja, v.id_visita, v.nota_final
  FROM visitas v
  WHERE v.status = 'Finalizada'
    AND v.nota_final IS NOT NULL
  ORDER BY v.id_loja, v.data_visita DESC, v.id_visita DESC
) ult
WHERE l.id_loja = ult.id_loja
  AND ult.id_visita IN (SELECT id_visita FROM visitas_polaridade)
  AND l.nota_atual IS DISTINCT FROM ult.nota_final;

-- Não em pergunta de achado não é NC. Remove as que foram abertas com a polaridade invertida.
DELETE FROM nao_conformidades nc
USING respostas r
JOIN perguntas p ON p.id_pergunta = r.id_pergunta
WHERE nc.id_visita = r.id_visita
  AND r.id_visita IN (SELECT id_visita FROM visitas_polaridade)
  AND r.resposta = 'Não'
  AND (p.sim_indica_problema OR fn_texto_sim_indica_problema(p.texto))
  AND (
    nc.descricao LIKE '[Q' || p.codigo || ']%'
    OR strpos(nc.descricao, p.texto) > 0
  );

-- Sim nessas perguntas é o achado. Abre a NC que a regra antiga deixou de gerar.
INSERT INTO nao_conformidades (id_loja, id_visita, area, descricao, gravidade, status)
SELECT
  v.id_loja,
  v.id_visita,
  LEFT(COALESCE(c.nome, 'Checklist'), 80),
  '[Q' || p.codigo || '] ' || p.texto
    || CASE
         WHEN NULLIF(BTRIM(r.observacao), '') IS NOT NULL
           THEN ' — Obs.: ' || BTRIM(r.observacao)
         ELSE ''
       END,
  (CASE WHEN p.critica THEN 'Crítica' ELSE 'Moderada' END)::gravidade_nc,
  'Em aberto'
FROM respostas r
JOIN perguntas p ON p.id_pergunta = r.id_pergunta
JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
JOIN visitas v ON v.id_visita = r.id_visita AND v.status = 'Finalizada'
WHERE r.id_visita IN (SELECT id_visita FROM visitas_polaridade)
  AND r.resposta = 'Sim'
  AND p.tipo_resposta IN ('sim_nao', 'sim_nao_foto')
  AND (p.sim_indica_problema OR fn_texto_sim_indica_problema(p.texto))
  AND COALESCE(r.observacao, '') !~* 'n[aã]o[[:space:]]+se[[:space:]]+aplica|n[aã]o[[:space:]]+aplica|sem[[:space:]]+m[aá]quina|j[aá][[:space:]]+estamos[[:space:]]+sem'
  AND NOT EXISTS (
    SELECT 1
    FROM nao_conformidades nc
    WHERE nc.id_visita = r.id_visita
      AND (
        nc.descricao LIKE '[Q' || p.codigo || ']%'
        OR strpos(nc.descricao, p.texto) > 0
      )
  );

DELETE FROM nao_conformidades nc
USING visitas v
WHERE nc.id_visita = v.id_visita
  AND v.id_visita IN (SELECT id_visita FROM visitas_polaridade)
  AND nc.area = 'Resultado geral'
  AND nc.descricao LIKE 'Nota abaixo do mínimo%'
  AND nc.status = 'Em aberto'
  AND v.nota_final >= 80;

UPDATE nao_conformidades nc
SET descricao = 'Nota abaixo do mínimo (' || to_char(ROUND(v.nota_final), 'FM999') || '% — meta 80%)',
    gravidade = (CASE WHEN v.nota_final < 60 THEN 'Crítica' ELSE 'Moderada' END)::gravidade_nc
FROM visitas v
WHERE nc.id_visita = v.id_visita
  AND v.id_visita IN (SELECT id_visita FROM visitas_polaridade)
  AND nc.area = 'Resultado geral'
  AND nc.descricao LIKE 'Nota abaixo do mínimo%'
  AND nc.status = 'Em aberto'
  AND v.nota_final < 80;

INSERT INTO nao_conformidades (id_loja, id_visita, area, descricao, gravidade, status)
SELECT
  v.id_loja,
  v.id_visita,
  'Resultado geral',
  'Nota abaixo do mínimo (' || to_char(ROUND(v.nota_final), 'FM999') || '% — meta 80%)',
  (CASE WHEN v.nota_final < 60 THEN 'Crítica' ELSE 'Moderada' END)::gravidade_nc,
  'Em aberto'
FROM visitas v
WHERE v.id_visita IN (SELECT id_visita FROM visitas_polaridade)
  AND v.status = 'Finalizada'
  AND v.nota_final < 80
  AND NOT EXISTS (
    SELECT 1
    FROM nao_conformidades nc
    WHERE nc.id_visita = v.id_visita
      AND nc.area = 'Resultado geral'
      AND nc.descricao LIKE 'Nota abaixo do mínimo%'
  );

COMMIT;
