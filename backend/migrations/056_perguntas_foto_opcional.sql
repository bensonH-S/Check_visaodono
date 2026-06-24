-- Foto opcional por padrão: desmarca "foto obrigatória" em todas as perguntas.
-- O campo de foto continua disponível nos tipos com foto; só bloqueia se marcar na pergunta.
BEGIN;

UPDATE perguntas SET requer_foto = FALSE WHERE requer_foto = TRUE;

COMMIT;
