-- Contagem diária no app: carne bovina, frango, queijo, bacon, pão, batata, óleo e copos/xarope do free refill.

ALTER TABLE estoque_contagens
  DROP CONSTRAINT IF EXISTS estoque_contagens_tipo_check;

ALTER TABLE estoque_contagens
  ADD CONSTRAINT estoque_contagens_tipo_check
  CHECK (tipo IN ('completa', 'critica_semanal', 'diaria'));

COMMENT ON COLUMN estoque_contagens.tipo IS
  'completa = todos os insumos; critica_semanal = mix/carnes/pão/batata/latas; diaria = giro alto do dia';

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS contagem_diaria BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE insumos
  ADD COLUMN IF NOT EXISTS grupo_diario TEXT;

ALTER TABLE insumos
  DROP CONSTRAINT IF EXISTS insumos_grupo_diario_check;

ALTER TABLE insumos
  ADD CONSTRAINT insumos_grupo_diario_check
  CHECK (
    grupo_diario IS NULL
    OR grupo_diario IN ('carne', 'frango', 'queijo', 'bacon', 'pao', 'batata', 'oleo', 'refil')
  );

COMMENT ON COLUMN insumos.contagem_diaria IS
  'Incluir na contagem diária do app (carne, frango, queijo, bacon, pão, batata, óleo, copos/xarope)';
COMMENT ON COLUMN insumos.grupo_diario IS
  'Grupo da contagem diária: carne | frango | queijo | bacon | pao | batata | oleo | refil';

CREATE INDEX IF NOT EXISTS idx_insumos_contagem_diaria
  ON insumos (id_loja)
  WHERE contagem_diaria = TRUE AND ativo = TRUE;

UPDATE insumos SET contagem_diaria = FALSE, grupo_diario = NULL;

-- Batata (produto, não cartonagem)
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'batata'
WHERE ativo = TRUE
  AND descricao ~* 'BATATA'
  AND descricao !~* 'CARTONAGEM|CART BATATA|FUNDO|TAMPA|SAQUINHO|EMBALAG';

-- Pão
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'pao'
WHERE ativo = TRUE
  AND descricao ~* 'P[AÃ]O'
  AND descricao !~* 'CESTO|BRINDE|CART';

-- Óleo (não kit medidor)
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'oleo'
WHERE ativo = TRUE
  AND descricao ~* 'OLEO|ÓLEO'
  AND descricao !~* 'KIT|MEDIDOR';

-- Queijo fatiado (não molho cheddar)
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'queijo'
WHERE ativo = TRUE
  AND descricao ~* 'QUEIJO'
  AND descricao !~* 'MOLHO';

-- Bacon (não baconnese / maionese)
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'bacon'
WHERE ativo = TRUE
  AND descricao ~* 'BACON'
  AND descricao !~* 'MAIONESE|BACONESE|SACHET|MOLHO';

-- Frango
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'frango'
WHERE ativo = TRUE
  AND descricao ~* 'CHICKEN|FRANGO'
  AND descricao !~* 'LAMINA|SACO |CARTON|MARMITA|ESTROGONOFF|BRINDE';

-- Carne bovina
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'carne'
WHERE ativo = TRUE
  AND descricao ~* 'CARNE'
  AND descricao !~* 'MARMITA|BRINDE|CART';

-- Copos do free refill (440 refrigerante / 550)
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'refil'
WHERE ativo = TRUE
  AND descricao ~* 'COPO'
  AND descricao ~* 'REFRIG|550'
  AND descricao !~* 'SHAKE|SUNDAE|CORTESIA|MIX|MINIONS|PORTA|TAMPA';

-- Xarope / BIB do free refill e bags 18L da fonte
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'refil'
WHERE ativo = TRUE
  AND (
    descricao ~* 'FREE REFIL|FREE REFILL'
    OR (
      descricao ~* 'BAG'
      AND descricao ~* '18\s*LT'
      AND descricao ~* 'COCA|FANTA|SPRITE|GUARANA'
    )
  );
