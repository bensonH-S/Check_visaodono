-- Templates editáveis para eventos de notificação
BEGIN;

ALTER TABLE manut_notificacao_eventos
  ADD COLUMN IF NOT EXISTS template_mensagem TEXT,
  ADD COLUMN IF NOT EXISTS template_destinatario TEXT,
  ADD COLUMN IF NOT EXISTS sistema BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Novo chamado urgente #{numero} - {loja}. Verifique Imediatamente!'
WHERE codigo = 'chamado_urgente_regiao' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Chamado atribuído! Chamado #{numero} atribuído {tecnico}',
  template_destinatario = 'Chamado atribuído! Chamado #{numero} atribuído a você'
WHERE codigo = 'assumido' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Novo Chamado #{numero} - Aberto ({loja})'
WHERE codigo = 'novo_chamado' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Nova Mensagem Chamado #{numero}'
WHERE codigo = 'resposta' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Novo anexo adicionado no chamado #{numero}'
WHERE codigo = 'anexo' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Chamado #{numero} - Concluído'
WHERE codigo = 'fechamento' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Chamado #{numero} - Reaberto'
WHERE codigo = 'reabertura' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Orçamento pendente — chamado #{numero}'
WHERE codigo = 'envio_aprovacao' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Aguardando aprovação — chamado #{numero}'
WHERE codigo = 'aguardando_aprovacao' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Orçamento encaminhado ao Diretor — #{numero}'
WHERE codigo = 'encaminhar_diretor' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Orçamento aprovado pelo Diretor — #{numero}'
WHERE codigo = 'aprovacao_diretor' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Orçamento aprovado — chamado #{numero}'
WHERE codigo = 'aprovacao' AND template_mensagem IS NULL;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Orçamento recusado — chamado #{numero}'
WHERE codigo = 'recusa_aprovacao' AND template_mensagem IS NULL;

COMMIT;
