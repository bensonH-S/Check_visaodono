-- Prazo nos tickets TI + notificações do portal (TI e pagamento).

BEGIN;

ALTER TABLE ti_tickets
  ADD COLUMN IF NOT EXISTS prazo DATE;

CREATE INDEX IF NOT EXISTS idx_ti_tickets_prazo ON ti_tickets(prazo)
  WHERE prazo IS NOT NULL;

CREATE TABLE IF NOT EXISTS portal_notificacoes (
  id_notificacao BIGSERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL DEFAULT '',
  link TEXT,
  ref_tipo VARCHAR(40),
  ref_id TEXT,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_notif_usuario
  ON portal_notificacoes(id_usuario, lida, created_at DESC);

COMMIT;
