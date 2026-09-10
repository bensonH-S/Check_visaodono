-- Anexos de NC: mídia criptografada em BYTEA (mesmo padrão de manut_anexos / frota_anexos / energia_anexos).
-- A coluna era TEXT; insert de Buffer AES gerava "invalid byte sequence for encoding UTF8".

BEGIN;

-- Inserts binários em TEXT falhavam; limpa qualquer residual inválido antes do cast.
DELETE FROM nc_anexos;

ALTER TABLE nc_anexos
  ALTER COLUMN arquivo_url TYPE BYTEA
  USING CASE
    WHEN arquivo_url IS NULL THEN NULL::bytea
    ELSE convert_to(arquivo_url, 'UTF8')
  END;

COMMENT ON COLUMN nc_anexos.arquivo_url IS 'Arquivo criptografado (AES-256-GCM)';

COMMIT;
