BEGIN;

CREATE TABLE IF NOT EXISTS time_campo_notificacoes (
  id_notificacao SERIAL PRIMARY KEY,
  id_visita INT NOT NULL REFERENCES visitas(id_visita) ON DELETE CASCADE,
  id_loja INT NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  id_usuario_destino INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_time_campo_notif_visita_tipo_dest
  ON time_campo_notificacoes (id_visita, tipo, id_usuario_destino);

CREATE INDEX IF NOT EXISTS idx_time_campo_notif_tipo_enviado
  ON time_campo_notificacoes (tipo, enviado_em DESC);

COMMIT;
