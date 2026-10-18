-- Anexos (imagens e documentos) nos tickets TI.

BEGIN;

CREATE TABLE IF NOT EXISTS ti_ticket_anexos (
  id_anexo BIGSERIAL PRIMARY KEY,
  id_ticket BIGINT NOT NULL REFERENCES ti_tickets(id_ticket) ON DELETE CASCADE,
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  tipo_mime VARCHAR(120) NOT NULL,
  arquivo_bytes BYTEA NOT NULL,
  tamanho_bytes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ti_ticket_anexos_ticket
  ON ti_ticket_anexos(id_ticket, created_at ASC, id_anexo ASC);

COMMIT;
