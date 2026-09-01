-- Gestores de loja iguais ao Marciel (Terraço): estoque, energia, NC e visitas.
-- Sem chamados de manutenção. Técnico, admin e regional não entram nesta regra.

BEGIN;

-- 1) Tira manutenção de gerente / sub / coordenador de loja.
DELETE FROM usuario_permissoes up
USING usuarios u
WHERE up.id_usuario = u.id_usuario
  AND u.ativo = TRUE
  AND up.codigo LIKE 'chamados.%'
  AND LOWER(COALESCE(u.cargo_aprovacao, u.perfil::text)) IN (
    'gerente',
    'coordenador',
    'subgerente',
    'sub_gerente',
    'assistente_gerente',
    'gestor'
  );

-- 2) Quem gerencia loja fica com o pacote do Marciel (nem a mais, nem a menos).
CREATE TEMP TABLE tmp_gestores_loja AS
SELECT DISTINCT u.id_usuario
FROM usuarios u
JOIN usuario_lojas ul ON ul.id_usuario = u.id_usuario
WHERE u.ativo = TRUE
  AND LOWER(COALESCE(u.cargo_aprovacao, u.perfil::text)) IN (
    'gerente',
    'subgerente',
    'sub_gerente',
    'assistente_gerente',
    'gestor'
  );

DELETE FROM usuario_permissoes up
USING tmp_gestores_loja g
WHERE up.id_usuario = g.id_usuario
  AND up.codigo NOT IN (
    SELECT m.codigo
    FROM usuario_permissoes m
    JOIN usuarios u ON u.id_usuario = m.id_usuario
    WHERE LOWER(u.email) = 'marcielsouza2m@gmail.com'
  );

INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT g.id_usuario, m.codigo
FROM tmp_gestores_loja g
JOIN usuario_permissoes m
  ON m.id_usuario = (
    SELECT id_usuario FROM usuarios
    WHERE LOWER(email) = 'marcielsouza2m@gmail.com'
    LIMIT 1
  )
ON CONFLICT (id_usuario, codigo) DO NOTHING;

COMMIT;
