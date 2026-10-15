-- Permissões por perfil (cargo). O usuário herda o que o perfil enxerga/faz.

BEGIN;

CREATE TABLE IF NOT EXISTS cargo_permissoes (
  codigo_cargo VARCHAR(50) NOT NULL REFERENCES cargos(codigo) ON UPDATE CASCADE ON DELETE CASCADE,
  codigo VARCHAR(80) NOT NULL REFERENCES permissoes(codigo) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (codigo_cargo, codigo)
);

CREATE INDEX IF NOT EXISTS idx_cargo_permissoes_codigo ON cargo_permissoes(codigo);

-- Seed: une o que os usuários de cada perfil já tinham
INSERT INTO cargo_permissoes (codigo_cargo, codigo)
SELECT DISTINCT u.cargo_aprovacao, up.codigo
FROM usuarios u
JOIN usuario_permissoes up ON up.id_usuario = u.id_usuario
JOIN cargos c ON c.codigo = u.cargo_aprovacao
JOIN permissoes p ON p.codigo = up.codigo
WHERE u.cargo_aprovacao IS NOT NULL
  AND COALESCE(u.ativo, TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
