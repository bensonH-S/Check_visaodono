-- Contagem semanal dos itens críticos (mix, carnes, pão, batata, latas).
-- tipo na contagem + flag/grupo no insumo para filtrar o inventário parcial.

ALTER TABLE estoque_contagens
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'completa';

ALTER TABLE estoque_contagens
  DROP CONSTRAINT IF EXISTS estoque_contagens_tipo_check;

ALTER TABLE estoque_contagens
  ADD CONSTRAINT estoque_contagens_tipo_check
  CHECK (tipo IN ('completa', 'critica_semanal'));

COMMENT ON COLUMN estoque_contagens.tipo IS
  'completa = todos os insumos ativos; critica_semanal = só itens marcados contagem_critica';

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS contagem_critica BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS grupo_critico TEXT;

ALTER TABLE insumos
  DROP CONSTRAINT IF EXISTS insumos_grupo_critico_check;

ALTER TABLE insumos
  ADD CONSTRAINT insumos_grupo_critico_check
  CHECK (
    grupo_critico IS NULL
    OR grupo_critico IN ('mix', 'carnes', 'pao', 'batata', 'lata')
  );

COMMENT ON COLUMN insumos.contagem_critica IS
  'Incluir na contagem semanal de críticos (mix, carnes, pão, batata, latas)';
COMMENT ON COLUMN insumos.grupo_critico IS
  'Grupo da contagem semanal: mix | carnes | pao | batata | lata';

CREATE INDEX IF NOT EXISTS idx_insumos_contagem_critica
  ON insumos (id_loja)
  WHERE contagem_critica = TRUE AND ativo = TRUE;

-- Reset e marca por descrição (todas as lojas). Evita embalagens/brindes.
UPDATE insumos SET contagem_critica = FALSE, grupo_critico = NULL;

-- Batata (produto, não cartonagem)
UPDATE insumos
SET contagem_critica = TRUE, grupo_critico = 'batata'
WHERE ativo = TRUE
  AND descricao ~* 'BATATA'
  AND descricao !~* 'CARTONAGEM|CART BATATA|FUNDO|TAMPA|SAQUINHO|EMBALAG';

-- Carnes
UPDATE insumos
SET contagem_critica = TRUE, grupo_critico = 'carnes'
WHERE ativo = TRUE
  AND descricao ~* 'CARNE'
  AND descricao !~* 'MARMITA|BRINDE|CART';

-- Pão
UPDATE insumos
SET contagem_critica = TRUE, grupo_critico = 'pao'
WHERE ativo = TRUE
  AND descricao ~* 'P[AÃ]O'
  AND descricao !~* 'CESTO|BRINDE|CART';

-- Latas de refrigerante
UPDATE insumos
SET contagem_critica = TRUE, grupo_critico = 'lata'
WHERE ativo = TRUE
  AND descricao ~* 'LATA'
  AND descricao ~* 'COCA|PEPSI|GUARAN|SPRITE|FANTA|SUKITA|SODA|REFRI|ANTARCT'
  AND descricao !~* 'BRINDE|CART|COPO|CANUDO|TAMPA';

-- Mix = bags/BIB de refrigerante (fonte/torneira), não molhos
UPDATE insumos
SET contagem_critica = TRUE, grupo_critico = 'mix'
WHERE ativo = TRUE
  AND descricao ~* 'BAG'
  AND descricao ~* 'PEPSI|COCA|GUARAN|SPRITE|FANTA|SUKITA|SODA|LIPTON|CHA |REFRI'
  AND descricao !~* 'MAIONESE|BARBECUE|MOLHO|BRINDE|CART';
