-- Perguntas com estrelas usam nota_estrelas (1–5), não a coluna resposta (Sim/Não).
-- A nota final da visita converte estrelas em %: (nota_estrelas / 5) * 100
COMMENT ON COLUMN respostas.resposta IS 'Sim/Não/N/A — apenas perguntas sim_nao; NULL em perguntas de estrelas';
COMMENT ON COLUMN respostas.nota_estrelas IS 'Avaliação 1 a 5 estrelas — 1=1 estrela, 2=2 estrelas, … 5=5 estrelas';
