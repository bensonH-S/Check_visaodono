-- Regionais voltam a ver o mapa: carro próprio e dos técnicos da região.
BEGIN;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT u.id_usuario, 'frota.mapa.ver'
FROM usuarios u
WHERE u.ativo = TRUE
  AND (
    LOWER(COALESCE(u.cargo_aprovacao, '')) IN ('supervisor_regional', 'regional', 'supervisor')
    OR u.id_usuario IN (SELECT id_regional FROM frota_regioes WHERE id_regional IS NOT NULL)
    OR u.id_usuario IN (SELECT id_usuario FROM frota_regiao_regionais)
    OR LOWER(TRIM(u.email)) IN (
      'barbara@grupoalvim.com.br',
      'fagno@grupoalvim.com.br',
      'plinio@grupoalvim.com.br'
    )
  )
ON CONFLICT (id_usuario, codigo) DO NOTHING;

COMMIT;
