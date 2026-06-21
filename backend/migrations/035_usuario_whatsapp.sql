-- WhatsApp: telefone do usuário + sessão WPP dedicada + eventos de notificação faltantes
BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS telefone_whatsapp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS notifica_whatsapp BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS wpp_sessao (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  session_name VARCHAR(80) NOT NULL,
  token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO manut_notificacao_eventos (codigo, descricao, notifica_abrir, notifica_ver) VALUES
  ('aguardando_aprovacao', 'Solicitante aguardando aprovação do orçamento', TRUE, TRUE),
  ('encaminhar_diretor', 'Orçamento encaminhado ao Diretor', TRUE, TRUE),
  ('aprovacao_diretor', 'Orçamento aprovado pelo Diretor', TRUE, TRUE),
  ('recusa_aprovacao', 'Orçamento recusado', TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
