-- Permissão para gerenciar perguntas do checklist (Configurações → Perguntas)
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('checklist.gerenciar', 'Configurar perguntas do checklist', 'Checklist', 30)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'checklist.gerenciar'
FROM usuarios u
WHERE EXISTS (
  SELECT 1 FROM usuario_permissoes up
  WHERE up.id_usuario = u.id_usuario AND up.codigo = 'configuracoes.ver'
)
ON CONFLICT DO NOTHING;

COMMIT;
