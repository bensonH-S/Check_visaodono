BEGIN;

-- Diretor e CEO: apenas Time de Campo (configurável depois em Configurações > Cargos)
DELETE FROM cargo_checklist
WHERE cargo_codigo IN ('diretor', 'ceo')
  AND id_tipo_checklist = (
    SELECT id_tipo_checklist FROM tipos_checklist WHERE codigo = 'auditoria_operacional'
  );

INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo IN ('diretor', 'ceo')
  AND t.codigo = 'time_de_campo'
ON CONFLICT DO NOTHING;

COMMIT;
