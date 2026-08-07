-- Realinha a sequence de nao_conformidades.id_nc.
-- Sequência atrás do MAX(id_nc) causa ao finalizar checklist:
--   duplicate key value violates unique constraint "nao_conformidades_pkey"
SELECT setval(
  pg_get_serial_sequence('nao_conformidades', 'id_nc'),
  GREATEST(COALESCE((SELECT MAX(id_nc) FROM nao_conformidades), 1), 1),
  true
);
