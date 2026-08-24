-- Por hora: desliga o Time de Campo.
-- Regionais passam a executar a Auditoria Operacional.
-- O vínculo Time de Campo nos cargos é mantido para reativar depois (ativo = TRUE).

BEGIN;

UPDATE tipos_checklist
SET ativo = FALSE
WHERE codigo = 'time_de_campo';

INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT c.codigo, t.id_tipo_checklist
FROM cargos c
CROSS JOIN tipos_checklist t
WHERE c.codigo IN ('supervisor_regional', 'regional', 'coordenador')
  AND t.codigo = 'auditoria_operacional'
ON CONFLICT DO NOTHING;

-- Cargos que ficariam sem checklist ativo (ex.: diretor/CEO só com Time de Campo).
INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT DISTINCT cc.cargo_codigo, op.id_tipo_checklist
FROM cargo_checklist cc
CROSS JOIN tipos_checklist op
WHERE op.codigo = 'auditoria_operacional'
  AND NOT EXISTS (
    SELECT 1
    FROM cargo_checklist cc2
    JOIN tipos_checklist t2 ON t2.id_tipo_checklist = cc2.id_tipo_checklist
    WHERE cc2.cargo_codigo = cc.cargo_codigo
      AND t2.ativo = TRUE
  )
ON CONFLICT DO NOTHING;

COMMIT;
