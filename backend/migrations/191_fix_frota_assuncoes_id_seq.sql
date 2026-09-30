-- Realinha a sequence de frota_assuncoes.id_assuncao.
-- Sequência atrás do MAX(id_assuncao) causa ao assumir veículo:
--   duplicate key value violates unique constraint "frota_assuncoes_pkey"
SELECT setval(
  pg_get_serial_sequence('frota_assuncoes', 'id_assuncao'),
  GREATEST(COALESCE((SELECT MAX(id_assuncao) FROM frota_assuncoes), 1), 1),
  (SELECT COALESCE(MAX(id_assuncao), 0) FROM frota_assuncoes) > 0
);
