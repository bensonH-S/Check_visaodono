-- Permissão para acessar a aba Configurações
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('configuracoes.ver', 'Acessar aba Configurações', 'Configurações', 75)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
