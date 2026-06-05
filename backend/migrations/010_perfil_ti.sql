-- Perfil TI: visão completa + gestão de usuários
BEGIN;

DO $$ BEGIN
  ALTER TYPE perfil_usuario ADD VALUE IF NOT EXISTS 'ti';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
