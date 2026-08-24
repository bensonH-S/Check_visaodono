BEGIN;

-- Regionais não veem o mapa de técnicos no app Meridian.
DELETE FROM usuario_permissoes up
USING usuarios u
WHERE up.id_usuario = u.id_usuario
  AND up.codigo = 'frota.mapa.ver'
  AND LOWER(COALESCE(u.cargo_aprovacao, '')) IN ('supervisor_regional', 'regional', 'supervisor')
  AND NOT EXISTS (
    SELECT 1
    FROM usuario_permissoes p
    WHERE p.id_usuario = u.id_usuario
      AND p.codigo IN ('lojas.todas', 'frota.gerenciar')
  );

COMMIT;
