-- Foto de perfil do usuário (aparece no sidebar ao logar).
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS avatar_mime TEXT,
  ADD COLUMN IF NOT EXISTS avatar_bytes BYTEA;

COMMENT ON COLUMN usuarios.avatar_mime IS 'MIME da foto de perfil (image/jpeg, image/png, image/webp)';
COMMENT ON COLUMN usuarios.avatar_bytes IS 'Bytes da foto de perfil';
