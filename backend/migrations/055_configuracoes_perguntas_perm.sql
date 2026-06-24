-- Permissão dedicada à aba Configurações → Perguntas
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('configuracoes.perguntas', 'Perguntas do checklist', 'Configurações', 68)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT up.id_usuario, 'configuracoes.perguntas'
FROM usuario_permissoes up
WHERE up.codigo = 'checklist.gerenciar'
  AND NOT EXISTS (
    SELECT 1 FROM usuario_permissoes x
    WHERE x.id_usuario = up.id_usuario AND x.codigo = 'configuracoes.perguntas'
  )
ON CONFLICT DO NOTHING;

DELETE FROM usuario_permissoes WHERE codigo = 'checklist.gerenciar';
DELETE FROM permissoes WHERE codigo = 'checklist.gerenciar';

COMMIT;
