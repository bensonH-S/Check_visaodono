-- Realinha sequences de estoque (mesmo padrão de 114/115).
-- Sequence atrás do MAX(id_item) causa ao iniciar conferência:
--   duplicate key value violates unique constraint "estoque_itens_pkey"
SELECT setval(
  pg_get_serial_sequence('estoque_itens', 'id_item'),
  GREATEST(COALESCE((SELECT MAX(id_item) FROM estoque_itens), 1), 1),
  (SELECT COALESCE(MAX(id_item), 0) FROM estoque_itens) > 0
);

SELECT setval(
  pg_get_serial_sequence('estoque_contagens', 'id_contagem'),
  GREATEST(COALESCE((SELECT MAX(id_contagem) FROM estoque_contagens), 1), 1),
  (SELECT COALESCE(MAX(id_contagem), 0) FROM estoque_contagens) > 0
);
