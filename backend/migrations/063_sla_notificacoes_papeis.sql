-- Papéis por evento de notificação + alertas de SLA (80% e estourado)
BEGIN;

ALTER TABLE manut_notificacao_eventos
  ADD COLUMN IF NOT EXISTS notifica_diretor BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notifica_tecnico BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notifica_supervisor BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE manut_chamados
  ADD COLUMN IF NOT EXISTS sla_notif_80_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_notif_estourado_em TIMESTAMPTZ;

INSERT INTO manut_notificacao_eventos (
  codigo, descricao, notifica_abrir, notifica_ver,
  notifica_diretor, notifica_tecnico, notifica_supervisor,
  template_mensagem, sistema
) VALUES
  (
    'sla_alerta_80',
    'SLA do chamado atingiu 80% do prazo',
    TRUE, TRUE, TRUE, TRUE, TRUE,
    'Atenção: chamado #{numero} ({loja}) está com 80% do prazo de SLA consumido.',
    TRUE
  ),
  (
    'sla_estourado',
    'SLA do chamado estourado',
    TRUE, TRUE, TRUE, TRUE, TRUE,
    'Urgente: chamado #{numero} ({loja}) estourou o prazo de SLA.',
    TRUE
  )
ON CONFLICT (codigo) DO NOTHING;

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Atenção: chamado #{numero} ({loja}) está com 80% do prazo de SLA consumido.'
WHERE codigo = 'sla_alerta_80' AND (template_mensagem IS NULL OR template_mensagem = '');

UPDATE manut_notificacao_eventos SET
  template_mensagem = 'Urgente: chamado #{numero} ({loja}) estourou o prazo de SLA.'
WHERE codigo = 'sla_estourado' AND (template_mensagem IS NULL OR template_mensagem = '');

COMMIT;
