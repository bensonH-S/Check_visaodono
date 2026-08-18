BEGIN;

-- Garante o nível do Marciel na gerente da Sudoeste (Ana),
-- qualquer que seja o e-mail cadastrado.
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT u.id_usuario, m.codigo
FROM usuarios u
JOIN usuario_permissoes m
  ON m.id_usuario = (
    SELECT id_usuario FROM usuarios
    WHERE LOWER(email) = 'marcielsouza2m@gmail.com'
    LIMIT 1
  )
WHERE u.ativo = TRUE
  AND LOWER(u.email) IN (
    'bk.sudoeste@gmail.com',
    'bklagosul@grupoalvim.com.br'
  )
ON CONFLICT (id_usuario, codigo) DO NOTHING;

COMMIT;
