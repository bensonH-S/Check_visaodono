-- Permissão para financeiro/diretor aprovarem orçamentos de chamados
INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('chamados.aprovar', 'Aprovar orçamentos', 'Manutenção', 105)
ON CONFLICT (codigo) DO NOTHING;
