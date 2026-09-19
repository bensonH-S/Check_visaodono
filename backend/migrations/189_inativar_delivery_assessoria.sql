BEGIN;

UPDATE lojas
SET is_active = FALSE
WHERE name ILIKE 'DELIVERY'
   OR name ILIKE 'GA - KING ASSESSORIA E CONSULTORIA'
   OR (
     bk_number IS NULL
     AND (
       address ILIKE '%SCRN 706/707 BLOCO E%'
       OR address ILIKE '%SCRN 706/707 Bloco G%'
     )
   );

COMMIT;
