-- Contagem travava: "Conversão não encontrada: 010947 (und → kg)".
-- Sal 010947 (fardo 10 kg) estava com 3º campo em UND sem fator, misturado
-- com o sachê 10947 pelo zero à esquerda. Pazinha/carton/lápis são peça.

BEGIN;

-- Sal: 3º campo em KG (resto do fardo aberto). CAIXA continua × 10.
UPDATE insumos dest
SET unidade_fracionada = 'KG',
    atualizado_em = NOW()
FROM lojas l
WHERE dest.id_loja = l.id_loja
  AND dest.ativo = TRUE
  AND TRIM(COALESCE(l.bk_number, '')) <> '15022'
  AND UPPER(BTRIM(dest.codigo)) = '010947'
  AND UPPER(TRIM(dest.unidade_contagem)) = 'KG';

UPDATE estoque_itens ei
SET contagem_unidade_entrada = 'KG'
FROM insumos p, estoque_contagens c, lojas l
WHERE ei.id_insumo = p.id_insumo
  AND c.id_contagem = ei.id_contagem
  AND c.id_loja = l.id_loja
  AND TRIM(COALESCE(l.bk_number, '')) <> '15022'
  AND c.status = 'aberta'
  AND UPPER(BTRIM(p.codigo)) = '010947'
  AND UPPER(TRIM(COALESCE(ei.contagem_unidade_entrada, ''))) = 'UND';

INSERT INTO estoque_conversoes (
  id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em
)
SELECT i.id_insumo, u.origem, u.destino, u.fator,
       'SAL BK FD 10KG: 1 fardo = 10 kg',
       'validado', NOW()
FROM insumos i
CROSS JOIN (VALUES
  ('und', 'kg', 10::numeric),
  ('kg', 'und', 0.1::numeric)
) AS u(origem, destino, fator)
WHERE i.ativo = TRUE
  AND UPPER(BTRIM(i.codigo)) = '010947'
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

-- Sachê maionese 10947: conta UND, não KG.
UPDATE insumos dest
SET unidade_fracionada = 'UND',
    atualizado_em = NOW()
FROM lojas l
WHERE dest.id_loja = l.id_loja
  AND dest.ativo = TRUE
  AND TRIM(COALESCE(l.bk_number, '')) <> '15022'
  AND UPPER(BTRIM(dest.codigo)) = '10947'
  AND UPPER(TRIM(dest.unidade_contagem)) IN ('UND', 'UN', 'UNID');

UPDATE estoque_itens ei
SET contagem_unidade_entrada = 'UND'
FROM insumos p, estoque_contagens c, lojas l
WHERE ei.id_insumo = p.id_insumo
  AND c.id_contagem = ei.id_contagem
  AND c.id_loja = l.id_loja
  AND TRIM(COALESCE(l.bk_number, '')) <> '15022'
  AND c.status = 'aberta'
  AND UPPER(BTRIM(p.codigo)) = '10947'
  AND UPPER(TRIM(COALESCE(ei.contagem_unidade_entrada, ''))) = 'KG';

-- Peça cadastrada como KG: pazinha, carton batata, lápis de cera.
UPDATE insumos dest
SET unidade_contagem = 'UND',
    unidade_fracionada = 'UND',
    atualizado_em = NOW()
FROM lojas l
WHERE dest.id_loja = l.id_loja
  AND dest.ativo = TRUE
  AND TRIM(COALESCE(l.bk_number, '')) <> '15022'
  AND regexp_replace(UPPER(TRIM(dest.codigo)), '^0+', '') IN ('32605', '38742', '9266')
  AND UPPER(TRIM(dest.unidade_contagem)) = 'KG';

UPDATE estoque_itens ei
SET
  contagem_unidade_entrada = 'UND',
  estoque_contado = ROUND((
    COALESCE(ei.contagem_caixa, 0) * COALESCE(NULLIF(p.und_convertida, 0), 1)
    + COALESCE(ei.contagem_pc_fd, 0) * COALESCE(NULLIF(p.und_parcial, 0), 1)
    + COALESCE(ei.contagem_kg_und, 0)
  )::numeric, 4)
FROM insumos p, estoque_contagens c, lojas l
WHERE ei.id_insumo = p.id_insumo
  AND c.id_contagem = ei.id_contagem
  AND c.id_loja = l.id_loja
  AND TRIM(COALESCE(l.bk_number, '')) <> '15022'
  AND c.status = 'aberta'
  AND regexp_replace(UPPER(TRIM(p.codigo)), '^0+', '') IN ('32605', '38742', '9266')
  AND UPPER(TRIM(p.unidade_contagem)) = 'UND'
  AND (
    ei.contagem_caixa IS NOT NULL
    OR ei.contagem_pc_fd IS NOT NULL
    OR ei.contagem_kg_und IS NOT NULL
  );

COMMIT;
