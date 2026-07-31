-- Reparo pós-094 parcial: renomeia id_produto_venda → id_produto
-- e completa renomes de insumos que ficaram pela metade.
BEGIN;

-- 1) Cadastro estoque: FKs ainda em id_produto → id_insumo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_itens' AND column_name = 'id_produto'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_itens' AND column_name = 'id_insumo'
  ) THEN
    ALTER TABLE estoque_itens RENAME COLUMN id_produto TO id_insumo;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_saldos' AND column_name = 'id_produto'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_saldos' AND column_name = 'id_insumo'
  ) THEN
    ALTER TABLE estoque_saldos RENAME COLUMN id_produto TO id_insumo;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_movimentos' AND column_name = 'id_produto'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_movimentos' AND column_name = 'id_insumo'
  ) THEN
    ALTER TABLE estoque_movimentos RENAME COLUMN id_produto TO id_insumo;
  END IF;

  -- break: primeiro o vínculo com insumo (id_produto antigo), depois o de venda
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_break_itens' AND column_name = 'id_produto'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_break_itens' AND column_name = 'id_produto_venda'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_break_itens' AND column_name = 'id_insumo'
  ) THEN
    ALTER TABLE estoque_break_itens RENAME COLUMN id_produto TO id_insumo;
  END IF;
END $$;

-- 2) Produtos de venda: id_produto_venda → id_produto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ficha_tecnica' AND column_name = 'id_produto_venda'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ficha_tecnica' AND column_name = 'id_produto'
  ) THEN
    ALTER TABLE ficha_tecnica RENAME COLUMN id_produto_venda TO id_produto;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_venda_itens' AND column_name = 'id_produto_venda'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_venda_itens' AND column_name = 'id_produto'
  ) THEN
    ALTER TABLE estoque_venda_itens RENAME COLUMN id_produto_venda TO id_produto;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_break_itens' AND column_name = 'id_produto_venda'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_break_itens' AND column_name = 'id_produto'
  ) THEN
    ALTER TABLE estoque_break_itens RENAME COLUMN id_produto_venda TO id_produto;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'id_produto_venda'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'id_produto'
  ) THEN
    ALTER TABLE produtos RENAME COLUMN id_produto_venda TO id_produto;
  END IF;
END $$;

-- Constraints / índices (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ficha_produto_venda') THEN
    ALTER TABLE ficha_tecnica RENAME CONSTRAINT uq_ficha_produto_venda TO uq_ficha_produto;
  END IF;
END $$;

ALTER INDEX IF EXISTS uq_produtos_venda_codigo RENAME TO uq_produtos_codigo;
ALTER INDEX IF EXISTS idx_estoque_itens_produto RENAME TO idx_estoque_itens_insumo;
ALTER INDEX IF EXISTS idx_estoque_mov_produto RENAME TO idx_estoque_mov_insumo;

COMMIT;
