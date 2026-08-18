BEGIN;

-- Deixa os logins do Henrique com exatamente as mesmas permissões do Marciel.
DELETE FROM usuario_permissoes up
USING usuarios u
WHERE up.id_usuario = u.id_usuario
  AND u.ativo = TRUE
  AND LOWER(u.email) IN (
    'crislanedf1002@gmail.com',
    'bk.sudoeste@gmail.com',
    'bklagosul@grupoalvim.com.br',
    'arthurmiguelsz93@gmail.com',
    'bknoroeste@grupoalvim.com.br',
    'bkpontealta@grupoalvim.com.br',
    'bksobradinho@grupoalvim.com.br',
    'bkasanorte7@grupoalvim.com.br',
    'bkplaza@grupoalvim.com.br'
  )
  AND up.codigo NOT IN (
    SELECT m.codigo
    FROM usuario_permissoes m
    WHERE m.id_usuario = (
      SELECT id_usuario FROM usuarios
      WHERE LOWER(email) = 'marcielsouza2m@gmail.com'
      LIMIT 1
    )
  );

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
    'crislanedf1002@gmail.com',
    'bk.sudoeste@gmail.com',
    'bklagosul@grupoalvim.com.br',
    'arthurmiguelsz93@gmail.com',
    'bknoroeste@grupoalvim.com.br',
    'bkpontealta@grupoalvim.com.br',
    'bksobradinho@grupoalvim.com.br',
    'bkasanorte7@grupoalvim.com.br',
    'bkplaza@grupoalvim.com.br'
  )
ON CONFLICT (id_usuario, codigo) DO NOTHING;

COMMIT;
