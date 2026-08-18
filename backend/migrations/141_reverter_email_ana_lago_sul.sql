BEGIN;

-- A 140 trocou o e-mail da Ana (Sudoeste) por engano.
-- Login correto: bklagosul@grupoalvim.com.br
UPDATE usuarios
SET email = 'bklagosul@grupoalvim.com.br'
WHERE LOWER(email) = 'bk.sudoeste@gmail.com'
  AND id_usuario IN (
    SELECT ul.id_usuario
    FROM usuario_lojas ul
    JOIN lojas l ON l.id_loja = ul.id_loja
    WHERE TRIM(COALESCE(l.bk_number, '')) = '23240'
  );

COMMIT;
