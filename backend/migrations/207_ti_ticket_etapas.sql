-- Etapas do ticket, agrupadas por subcategoria, para marcar o check conforme a fase anda.

BEGIN;

CREATE TABLE IF NOT EXISTS ti_ticket_etapas (
  id_etapa BIGSERIAL PRIMARY KEY,
  id_ticket BIGINT NOT NULL REFERENCES ti_tickets(id_ticket) ON DELETE CASCADE,
  subcategoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  feita BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INT NOT NULL DEFAULT 0,
  feita_em TIMESTAMPTZ,
  feita_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ti_ticket_etapas_ticket
  ON ti_ticket_etapas (id_ticket, ordem, id_etapa);

INSERT INTO ti_ticket_etapas (id_ticket, subcategoria, titulo, ordem)
SELECT t.id_ticket, v.subcategoria, v.titulo, v.ordem
FROM ti_tickets t
CROSS JOIN (VALUES
  ('Fase 1 — Pedido', 'Conferir o rascunho de 1 loja (fora da 706 e do Venâncio): vendas, saldo, nota a caminho e teto de CMP.', 10),
  ('Fase 1 — Pedido', 'Platlog: preencher o carrinho no eSupri, guardar o print e zerar. Pedido não enviado.', 20),
  ('Fase 1 — Pedido', 'Coca: Coke.Net faz o pedido e o Conecta só puxa a NF.', 30),
  ('Fase 1 — Pedido', 'Ideal Work no mesmo rascunho.', 40),
  ('Fase 1 — Pedido', 'Gimba no mesmo rascunho.', 50),
  ('Fase 1 — Pedido', 'Envio automático só depois dos checks acima.', 60),
  ('Fase 2 — Estoque', 'Repaginar a aba de estoque no padrão novo do sistema.', 70),
  ('Fase 2 — Estoque', 'Controle do dia: diff, quem contou, break, gap, CMV e CMP.', 80),
  ('Fase 2 — Estoque', 'Agente Alvim cobra a loja quando aparece diferença.', 90)
) AS v(subcategoria, titulo, ordem)
WHERE t.id_ticket = 54
  AND t.titulo = 'MERIDIAN | Gestão Autônoma de Compras e Reposição'
  AND NOT EXISTS (
    SELECT 1 FROM ti_ticket_etapas e WHERE e.id_ticket = t.id_ticket
  );

COMMIT;
