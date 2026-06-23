-- Anexos da frota: mídia criptografada em BYTEA (mesmo padrão de manut_anexos).
ALTER TABLE frota_anexos
  ALTER COLUMN arquivo_url TYPE BYTEA
  USING CASE
    WHEN arquivo_url IS NULL THEN NULL::bytea
    ELSE arquivo_url::bytea
  END;

COMMENT ON COLUMN frota_anexos.arquivo_url IS 'Arquivo criptografado (AES-256-GCM)';
