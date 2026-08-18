BEGIN;

-- Mesmas permissões de estoque do Marciel (Terraço) para gerentes de
-- 201 Norte (19929), Ponte Alta (31782), Recanto (30769) e Lago Sul (20415).
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT u.id_usuario, p.codigo
FROM usuarios u
JOIN usuario_lojas ul ON ul.id_usuario = u.id_usuario
JOIN lojas l ON l.id_loja = ul.id_loja
CROSS JOIN (VALUES
  ('estoque.conferencia'),
  ('estoque.break'),
  ('estoque.operacional')
) AS p(codigo)
WHERE u.ativo = TRUE
  AND LOWER(COALESCE(u.cargo_aprovacao, u.perfil::text)) = 'gerente'
  AND TRIM(COALESCE(l.bk_number, '')) IN ('19929', '31782', '30769', '20415')
ON CONFLICT (id_usuario, codigo) DO NOTHING;

-- Regionais: entram no app de estoque e veem a aba Break.
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT u.id_usuario, p.codigo
FROM usuarios u
CROSS JOIN (VALUES
  ('estoque.conferencia'),
  ('estoque.break')
) AS p(codigo)
WHERE u.ativo = TRUE
  AND (
    LOWER(COALESCE(u.cargo_aprovacao, '')) IN ('supervisor_regional', 'regional', 'supervisor')
    OR u.id_usuario IN (SELECT id_regional FROM frota_regioes WHERE id_regional IS NOT NULL)
    OR u.id_usuario IN (SELECT id_usuario FROM frota_regiao_regionais)
  )
ON CONFLICT (id_usuario, codigo) DO NOTHING;

COMMIT;
