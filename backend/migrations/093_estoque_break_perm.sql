BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('estoque.break', 'Break — lançar consumo de colaboradores', 'Estoque', 204)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
