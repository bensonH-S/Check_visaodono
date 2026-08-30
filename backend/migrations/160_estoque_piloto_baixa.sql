-- Piloto de baixa automática: conversões validadas + whitelist da diária.
-- Não altera histórico de movimentos nem qtde_estoque das fichas.

BEGIN;

ALTER TABLE lojas_estoque_perfil
  ADD COLUMN IF NOT EXISTS piloto_baixa BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN lojas_estoque_perfil.piloto_baixa IS
  'TRUE = venda só baixa insumos da contagem diária, e só com conversão validada.';

CREATE TABLE IF NOT EXISTS estoque_conversoes (
  id_conversao SERIAL PRIMARY KEY,
  id_insumo INTEGER NOT NULL REFERENCES insumos(id_insumo) ON DELETE CASCADE,
  unidade_origem TEXT NOT NULL,
  unidade_destino TEXT NOT NULL,
  fator NUMERIC(14, 8) NOT NULL CHECK (fator > 0),
  origem_dado TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'validado', 'bloqueado')),
  validado_em TIMESTAMPTZ,
  validado_por INTEGER,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_estoque_conversoes_insumo_unidades
    UNIQUE (id_insumo, unidade_origem, unidade_destino)
);

COMMENT ON TABLE estoque_conversoes IS
  'Fator: 1 unidade_origem = fator unidade_destino. Só status=validado entra na baixa.';

CREATE INDEX IF NOT EXISTS idx_estoque_conversoes_insumo
  ON estoque_conversoes (id_insumo)
  WHERE status = 'validado';

CREATE TABLE IF NOT EXISTS estoque_insumo_aliases (
  id_alias SERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  codigo_ficha TEXT NOT NULL,
  id_insumo INTEGER NOT NULL REFERENCES insumos(id_insumo) ON DELETE CASCADE,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_estoque_insumo_aliases_loja_codigo
    UNIQUE (id_loja, codigo_ficha)
);

COMMENT ON TABLE estoque_insumo_aliases IS
  'codigo na ficha → id_insumo canônico da loja. Sem heurística de zero à esquerda.';

CREATE TABLE IF NOT EXISTS estoque_baixa_pendencias (
  id_pendencia BIGSERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  id_venda INTEGER,
  codigo_venda TEXT,
  codigo_insumo TEXT,
  id_insumo INTEGER,
  quantidade_receita NUMERIC(14, 6),
  unidade_receita TEXT,
  unidade_estoque TEXT,
  motivo TEXT NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoque_baixa_pendencias_loja_em
  ON estoque_baixa_pendencias (id_loja, criado_em DESC);

COMMENT ON TABLE estoque_baixa_pendencias IS
  'Baixa de venda bloqueada (fora do piloto ou conversão não validada). Sem movimento.';

-- Liga o piloto na 706/7 Norte (BKN 23531)
INSERT INTO lojas_estoque_perfil (id_loja, piloto_baixa)
SELECT l.id_loja, TRUE
FROM lojas l
WHERE TRIM(l.bk_number::text) = '23531'
ON CONFLICT (id_loja) DO UPDATE SET piloto_baixa = TRUE, atualizado_em = NOW();

-- Cheddar 35619: 2,208 kg / 192 fatias = 0,0115 kg
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

-- Carne Whopper 021403: 17,2 kg / 152 und ≈ 0,113158 kg
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, u.origem, 'kg', ROUND((17.2 / 152)::numeric, 8),
       'caixa 17,2kg / 152 und', 'validado', NOW()
FROM insumos i
CROSS JOIN (VALUES ('und')) AS u(origem)
WHERE UPPER(TRIM(i.codigo)) = '021403' AND i.ativo = TRUE
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

-- Carne HB 35622: 18,7 kg / 330 und ≈ 0,056667 kg
INSERT INTO estoque_conversoes (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
SELECT i.id_insumo, u.origem, 'kg', ROUND((18.7 / 330)::numeric, 8),
       'caixa 18,7kg / 330 und', 'validado', NOW()
FROM insumos i
CROSS JOIN (VALUES ('und')) AS u(origem)
WHERE UPPER(TRIM(i.codigo)) = '35622' AND i.ativo = TRUE
ON CONFLICT (id_insumo, unidade_origem, unidade_destino) DO UPDATE
  SET fator = EXCLUDED.fator,
      origem_dado = EXCLUDED.origem_dado,
      status = 'validado',
      validado_em = NOW();

-- Alias explícito: ficha 21403 → insumo diário 021403 (mesmo produto, código sem zero)
INSERT INTO estoque_insumo_aliases (id_loja, codigo_ficha, id_insumo, observacao)
SELECT i.id_loja, '21403', i.id_insumo, 'código legado sem zero à esquerda; canônico 021403'
FROM insumos i
WHERE UPPER(TRIM(i.codigo)) = '021403'
  AND i.ativo = TRUE
  AND i.contagem_diaria = TRUE
ON CONFLICT (id_loja, codigo_ficha) DO UPDATE
  SET id_insumo = EXCLUDED.id_insumo,
      observacao = EXCLUDED.observacao;

COMMIT;
