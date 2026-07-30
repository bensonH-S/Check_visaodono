BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('estoque.conferencia.reabrir', 'Reabrir conferências finalizadas para edição', 'Estoque', 202)
ON CONFLICT (codigo) DO NOTHING;

-- Diretor e administrador recebem por padrão
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'estoque.conferencia.reabrir'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('diretor', 'administrador')
ON CONFLICT DO NOTHING;

-- Ajusta ordem do operacional se já existir
UPDATE permissoes SET ordem = 203 WHERE codigo = 'estoque.operacional';

COMMIT;
