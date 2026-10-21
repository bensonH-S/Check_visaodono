-- Ticket 54 fica só com as etapas da Platlog, em ordem. Não mexe se alguém já marcou check.

BEGIN;

DELETE FROM ti_ticket_etapas e
WHERE e.id_ticket = 54
  AND NOT EXISTS (
    SELECT 1 FROM ti_ticket_etapas x WHERE x.id_ticket = 54 AND x.feita
  );

INSERT INTO ti_ticket_etapas (id_ticket, subcategoria, titulo, ordem)
SELECT t.id_ticket, v.subcategoria, v.titulo, v.ordem
FROM ti_tickets t
CROSS JOIN (VALUES
  ('Platlog', 'Abrir o pedido de 1 loja que não seja 706 nem Venâncio.', 10),
  ('Platlog', 'Conferir 5 insumos: dias de estoque, o que está na nota e o teto de CMP.', 20),
  ('Platlog', 'Ajustar a coluna Caixas até a lista parecer o pedido da semana.', 30),
  ('Platlog', 'Montar no eSupri, guardar o print e zerar. O pedido não é enviado.', 40),
  ('Platlog', 'Repetir o rascunho em outra loja Platlog.', 50),
  ('Platlog', 'Envio do pedido só depois dos checks acima.', 60)
) AS v(subcategoria, titulo, ordem)
WHERE t.id_ticket = 54
  AND t.titulo = 'MERIDIAN | Gestão Autônoma de Compras e Reposição'
  AND NOT EXISTS (
    SELECT 1 FROM ti_ticket_etapas e WHERE e.id_ticket = t.id_ticket
  );

COMMIT;
