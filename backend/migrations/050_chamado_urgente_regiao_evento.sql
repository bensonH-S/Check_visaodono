BEGIN;

INSERT INTO manut_notificacao_eventos (codigo, descricao, notifica_abrir, notifica_ver) VALUES
  ('chamado_urgente_regiao', 'Chamado urgente na região de atuação (alta/crítica)', TRUE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
