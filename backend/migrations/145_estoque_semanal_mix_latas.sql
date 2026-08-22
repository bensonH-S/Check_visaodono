-- Semanal de segunda-feira: só mix (bags 18L) e latas.
-- Carne, pão e batata saem da semanal (continuam na diária).
-- Bags 18L saem da diária (ficam só na semanal de mix).
-- Contagens já abertas/finalizadas não são alteradas — só o cadastro para as próximas.

UPDATE insumos
SET contagem_critica = FALSE, grupo_critico = NULL
WHERE grupo_critico IN ('carnes', 'pao', 'batata');

UPDATE insumos
SET contagem_diaria = FALSE, grupo_diario = NULL
WHERE grupo_diario = 'refil'
  AND descricao ~* 'BAG'
  AND descricao ~* '18'
  AND descricao ~* 'LT';

COMMENT ON COLUMN estoque_contagens.tipo IS
  'completa = todos; critica_semanal = mix+latas (segunda); diaria = giro do dia da loja';

COMMENT ON COLUMN insumos.contagem_critica IS
  'Incluir na contagem semanal de segunda (mix/bags e latas)';
COMMENT ON COLUMN insumos.grupo_critico IS
  'Grupo da semanal: mix | lata';
COMMENT ON COLUMN insumos.contagem_diaria IS
  'Incluir na contagem diária (carnes, frango, queijo, bacon, pão, batata, óleo, copos)';
