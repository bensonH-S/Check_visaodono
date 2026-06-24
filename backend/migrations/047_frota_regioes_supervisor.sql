BEGIN;

-- Regiões de frota: supervisor/regional (não coordenador)
DELETE FROM usuario_permissoes up
USING usuarios u
WHERE up.id_usuario = u.id_usuario
  AND up.codigo = 'frota.regioes'
  AND COALESCE(u.cargo_aprovacao, u.perfil::text) = 'coordenador';

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'frota.regioes'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) IN ('supervisor_regional', 'regional')
ON CONFLICT DO NOTHING;

COMMIT;
