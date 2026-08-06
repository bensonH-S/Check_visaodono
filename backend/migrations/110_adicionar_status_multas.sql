-- Migração para adicionar a coluna status na tabela frota_multas_detran
ALTER TABLE frota_multas_detran ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Em Aberto';
