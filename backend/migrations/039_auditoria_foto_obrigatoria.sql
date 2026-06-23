BEGIN;

-- Auditoria Operacional: perguntas com foto obrigatória (sim/não + anexo)
UPDATE perguntas p
SET tipo_resposta = 'sim_nao_foto'::tipo_resposta_checklist,
    requer_foto = TRUE
FROM categorias_checklist c
JOIN tipos_checklist t ON t.id_tipo_checklist = c.id_tipo_checklist
WHERE p.id_categoria = c.id_categoria
  AND t.codigo = 'auditoria_operacional'
  AND p.codigo IN ('05', '06', '08', '11', '17', '21', '22', '25', '27', '29', '36', '39', '63');

COMMIT;
