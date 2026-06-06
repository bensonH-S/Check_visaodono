-- Tipos de evento que geram notificação nos chamados (abrir + ver recebem)
BEGIN;

CREATE TABLE IF NOT EXISTS manut_notificacao_eventos (
  codigo VARCHAR(40) PRIMARY KEY,
  descricao TEXT NOT NULL,
  notifica_abrir BOOLEAN NOT NULL DEFAULT TRUE,
  notifica_ver BOOLEAN NOT NULL DEFAULT TRUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO manut_notificacao_eventos (codigo, descricao, notifica_abrir, notifica_ver) VALUES
  ('novo_chamado', 'Novo chamado aberto na loja', TRUE, TRUE),
  ('resposta', 'Nova mensagem no chamado', TRUE, TRUE),
  ('anexo', 'Fotos ou vídeos adicionados ao chamado', TRUE, TRUE),
  ('assumido', 'Chamado atribuído a técnico', TRUE, TRUE),
  ('fechamento', 'Chamado concluído ou cancelado', TRUE, TRUE),
  ('reabertura', 'Chamado reaberto', TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
