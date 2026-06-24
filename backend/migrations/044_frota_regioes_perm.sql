BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('frota.regioes', 'Gerenciar regiões de atuação da frota', 'Frota', 142)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'frota.regioes'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN (
  'coordenador', 'administrador', 'ti'
)
ON CONFLICT DO NOTHING;

COMMIT;
