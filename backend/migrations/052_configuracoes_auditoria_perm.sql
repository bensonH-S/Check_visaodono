-- Permissão para auditoria do sistema (substitui regra fixa por cargo)
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('configuracoes.auditoria', 'Ver auditoria do sistema', 'Configurações', 71)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'configuracoes.auditoria'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('administrador', 'ceo', 'diretor')
ON CONFLICT DO NOTHING;

COMMIT;
