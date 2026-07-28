-- Estoque: permissões por aba (Produtos / Conferência)
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('estoque.produtos', 'Produtos — cadastrar e editar', 'Estoque', 200),
  ('estoque.conferencia', 'Conferência — iniciar, salvar e finalizar', 'Estoque', 201)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

-- Quem tinha gerenciar (editar) → ambas as abas
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT up.id_usuario, n.codigo
FROM usuario_permissoes up
CROSS JOIN (VALUES ('estoque.produtos'), ('estoque.conferencia')) AS n(codigo)
WHERE up.codigo = 'estoque.gerenciar'
ON CONFLICT DO NOTHING;

-- Quem tinha só ver → ambas as abas (acesso ao módulo)
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT up.id_usuario, n.codigo
FROM usuario_permissoes up
CROSS JOIN (VALUES ('estoque.produtos'), ('estoque.conferencia')) AS n(codigo)
WHERE up.codigo = 'estoque.ver'
ON CONFLICT DO NOTHING;

-- Diretor / CEO / admin (garantia)
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES ('estoque.produtos'), ('estoque.conferencia')) AS p(codigo)
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'ceo', 'administrador')
  AND u.ativo = TRUE
ON CONFLICT DO NOTHING;

DELETE FROM usuario_permissoes WHERE codigo IN ('estoque.gerenciar', 'estoque.ver');
DELETE FROM permissoes WHERE codigo IN ('estoque.gerenciar', 'estoque.ver');

COMMIT;
