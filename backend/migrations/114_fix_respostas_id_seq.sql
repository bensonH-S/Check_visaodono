-- Realinha a sequence de respostas.id_resposta.
-- Sequência atrás do MAX(id_resposta) causa:
--   duplicate key value violates unique constraint "respostas_pkey"
-- ao salvar checklist (auditoria operacional).
SELECT setval(
  pg_get_serial_sequence('respostas', 'id_resposta'),
  GREATEST(COALESCE((SELECT MAX(id_resposta) FROM respostas), 1), 1),
  true
);
