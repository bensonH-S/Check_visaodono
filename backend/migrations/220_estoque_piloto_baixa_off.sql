-- v3.1.161 — desliga o piloto de baixa na rede: todo insumo da ficha baixa (não só contagem_diaria).
-- Aplicado pelo PROD_baixas100_cenarioC.sql (com rowcount); este arquivo versiona a mudança.
ALTER TABLE lojas_estoque_perfil ALTER COLUMN piloto_baixa SET DEFAULT FALSE;
UPDATE lojas_estoque_perfil SET piloto_baixa = FALSE, atualizado_em = NOW() WHERE piloto_baixa;
