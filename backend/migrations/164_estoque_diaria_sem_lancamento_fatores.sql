-- Tira lançamentos eSupri da diária.
-- Fatores UN→KG: kg da caixa na NF × quantidade de peças anotada na ficha.

BEGIN;

UPDATE insumos
SET contagem_diaria = FALSE, grupo_diario = NULL, atualizado_em = NOW()
WHERE ativo = TRUE
  AND UPPER(TRIM(codigo)) IN ('41962', '42284', '42297');

DELETE FROM estoque_itens i
USING estoque_contagens c, insumos p
WHERE i.id_contagem = c.id_contagem
  AND i.id_insumo = p.id_insumo
  AND c.status = 'aberta'
  AND COALESCE(c.tipo, '') = 'diaria'
  AND UPPER(TRIM(p.codigo)) IN ('41962', '42284', '42297');

-- Chicken Jr 031777: NF 1 cx = 9,88 kg; ficha "CX/9,88 KG - 152 UND"
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, 'und', 'kg', ROUND((9.88 / 152)::numeric, 8),
       'NF cx 9,88kg / ficha 152 und', 'validado', NOW()
FROM insumos i
WHERE i.ativo = TRUE
  AND LTRIM(TRIM(i.codigo), '0') = '31777'
  AND i.descricao ~* 'CHICKEN JR'
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

-- Nuggets 34580: NF 1 cx = 12 kg; ficha "CX C/ 588 UN 12 KG"
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, 'und', 'kg', ROUND((12.0 / 588)::numeric, 8),
       'NF cx 12kg / ficha 588 und', 'validado', NOW()
FROM insumos i
WHERE i.ativo = TRUE
  AND LTRIM(TRIM(i.codigo), '0') = '34580'
  AND i.descricao ~* 'NUGGET'
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

-- Bacon tiras 28582: cadastro CX 4 kg; ficha "1187 UND CX/ 4KG"
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, 'und', 'kg', ROUND((4.0 / 1187)::numeric, 8),
       'caixa 4kg / ficha 1187 und', 'validado', NOW()
FROM insumos i
WHERE i.ativo = TRUE
  AND LTRIM(TRIM(i.codigo), '0') = '28582'
  AND i.descricao ~* 'BACON' AND i.descricao ~* 'TIRA'
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

-- Rebel 38178: ficha "CX 122 UND 12KG"
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, 'und', 'kg', ROUND((12.0 / 122)::numeric, 8),
       'caixa 12kg / ficha 122 und', 'validado', NOW()
FROM insumos i
WHERE i.ativo = TRUE
  AND LTRIM(TRIM(i.codigo), '0') = '38178'
  AND i.descricao ~* 'REBEL'
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

COMMIT;
