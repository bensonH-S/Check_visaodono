-- Orçamentos enviados antes do destino de aprovação ficam com Financeiro por padrão
UPDATE manut_chamados
SET aprovacao_destino = 'financeiro'
WHERE status = 'em_aprovacao'
  AND tipo_chamado = 'orcamento'
  AND aprovacao_destino IS NULL;
