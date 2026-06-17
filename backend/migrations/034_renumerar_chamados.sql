-- Remove chamados 1–8, renumerar o 9 para id/numero 1 e reiniciar sequência.
-- Executar: node scripts/renumerar-chamados.js
-- (Este SQL é referência; o script trata FKs e colunas dinamicamente.)

BEGIN;

DELETE FROM manut_chamados
WHERE id_chamado IN (1, 2, 3, 4, 5, 6, 7, 8);

COMMIT;
