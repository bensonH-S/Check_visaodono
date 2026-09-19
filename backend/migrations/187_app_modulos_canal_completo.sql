BEGIN;

INSERT INTO app_modulos_canal (codigo, nome, portal, mobile) VALUES
  ('dashboard', 'Command Center', TRUE, FALSE),
  ('nc', 'Não Conformidades', TRUE, TRUE),
  ('metas', 'Metas', TRUE, FALSE),
  ('energia', 'Energia', TRUE, TRUE),
  ('frota', 'Frota', TRUE, TRUE),
  ('escala', 'Planejamento', TRUE, TRUE),
  ('visitas', 'Visitas', TRUE, TRUE),
  ('mapa', 'Mapa de técnicos', FALSE, TRUE),
  ('estoque', 'Estoque & CMV', TRUE, TRUE),
  ('break', 'Break', FALSE, TRUE),
  ('ranking', 'Indicadores', TRUE, FALSE),
  ('freelancers', 'Freelas', FALSE, TRUE),
  ('portais', 'Portais', FALSE, TRUE)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome;

UPDATE app_modulos_canal SET nome = 'AutoREV' WHERE codigo = 'checklist';
UPDATE app_modulos_canal SET nome = 'Chamados' WHERE codigo = 'chamados';

COMMIT;
