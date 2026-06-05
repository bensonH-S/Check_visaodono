-- Autenticação e perfis (mesmo modelo do portal de manutenção)
BEGIN;

DO $$ BEGIN
  CREATE TYPE perfil_usuario AS ENUM ('administrador', 'coordenador', 'gerente', 'tecnico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS perfil perfil_usuario,
  ADD COLUMN IF NOT EXISTS id_loja INT REFERENCES lojas(id_loja);

UPDATE usuarios SET perfil = 'coordenador'::perfil_usuario WHERE perfil IS NULL AND cargo ILIKE '%supervis%';
UPDATE usuarios SET perfil = 'gerente'::perfil_usuario WHERE perfil IS NULL AND cargo ILIKE '%auditor%';
UPDATE usuarios SET perfil = 'gerente'::perfil_usuario WHERE perfil IS NULL;

ALTER TABLE usuarios
  ALTER COLUMN perfil SET DEFAULT 'gerente',
  ALTER COLUMN perfil SET NOT NULL;

COMMIT;
