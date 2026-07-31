-- Reordena id_loja em insumos para ficar após descricao.

BEGIN;

ALTER SEQUENCE IF EXISTS insumos_id_insumo_seq OWNED BY NONE;

CREATE TABLE insumos_ord (
  id_insumo INTEGER NOT NULL DEFAULT nextval('insumos_id_insumo_seq'),
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja),
  unidade_contagem TEXT NOT NULL DEFAULT 'und',
  preco_caixa NUMERIC(14, 4) NOT NULL DEFAULT 0,
  und_convertida NUMERIC(14, 4) NOT NULL DEFAULT 1,
  valor_unidade NUMERIC(14, 6) GENERATED ALWAYS AS (
    CASE WHEN und_convertida > 0 THEN ROUND(preco_caixa / und_convertida, 6) ELSE 0 END
  ) STORED,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insumos_ord_pkey PRIMARY KEY (id_insumo)
);

INSERT INTO insumos_ord (
  id_insumo, codigo, descricao, id_loja, unidade_contagem,
  preco_caixa, und_convertida, ativo, criado_em, atualizado_em
)
SELECT
  id_insumo, codigo, descricao, id_loja, unidade_contagem,
  preco_caixa, und_convertida, ativo, criado_em, atualizado_em
FROM insumos;

-- FKs que apontam para insumos
ALTER TABLE estoque_itens DROP CONSTRAINT IF EXISTS estoque_itens_id_produto_fkey;
ALTER TABLE estoque_itens DROP CONSTRAINT IF EXISTS estoque_itens_id_insumo_fkey;
ALTER TABLE estoque_movimentos DROP CONSTRAINT IF EXISTS estoque_movimentos_id_produto_fkey;
ALTER TABLE estoque_movimentos DROP CONSTRAINT IF EXISTS estoque_movimentos_id_insumo_fkey;
ALTER TABLE estoque_saldos DROP CONSTRAINT IF EXISTS estoque_saldos_id_produto_fkey;
ALTER TABLE estoque_saldos DROP CONSTRAINT IF EXISTS estoque_saldos_id_insumo_fkey;
ALTER TABLE estoque_break_itens DROP CONSTRAINT IF EXISTS estoque_break_itens_id_insumo_fkey;
ALTER TABLE estoque_break_itens DROP CONSTRAINT IF EXISTS estoque_break_itens_id_produto_fkey;

-- Uniques / indexes antigos somem com o DROP
DROP TABLE insumos;
ALTER TABLE insumos_ord RENAME TO insumos;
ALTER TABLE insumos RENAME CONSTRAINT insumos_ord_pkey TO produtos_pkey;

ALTER SEQUENCE insumos_id_insumo_seq OWNED BY insumos.id_insumo;
SELECT setval(
  'insumos_id_insumo_seq',
  COALESCE((SELECT MAX(id_insumo) FROM insumos), 1),
  true
);

-- Recria unique/indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_insumos_loja_codigo'
  ) THEN
    ALTER TABLE insumos ADD CONSTRAINT uq_insumos_loja_codigo UNIQUE (id_loja, codigo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_insumos_descricao ON insumos (descricao);
CREATE INDEX IF NOT EXISTS idx_insumos_ativo ON insumos (ativo);
CREATE INDEX IF NOT EXISTS idx_insumos_loja ON insumos (id_loja);

ALTER TABLE estoque_itens
  ADD CONSTRAINT estoque_itens_id_insumo_fkey
  FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo);

ALTER TABLE estoque_movimentos
  ADD CONSTRAINT estoque_movimentos_id_insumo_fkey
  FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo) ON DELETE CASCADE;

ALTER TABLE estoque_saldos
  ADD CONSTRAINT estoque_saldos_id_insumo_fkey
  FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_break_itens' AND column_name = 'id_insumo'
  ) THEN
    ALTER TABLE estoque_break_itens
      ADD CONSTRAINT estoque_break_itens_id_insumo_fkey
      FOREIGN KEY (id_insumo) REFERENCES insumos(id_insumo) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
