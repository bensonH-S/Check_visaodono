-- Diária só com essenciais: batata, pão, carne, queijo,
-- vegetais (tomate, alface, cebola), mix baunilha/doce de leite, bacon.
-- Sai: frango, óleo, copo/refil, pepino.

BEGIN;

ALTER TABLE insumos DROP CONSTRAINT IF EXISTS insumos_grupo_diario_check;
ALTER TABLE insumos
  ADD CONSTRAINT insumos_grupo_diario_check
  CHECK (
    grupo_diario IS NULL
    OR grupo_diario IN (
      'carne', 'frango', 'queijo', 'bacon', 'pao', 'batata', 'oleo', 'refil',
      'vegetais', 'mix_sobremesa'
    )
  );

UPDATE insumos
SET contagem_diaria = FALSE, grupo_diario = NULL, atualizado_em = NOW()
WHERE contagem_diaria = TRUE OR grupo_diario IS NOT NULL;

-- Mix de máquina (baunilha / doce de leite), não bag 18L nem Nutella
UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'mix_sobremesa', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* '(BAUNILHA|DOCE DE LEITE)'
  AND descricao ~* '(BEBIDA LACTEA|\yMIX\y|SORVETE|SOFT)'
  AND descricao !~* 'NUTELLA|CASQUINHA|SUNDAE|COPO|BRINDE|CART|XAROPE|CONFEITARIA|MOCA'
  AND descricao !~* '18\s*LT';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'batata', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'BATATA'
  AND descricao !~* 'CARTONAGEM|CART BATATA|FUNDO|TAMPA|SAQUINHO|EMBALAG';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'pao', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'P[AÃ]O'
  AND descricao !~* 'CESTO|BRINDE|CART';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'queijo', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'QUEIJO'
  AND descricao !~* 'MOLHO';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'bacon', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'BACON'
  AND descricao !~* 'MAIONESE|BACONESE|SACHET|MOLHO';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'carne', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'CARNE'
  AND descricao !~* 'MARMITA|BRINDE|CART';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'vegetais', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* '(ALFACE|TOMATE|CEBOLA)'
  AND descricao !~* 'FRITA|CRISPY|CART|SAC';

-- Contagens diárias abertas acompanham o cadastro novo
DELETE FROM estoque_itens i
USING estoque_contagens c, insumos p
WHERE i.id_contagem = c.id_contagem
  AND i.id_insumo = p.id_insumo
  AND c.status = 'aberta'
  AND COALESCE(c.tipo, '') = 'diaria'
  AND COALESCE(p.contagem_diaria, FALSE) = FALSE;

INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
FROM estoque_contagens c
JOIN insumos p
  ON p.id_loja = c.id_loja AND p.ativo = TRUE AND p.contagem_diaria = TRUE
LEFT JOIN estoque_saldos s
  ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
WHERE c.status = 'aberta'
  AND COALESCE(c.tipo, '') = 'diaria'
  AND NOT EXISTS (
    SELECT 1 FROM estoque_itens x
    WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
  );

COMMENT ON COLUMN insumos.contagem_diaria IS
  'Diária essenciais: batata, pão, carne, queijo, vegetais (tomate/alface/cebola), mix baunilha/doce de leite, bacon';
COMMENT ON COLUMN insumos.grupo_diario IS
  'Grupo da diária: carne | queijo | bacon | pao | batata | vegetais | mix_sobremesa';

COMMIT;
