-- Realinha a sequence de escala_visitas_celula.id_celula.
-- Sequência atrás do MAX(id_celula) causa ao salvar a escala:
--   duplicate key value violates unique constraint "escala_visitas_celula_pkey"
SELECT setval(
  pg_get_serial_sequence('escala_visitas_celula', 'id_celula'),
  GREATEST(COALESCE((SELECT MAX(id_celula) FROM escala_visitas_celula), 1), 1),
  true
);
