-- Kanban: novos status + tipo orçamento
BEGIN;

DO $$ BEGIN
  ALTER TYPE manut_status_chamado ADD VALUE 'em_aprovacao';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE manut_status_chamado ADD VALUE 'aprovado';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE manut_tipo_chamado AS ENUM ('normal', 'orcamento');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE manut_chamados
  ADD COLUMN IF NOT EXISTS tipo_chamado manut_tipo_chamado NOT NULL DEFAULT 'normal';

INSERT INTO manut_notificacao_eventos (codigo, descricao, notifica_abrir, notifica_ver) VALUES
  ('envio_aprovacao', 'Chamado enviado para aprovação de orçamento', TRUE, TRUE),
  ('aprovacao', 'Orçamento aprovado pelo diretor', TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
