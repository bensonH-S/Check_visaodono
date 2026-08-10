BEGIN;

INSERT INTO permissoes (codigo, nome, grupo, ordem) VALUES
  (
    'escalas.visitas.editar_delivery',
    'Preencher escala de delivery',
    'Escalas',
    153
  )
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  grupo = EXCLUDED.grupo,
  ordem = EXCLUDED.ordem;

-- Usuário delivery: remove poder de diretor na escala
DELETE FROM usuario_permissoes
WHERE codigo = 'escalas.visitas.gerenciar'
  AND id_usuario IN (
    SELECT id_usuario FROM usuarios
    WHERE LOWER(email) = LOWER('deliverygrupoalvim2025@gmail.com')
       OR LOWER(COALESCE(cargo_aprovacao, '')) = 'delivery'
  );

-- Concede editar delivery + ver
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'escalas.visitas.editar_delivery'
FROM usuarios u
WHERE u.ativo = TRUE
  AND (
    LOWER(u.email) = LOWER('deliverygrupoalvim2025@gmail.com')
    OR LOWER(COALESCE(u.cargo_aprovacao, '')) = 'delivery'
  )
ON CONFLICT DO NOTHING;

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, 'escalas.visitas.ver'
FROM usuarios u
WHERE u.ativo = TRUE
  AND (
    LOWER(u.email) = LOWER('deliverygrupoalvim2025@gmail.com')
    OR LOWER(COALESCE(u.cargo_aprovacao, '')) = 'delivery'
  )
ON CONFLICT DO NOTHING;

COMMIT;
