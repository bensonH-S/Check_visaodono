-- Realinha sequences do módulo de metas.
-- Sequência atrás do MAX causa ao criar novo mês:
--   duplicate key value violates unique constraint "metas_premios_pkey"
SELECT setval(
  pg_get_serial_sequence('metas_premios', 'id_premio'),
  GREATEST(COALESCE((SELECT MAX(id_premio) FROM metas_premios), 1), 1),
  true
);
SELECT setval(
  pg_get_serial_sequence('metas_periodos', 'id_periodo'),
  GREATEST(COALESCE((SELECT MAX(id_periodo) FROM metas_periodos), 1), 1),
  true
);
SELECT setval(
  pg_get_serial_sequence('metas_paineis', 'id_painel'),
  GREATEST(COALESCE((SELECT MAX(id_painel) FROM metas_paineis), 1), 1),
  true
);
SELECT setval(
  pg_get_serial_sequence('metas_rankings', 'id_ranking'),
  GREATEST(COALESCE((SELECT MAX(id_ranking) FROM metas_rankings), 1), 1),
  true
);
SELECT setval(
  pg_get_serial_sequence('metas_realizados', 'id_realizado'),
  GREATEST(COALESCE((SELECT MAX(id_realizado) FROM metas_realizados), 1), 1),
  true
);
