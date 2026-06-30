BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  ('frota.mapa.ver', 'Ver mapa de técnicos em tempo real', 'Frota', 142)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES ('frota.mapa.ver')) AS p(codigo)
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN (
  'supervisor_regional', 'diretor', 'ceo', 'administrador'
)
ON CONFLICT DO NOTHING;

COMMIT;
