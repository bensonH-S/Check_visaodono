-- Permissão para apagar relatórios/visitas de checklist
BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('portal.visitas.apagar', 'Apagar relatórios de visitas', 'Visitas', 21)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'portal.visitas.apagar'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('administrador', 'ceo', 'diretor')
ON CONFLICT DO NOTHING;

COMMIT;
