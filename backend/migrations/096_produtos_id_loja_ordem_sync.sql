-- Reordena id_loja para ficar após descricao e sincroniza produtos
-- de cada loja com os códigos realmente vendidos nela (fonte da verdade).

BEGIN;

-- Preserva a sequence ao dropar a tabela
ALTER SEQUENCE IF EXISTS produtos_id_produto_seq OWNED BY NONE;

-- 1) Nova tabela com ordem de colunas desejada
CREATE TABLE produtos_ord (
  id_produto INTEGER NOT NULL DEFAULT nextval('produtos_id_produto_seq'),
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT produtos_ord_pkey PRIMARY KEY (id_produto),
  CONSTRAINT uq_produtos_ord_loja_codigo UNIQUE (id_loja, codigo)
);

INSERT INTO produtos_ord (id_produto, codigo, descricao, id_loja, ativo, criado_em, atualizado_em)
SELECT id_produto, codigo, descricao, id_loja, ativo, criado_em, atualizado_em
FROM produtos;

-- 2) Troca FKs temporariamente para a tabela nova
ALTER TABLE ficha_tecnica DROP CONSTRAINT IF EXISTS ficha_tecnica_id_produto_venda_fkey;
ALTER TABLE ficha_tecnica DROP CONSTRAINT IF EXISTS ficha_tecnica_id_produto_fkey;
ALTER TABLE estoque_venda_itens DROP CONSTRAINT IF EXISTS estoque_venda_itens_id_produto_venda_fkey;
ALTER TABLE estoque_venda_itens DROP CONSTRAINT IF EXISTS estoque_venda_itens_id_produto_fkey;
ALTER TABLE estoque_break_itens DROP CONSTRAINT IF EXISTS estoque_break_itens_id_produto_venda_fkey;
ALTER TABLE estoque_break_itens DROP CONSTRAINT IF EXISTS estoque_break_itens_id_produto_fkey;

DROP TABLE produtos;
ALTER TABLE produtos_ord RENAME TO produtos;
ALTER TABLE produtos RENAME CONSTRAINT produtos_ord_pkey TO produtos_venda_pkey;
ALTER TABLE produtos RENAME CONSTRAINT uq_produtos_ord_loja_codigo TO uq_produtos_loja_codigo;

ALTER SEQUENCE produtos_id_produto_seq OWNED BY produtos.id_produto;
SELECT setval(
  'produtos_id_produto_seq',
  COALESCE((SELECT MAX(id_produto) FROM produtos), 1),
  true
);

ALTER TABLE ficha_tecnica
  ADD CONSTRAINT ficha_tecnica_id_produto_fkey
  FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE CASCADE;

ALTER TABLE estoque_venda_itens
  ADD CONSTRAINT estoque_venda_itens_id_produto_fkey
  FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE SET NULL;

ALTER TABLE estoque_break_itens
  ADD CONSTRAINT estoque_break_itens_id_produto_fkey
  FOREIGN KEY (id_produto) REFERENCES produtos(id_produto) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_produtos_loja ON produtos (id_loja);

-- 3) Sincroniza produtos por loja com códigos vendidos na própria loja
--    (remove órfãos; atualiza descrição; cria faltantes)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Remove produto da loja se nunca apareceu nas vendas dessa loja
  -- (mantém se tiver ficha ativa — cadastro manual)
  DELETE FROM produtos p
  WHERE NOT EXISTS (
      SELECT 1
      FROM estoque_venda_itens i
      JOIN estoque_vendas v ON v.id_venda = i.id_venda
      WHERE v.id_loja = p.id_loja
        AND (i.codigo = p.codigo OR i.id_produto = p.id_produto)
    )
    AND NOT EXISTS (
      SELECT 1 FROM ficha_tecnica f
      WHERE f.id_produto = p.id_produto AND f.ativo = TRUE
    );

  -- Atualiza descrição pelo último item de venda da loja
  UPDATE produtos p
  SET descricao = x.descricao,
      atualizado_em = NOW()
  FROM (
    SELECT DISTINCT ON (v.id_loja, i.codigo)
      v.id_loja,
      i.codigo,
      COALESCE(NULLIF(TRIM(i.descricao), ''), i.codigo) AS descricao
    FROM estoque_venda_itens i
    JOIN estoque_vendas v ON v.id_venda = i.id_venda
    ORDER BY v.id_loja, i.codigo, i.id_item DESC
  ) x
  WHERE p.id_loja = x.id_loja
    AND p.codigo = x.codigo
    AND (p.descricao IS DISTINCT FROM x.descricao);

  -- Garante produto para cada código vendido na loja
  FOR r IN
    SELECT DISTINCT ON (v.id_loja, i.codigo)
      v.id_loja,
      i.codigo,
      COALESCE(NULLIF(TRIM(i.descricao), ''), i.codigo) AS descricao
    FROM estoque_venda_itens i
    JOIN estoque_vendas v ON v.id_venda = i.id_venda
    ORDER BY v.id_loja, i.codigo, i.id_item DESC
  LOOP
    INSERT INTO produtos (id_loja, codigo, descricao, ativo, atualizado_em)
    VALUES (r.id_loja, r.codigo, r.descricao, TRUE, NOW())
    ON CONFLICT (id_loja, codigo) DO UPDATE
      SET descricao = CASE
            WHEN EXCLUDED.descricao <> '' AND EXCLUDED.descricao <> EXCLUDED.codigo
            THEN EXCLUDED.descricao
            ELSE produtos.descricao
          END,
          atualizado_em = NOW();
  END LOOP;

  -- Religa id_produto nos itens de venda da mesma loja/código
  UPDATE estoque_venda_itens i
  SET id_produto = p.id_produto
  FROM estoque_vendas v, produtos p
  WHERE i.id_venda = v.id_venda
    AND p.id_loja = v.id_loja
    AND p.codigo = i.codigo
    AND (i.id_produto IS DISTINCT FROM p.id_produto);
END $$;

COMMIT;
