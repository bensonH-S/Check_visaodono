-- Urgência padrão definida no SLA e propagada às categorias vinculadas
BEGIN;

ALTER TABLE manut_sla
  ADD COLUMN IF NOT EXISTS urgencia_padrao manut_urgencia NOT NULL DEFAULT 'media';

UPDATE manut_sla s
SET urgencia_padrao = sub.urgencia_padrao
FROM (
  SELECT DISTINCT ON (id_sla) id_sla, urgencia_padrao
  FROM manut_categorias
  WHERE id_sla IS NOT NULL
  ORDER BY id_sla, id_categoria
) sub
WHERE s.id_sla = sub.id_sla;

UPDATE manut_categorias c
SET urgencia_padrao = s.urgencia_padrao
FROM manut_sla s
WHERE c.id_sla = s.id_sla;

COMMIT;
