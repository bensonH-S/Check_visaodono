-- Migração para remover a coluna situacao da tabela frota_multas_detran
ALTER TABLE frota_multas_detran DROP COLUMN IF EXISTS situacao;
