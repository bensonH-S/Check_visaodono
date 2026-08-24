-- Ajustes do piloto BK: unidades liberadas, duplicatas, vegetais/queijo na diária,
-- copo 550 drive e permissão de contagem/break para toda a liderança da loja.

BEGIN;

-- 1) Grupo vegetais na diária
ALTER TABLE insumos DROP CONSTRAINT IF EXISTS insumos_grupo_diario_check;
ALTER TABLE insumos
  ADD CONSTRAINT insumos_grupo_diario_check
  CHECK (
    grupo_diario IS NULL
    OR grupo_diario IN (
      'carne', 'frango', 'queijo', 'bacon', 'pao', 'batata', 'oleo', 'refil', 'vegetais'
    )
  );

-- Helper: só Burger King
CREATE TEMP TABLE tmp_bk_lojas AS
SELECT id_loja FROM lojas
WHERE COALESCE(is_active, TRUE)
  AND name ILIKE '%burger king%';

-- 2) Liberar campos que a loja pediu (bloco preto = campo bloqueado)
-- Carne / pão: unidades (KG/UND)
UPDATE insumos SET permite_contagem_kg_und = TRUE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND ativo = TRUE
  AND (
    descricao ~* 'CARNE'
    OR descricao ~* 'P[AÃ]O'
    OR descricao ~* 'BACON'
    OR descricao ~* 'BATATA'
  )
  AND descricao !~* 'CARTON|FUNDO|TAMPA|SAQUINHO|CESTO|BRINDE|MARMITA|MAIONESE|BACONESE|MOLHO';

-- BK Chicken, óleo Cukin, copos, tampa shake, filtro: pacote (PC/FD)
UPDATE insumos SET permite_contagem_pc_fd = TRUE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND ativo = TRUE
  AND (
    descricao ~* 'BK CHICKEN'
    OR descricao ~* 'OLEO ESPECIAL CUKIN'
    OR descricao ~* 'COPO'
    OR descricao ~* 'TAMPA SHAKE'
    OR descricao ~* 'FILTRO P/ FRITADEIRA|FILTRO.*FRITADEIRA'
  )
  AND descricao !~* 'CARTON|SACO |PORTA COPO|CORTESIA';

-- Filtro da fritadeira: unidade
UPDATE insumos SET permite_contagem_kg_und = TRUE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND descricao ~* 'FILTRO'
  AND descricao ~* 'FRITADEIRA';

-- Tampa shake: pacote e unidade
UPDATE insumos
SET permite_contagem_pc_fd = TRUE,
    permite_contagem_kg_und = TRUE,
    atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND descricao ~* 'TAMPA SHAKE';

-- 3) Fator de pacote (evita preço do pct = preço da unidade)
UPDATE insumos
SET und_parcial = 100, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND ativo = TRUE
  AND descricao ~* 'COPO'
  AND descricao ~* '440|550|REFRIG|SUNDAE'
  AND descricao !~* 'PORTA|TAMPA|CORTESIA|MIX|MINIONS'
  AND COALESCE(und_parcial, 1) <= 1;

UPDATE insumos
SET und_parcial = 49, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND descricao ~* 'BK CHICKEN'
  AND descricao ~* '588'
  AND COALESCE(und_parcial, 1) <= 1;

-- Óleo 18 kg: fator da caixa era 2500 (VL.UNIT ~0,09). Correto = 18 kg.
UPDATE insumos
SET und_convertida = 18,
    unidade_contagem = 'KG',
    atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND descricao ~* 'OLEO ESPECIAL CUKIN'
  AND descricao ~* '18'
  AND COALESCE(und_convertida, 0) > 100;

-- Pão brioche 192: o código 38585 fica; herda o fator de pacote (20) do 038585
UPDATE insumos i
SET und_parcial = src.und_parcial,
    permite_contagem_pc_fd = TRUE,
    permite_contagem_kg_und = TRUE,
    atualizado_em = NOW()
FROM insumos src
WHERE i.id_loja = src.id_loja
  AND i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND i.codigo = '38585'
  AND src.codigo = '038585'
  AND COALESCE(src.und_parcial, 1) > 1;
-- Carne Whopper: fica 21403 (152 UN). 021403 era o mesmo item em kg (VL.UNIT 28,86).
UPDATE insumos
SET ativo = FALSE, contagem_diaria = FALSE, contagem_critica = FALSE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo IN (
    '021403',
    'TRC-PAOBRIOCHEBKCX270U',
    'BK-SEM-0004',
    '038585',
    '14321'
  );

-- Tomate duplicado: fica o 7 kg BK; tira o genérico 19909
UPDATE insumos
SET ativo = FALSE, contagem_diaria = FALSE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = '19909'
  AND descricao ~* '^TOMATE CARMEM$';

-- Tampa shake duplicada (1000 UN vs 900)
UPDATE insumos
SET ativo = FALSE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = '34600'
  AND descricao ~* 'TAMPA SHAKE 440/550';

-- 5) Queijo cheddar + vegetais + copo 550 drive na diária
UPDATE insumos
SET ativo = TRUE,
    contagem_diaria = TRUE,
    grupo_diario = 'queijo',
    atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = '35619';

UPDATE insumos
SET ativo = TRUE,
    contagem_diaria = TRUE,
    grupo_diario = 'vegetais',
    atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND (
    descricao ~* 'ALFACE AMERICANA'
    OR (descricao ~* 'TOMATE CARMEM' AND codigo <> '19909')
    OR descricao ~* '^CEBOLA BRANCA$'
  )
  AND descricao !~* 'FRITA|CRISPY';

UPDATE insumos
SET ativo = TRUE,
    contagem_diaria = TRUE,
    grupo_diario = 'refil',
    und_parcial = CASE WHEN COALESCE(und_parcial, 1) <= 1 THEN 50 ELSE und_parcial END,
    atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = '042242';

-- 6) Tira itens desativados de contagens ainda abertas
DELETE FROM estoque_itens ei
USING estoque_contagens c, insumos i
WHERE ei.id_contagem = c.id_contagem
  AND ei.id_insumo = i.id_insumo
  AND c.status = 'aberta'
  AND i.ativo = FALSE
  AND i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas);

-- 7) Toda liderança da loja lança contagem (completa/incompleta) e break
INSERT INTO usuario_permissoes (id_usuario, codigo)
SELECT DISTINCT u.id_usuario, p.codigo
FROM usuarios u
JOIN usuario_lojas ul ON ul.id_usuario = u.id_usuario
JOIN lojas l ON l.id_loja = ul.id_loja
CROSS JOIN (VALUES
  ('estoque.conferencia'),
  ('estoque.break')
) AS p(codigo)
WHERE u.ativo = TRUE
  AND LOWER(COALESCE(u.cargo_aprovacao, u.perfil::text)) IN (
    'gerente', 'coordenador', 'subgerente', 'sub_gerente', 'assistente_gerente'
  )
  AND l.id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
ON CONFLICT (id_usuario, codigo) DO NOTHING;

COMMIT;
