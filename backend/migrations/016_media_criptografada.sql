-- Mídia criptografada no banco (sem paths em disco).
-- arquivo_url passa a armazenar BYTEA criptografado.
-- foto_url passa a armazenar JSON criptografado (formato v1).

DELETE FROM manut_anexos;

ALTER TABLE manut_anexos
  ALTER COLUMN arquivo_url TYPE BYTEA
  USING NULL::bytea;

UPDATE respostas
SET foto_url = NULL
WHERE foto_url IS NOT NULL
  AND (
    foto_url LIKE '%/uploads/%'
    OR foto_url LIKE '/auditoria/api/uploads/%'
    OR foto_url NOT LIKE '{"v":1%'
  );
