ALTER TABLE manut_chamados
  ADD COLUMN IF NOT EXISTS assumido_em TIMESTAMPTZ;

UPDATE manut_chamados
SET assumido_em = updated_at
WHERE status = 'em_atendimento'
  AND id_tecnico IS NOT NULL
  AND assumido_em IS NULL;

CREATE TABLE IF NOT EXISTS manut_notificacoes (
  id_notificacao SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_chamado INT NOT NULL REFERENCES manut_chamados(id_chamado) ON DELETE CASCADE,
  tipo VARCHAR(40) NOT NULL DEFAULT 'resposta',
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manut_notif_usuario
  ON manut_notificacoes(id_usuario, lida, created_at DESC);
