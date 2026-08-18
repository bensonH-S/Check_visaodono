BEGIN;

-- Copia o nível de acesso do Marciel (marcielsouza2m@gmail.com)
-- para os logins de loja enviados pelo Henrique.
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
