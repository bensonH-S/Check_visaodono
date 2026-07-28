BEGIN;

-- Produtos passam a pertencer a uma loja (catálogo e estoque isolados)
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS id_loja INT REFERENCES lojas(id_loja);

-- Seed da planilha PLK 15022 → loja POPYES Valparaíso
UPDATE produtos p
SET id_loja = l.id_loja
FROM lojas l
WHERE p.id_loja IS NULL
  AND l.bk_number = '15022';

-- Se ainda houver órfãos, vincula à primeira loja ativa (evita NOT NULL falhar)
UPDATE produtos
SET id_loja = (
  SELECT id_loja FROM lojas WHERE COALESCE(is_active, TRUE) ORDER BY id_loja LIMIT 1
)
WHERE id_loja IS NULL;

ALTER TABLE produtos
  ALTER COLUMN id_loja SET NOT NULL;

-- Código único por loja (não global)
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_codigo_key;
DROP INDEX IF EXISTS produtos_codigo_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_loja_codigo
  ON produtos (id_loja, codigo);

CREATE INDEX IF NOT EXISTS idx_produtos_loja ON produtos (id_loja);

-- Contagens da planilha / sem loja → 15022
UPDATE estoque_contagens c
SET id_loja = l.id_loja
FROM lojas l
WHERE c.id_loja IS NULL
  AND l.bk_number = '15022'
  AND (
    c.titulo ILIKE '%15022%'
    OR c.titulo ILIKE '%PLK%'
    OR c.observacao ILIKE '%15022%'
  );

UPDATE estoque_contagens c
SET id_loja = (
  SELECT id_loja FROM lojas WHERE bk_number = '15022' LIMIT 1
)
WHERE c.id_loja IS NULL;

CREATE INDEX IF NOT EXISTS idx_estoque_contagens_loja_data
  ON estoque_contagens (id_loja, data_contagem DESC);

COMMIT;
