-- Contagem mobile manda o 3º campo como UND. Bags/óleo têm saldo em L.
-- Sem fator validado, finalizar explode: "Conversão de contagem não encontrada (und → l)".
-- 1 UND (bag/galão) = und_convertida litros (Coca clássica 18, Zero/mix 10, chá 18, óleo 18).

BEGIN;

INSERT INTO estoque_conversoes (
  id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em
)
SELECT i.id_insumo,
       'und',
       'l',
       ROUND(i.und_convertida::numeric, 8),
       'contagem: 1 UND (bag/galão) = und_convertida L',
       'validado',
       NOW()
FROM insumos i
WHERE i.ativo = TRUE
  AND UPPER(TRIM(i.unidade_contagem)) IN ('L', 'LT', 'LITRO', 'LITROS')
  AND COALESCE(i.und_convertida, 0) > 0
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO NOTHING;

COMMIT;
