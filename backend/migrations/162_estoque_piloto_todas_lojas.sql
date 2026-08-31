-- Expande a baixa convertida (antes só 23531) para todas as lojas com BKN.
-- Venda só baixa item de contagem diária, e só com fator validado / identidade / SI.
-- Não reprocessa histórico.

BEGIN;

ALTER TABLE lojas_estoque_perfil
  ADD COLUMN IF NOT EXISTS piloto_baixa BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE lojas_estoque_perfil
  ALTER COLUMN piloto_baixa SET DEFAULT TRUE;

COMMENT ON COLUMN lojas_estoque_perfil.piloto_baixa IS
  'TRUE = venda só baixa insumos da contagem diária, e só com conversão validada. Ligado em toda a rede.';

INSERT INTO lojas_estoque_perfil (id_loja, piloto_baixa)
SELECT l.id_loja, TRUE
FROM lojas l
WHERE l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
ON CONFLICT (id_loja) DO UPDATE
  SET piloto_baixa = TRUE, atualizado_em = NOW();

-- Cheddar 35619: 2,208 kg / 192 fatias = 0,0115 kg (todas as lojas)
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, u.origem, 'kg', 0.0115,
       'embalagem 8x2,208kg / 192 fatias', 'validado', NOW()
FROM insumos i
CROSS JOIN (VALUES ('und'), ('fatia')) AS u(origem)
WHERE UPPER(TRIM(i.codigo)) = '35619' AND i.ativo = TRUE
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

-- Carne Whopper 021403: 17,2 kg / 152 und
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, 'und', 'kg', ROUND((17.2 / 152)::numeric, 8),
       'caixa 17,2kg / 152 und', 'validado', NOW()
FROM insumos i
WHERE UPPER(TRIM(i.codigo)) = '021403' AND i.ativo = TRUE
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

-- Carne HB 35622: 18,7 kg / 330 und
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, 'und', 'kg', ROUND((18.7 / 330)::numeric, 8),
       'caixa 18,7kg / 330 und', 'validado', NOW()
FROM insumos i
WHERE UPPER(TRIM(i.codigo)) = '35622' AND i.ativo = TRUE
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

INSERT INTO estoque_insumo_aliases (id_loja, codigo_ficha, id_insumo, observacao)
SELECT i.id_loja, '21403', i.id_insumo, 'código legado; canônico 021403'
FROM insumos i
WHERE UPPER(TRIM(i.codigo)) = '021403' AND i.ativo = TRUE AND i.contagem_diaria = TRUE
ON CONFLICT (id_loja, codigo_ficha) DO UPDATE
  SET id_insumo = EXCLUDED.id_insumo,
      observacao = EXCLUDED.observacao;

COMMIT;
