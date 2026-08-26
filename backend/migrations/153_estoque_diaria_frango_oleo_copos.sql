-- Devolve frango, óleo e copos/xarope à contagem diária.
-- Mix 18L (BAG) continua só na semanal. Pepino continua fora.

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
SET contagem_diaria = TRUE, grupo_diario = 'oleo', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'OLEO|ÓLEO'
  AND descricao !~* 'KIT|MEDIDOR';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'frango', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'CHICKEN|FRANGO'
  AND descricao !~* 'LAMINA|SACO |CARTON|MARMITA|ESTROGONOFF|BRINDE';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'refil', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'COPO'
  AND descricao ~* 'REFRIG|550'
  AND descricao !~* 'SHAKE|SUNDAE|CORTESIA|MIX|MINIONS|PORTA|TAMPA';

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'refil', atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'FREE REFIL|FREE REFILL|XAROPE'
  AND descricao !~* 'BAG';

-- Contagens diárias abertas ganham os itens novos
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
  'Diária: carne, frango, queijo, bacon, pão, batata, óleo, copos/xarope, vegetais, mix baunilha/doce de leite';
COMMENT ON COLUMN insumos.grupo_diario IS
  'Grupo da diária: carne | frango | queijo | bacon | pao | batata | oleo | refil | vegetais | mix_sobremesa';

COMMIT;
