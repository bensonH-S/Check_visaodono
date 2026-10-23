-- Brinde novo (gloss labial, campanha kids) entra na diária no lugar da bebida láctea baunilha.
-- Baunilha continua na completa; só sai da diária.

BEGIN;

ALTER TABLE insumos DROP CONSTRAINT IF EXISTS insumos_grupo_diario_check;
ALTER TABLE insumos
  ADD CONSTRAINT insumos_grupo_diario_check
  CHECK (
    grupo_diario IS NULL
    OR grupo_diario IN (
      'carne', 'frango', 'queijo', 'bacon', 'pao', 'batata', 'oleo', 'refil',
      'vegetais', 'mix_sobremesa', 'brinde'
    )
  );

-- Mesmas lojas que já contam a baunilha 41962 (BK da rede, sem Popeyes).
INSERT INTO insumos (
  id_loja, codigo, descricao, unidade_contagem, unidade_fracionada,
  preco_caixa, und_convertida, und_parcial, custo_fonte,
  ativo, participa_contagem, contagem_diaria, grupo_diario, contagem_critica,
  permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und,
  ordem_contagem, criado_em, atualizado_em
)
SELECT
  b.id_loja, '042888', 'BRINDE BK GLOSS LABIAL SORTIDO CX C/144UN 3 MODELOS CONFORME MIX', 'UND', 'UND',
  1919.32, 144, 1, 'nf',
  TRUE, TRUE, TRUE, 'brinde', FALSE,
  TRUE, FALSE, TRUE,
  b.ordem_contagem, NOW(), NOW()
FROM insumos b
WHERE b.codigo = '41962'
  AND b.ativo = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM insumos x WHERE x.id_loja = b.id_loja AND x.codigo = '042888'
  );

UPDATE insumos
SET contagem_diaria = TRUE, grupo_diario = 'brinde', ativo = TRUE, participa_contagem = TRUE, atualizado_em = NOW()
WHERE codigo = '042888';

UPDATE insumos
SET contagem_diaria = FALSE, grupo_diario = NULL, atualizado_em = NOW()
WHERE ativo = TRUE
  AND codigo IN ('41962', '28459')
  AND descricao ~* 'BAUNILHA';

-- Nota ainda não conferida passa a lançar o brinde no estoque.
UPDATE estoque_nfe_itens i
SET id_insumo = p.id_insumo, match_tipo = COALESCE(i.match_tipo, 'codigo')
FROM estoque_nfe n, insumos p
WHERE n.id_nfe = i.id_nfe
  AND p.id_loja = n.id_loja
  AND p.codigo = '042888'
  AND i.codigo_nf = '042888'
  AND i.id_insumo IS NULL
  AND COALESCE(n.entrada_registrada, FALSE) = FALSE;

-- Diárias abertas: entra o brinde, sai a baunilha que ninguém contou ainda.
INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
FROM estoque_contagens c
JOIN insumos p ON p.id_loja = c.id_loja AND p.ativo = TRUE AND p.codigo = '042888'
LEFT JOIN estoque_saldos s ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
WHERE c.status = 'aberta'
  AND COALESCE(c.tipo, '') = 'diaria'
  AND NOT EXISTS (
    SELECT 1 FROM estoque_itens x WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
  );

DELETE FROM estoque_itens e
USING estoque_contagens c, insumos p
WHERE e.id_contagem = c.id_contagem
  AND p.id_insumo = e.id_insumo
  AND c.status = 'aberta'
  AND COALESCE(c.tipo, '') = 'diaria'
  AND p.codigo IN ('41962', '28459')
  AND p.descricao ~* 'BAUNILHA'
  AND e.estoque_contado IS NULL;

COMMENT ON COLUMN insumos.grupo_diario IS
  'Grupo da diária: carne | frango | queijo | bacon | pao | batata | oleo | refil | vegetais | mix_sobremesa | brinde';

COMMIT;
