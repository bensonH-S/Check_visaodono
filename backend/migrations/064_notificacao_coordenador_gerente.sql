-- Destinatários coordenador e gerente por evento de notificação
BEGIN;

ALTER TABLE manut_notificacao_eventos
  ADD COLUMN IF NOT EXISTS notifica_coordenador BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notifica_gerente BOOLEAN NOT NULL DEFAULT TRUE;

COMMIT;
