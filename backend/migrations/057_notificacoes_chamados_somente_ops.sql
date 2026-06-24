-- Remove alertas de chamados que não são mais usados (sino/push só urgente + atribuído).
DELETE FROM manut_notificacoes
WHERE tipo IN (
  'novo_chamado',
  'anexo',
  'resposta',
  'fechamento',
  'reabertura',
  'aguardando_aprovacao'
);
