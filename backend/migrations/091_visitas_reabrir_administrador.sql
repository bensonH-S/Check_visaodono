BEGIN;

-- Administradores também podem reabrir visitas finalizadas
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'portal.visitas.reabrir'
FROM usuarios u
WHERE COALESCE(u.cargo_aprovacao, u.perfil::text) = 'administrador'
ON CONFLICT DO NOTHING;

COMMIT;
