BEGIN;

-- Supervisor Regional deve executar Time de Campo, não Auditoria Operacional.
-- Corrige alteração manual indevida em cargo_checklist (Configurações > Cargos).

DELETE FROM cargo_checklist
WHERE cargo_codigo = 'supervisor_regional'
  AND id_tipo_checklist = (
    SELECT id_tipo_checklist FROM tipos_checklist WHERE codigo = 'auditoria_operacional'
  );

INSERT INTO cargo_checklist (cargo_codigo, id_tipo_checklist)
SELECT 'supervisor_regional', t.id_tipo_checklist
FROM tipos_checklist t
WHERE t.codigo = 'time_de_campo'
ON CONFLICT DO NOTHING;

COMMIT;
