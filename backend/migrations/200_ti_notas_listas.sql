-- Várias listas de anotações com título e ordem.

BEGIN;

ALTER TABLE ti_notas
  ADD COLUMN IF NOT EXISTS ordem INT NOT NULL DEFAULT 0;

UPDATE ti_notas n
SET ordem = sub.rn
FROM (
  SELECT id_nota, ROW_NUMBER() OVER (ORDER BY id_nota) AS rn
  FROM ti_notas
) sub
WHERE n.id_nota = sub.id_nota
  AND n.ordem = 0;

COMMIT;
