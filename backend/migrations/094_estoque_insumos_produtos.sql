-- Renomeia domínio físico:
--   produtos (estoque/cadastro) → insumos
--   produtos_venda (BK / sanduíches) → produtos
BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Cadastro de estoque: produtos → insumos
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.produtos') IS NOT NULL
     AND to_regclass('public.insumos') IS NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'id_loja'
     ) THEN
    ALTER TABLE produtos RENAME TO insumos;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.insumos') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'insumos' AND column_name = 'id_produto'
     ) THEN
    ALTER TABLE insumos RENAME COLUMN id_produto TO id_insumo;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'produtos_id_produto_seq') THEN
    ALTER SEQUENCE produtos_id_produto_seq RENAME TO insumos_id_insumo_seq;
  END IF;
END $$;

-- FKs / colunas que apontavam para o cadastro de estoque
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_itens' AND column_name = 'id_produto'
  ) THEN
    ALTER TABLE estoque_itens RENAME COLUMN id_produto TO id_insumo;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_saldos' AND column_name = 'id_produto'
  ) THEN
    ALTER TABLE estoque_saldos RENAME COLUMN id_produto TO id_insumo;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_movimentos' AND column_name = 'id_produto'
  ) THEN
    ALTER TABLE estoque_movimentos RENAME COLUMN id_produto TO id_insumo;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_break_itens' AND column_name = 'id_produto'
  ) THEN
    ALTER TABLE estoque_break_itens RENAME COLUMN id_produto TO id_insumo;
  END IF;
END $$;

ALTER INDEX IF EXISTS idx_produtos_descricao RENAME TO idx_insumos_descricao;
ALTER INDEX IF EXISTS idx_produtos_ativo RENAME TO idx_insumos_ativo;
ALTER INDEX IF EXISTS idx_produtos_loja RENAME TO idx_insumos_loja;
ALTER INDEX IF EXISTS uq_produtos_loja_codigo RENAME TO uq_insumos_loja_codigo;
ALTER INDEX IF EXISTS idx_estoque_itens_produto RENAME TO idx_estoque_itens_insumo;
ALTER INDEX IF EXISTS idx_estoque_mov_produto RENAME TO idx_estoque_mov_insumo;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) Produtos de venda: produtos_venda → produtos
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('public.produtos_venda') IS NOT NULL
     AND to_regclass('public.produtos') IS NULL THEN
    ALTER TABLE produtos_venda RENAME TO produtos;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.produtos') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'id_produto_venda'
     ) THEN
    ALTER TABLE produtos RENAME COLUMN id_produto_venda TO id_produto;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'produtos_venda_id_produto_venda_seq') THEN
    ALTER SEQUENCE produtos_venda_id_produto_venda_seq RENAME TO produtos_id_produto_seq;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ficha_tecnica' AND column_name = 'id_produto_venda'
  ) THEN
    ALTER TABLE ficha_tecnica RENAME COLUMN id_produto_venda TO id_produto;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_venda_itens' AND column_name = 'id_produto_venda'
  ) THEN
    ALTER TABLE estoque_venda_itens RENAME COLUMN id_produto_venda TO id_produto;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_break_itens' AND column_name = 'id_produto_venda'
  ) THEN
    ALTER TABLE estoque_break_itens RENAME COLUMN id_produto_venda TO id_produto;
  END IF;
END $$;

ALTER INDEX IF EXISTS uq_produtos_venda_codigo RENAME TO uq_produtos_codigo;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_ficha_produto_venda'
  ) THEN
    ALTER TABLE ficha_tecnica RENAME CONSTRAINT uq_ficha_produto_venda TO uq_ficha_produto;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_produtos_venda_codigo'
  ) THEN
    ALTER TABLE produtos RENAME CONSTRAINT uq_produtos_venda_codigo TO uq_produtos_codigo;
  END IF;
END $$;

-- Permissão: nome já ajustado no app; garante texto alinhado
UPDATE permissoes
SET nome = 'Insumos — cadastrar e editar',
    grupo = 'Estoque',
    ordem = 200
WHERE codigo = 'estoque.produtos';

COMMIT;
