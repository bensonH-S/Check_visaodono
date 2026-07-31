-- Produtos de venda (BK) passam a ser por loja.
-- Cada loja tem sua própria lista e composição (ficha).

BEGIN;

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS id_loja INTEGER REFERENCES lojas(id_loja) ON DELETE CASCADE;

ALTER TABLE produtos DROP CONSTRAINT IF EXISTS uq_produtos_codigo;
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS uq_produtos_venda_codigo;

DO $$
DECLARE
  r RECORD;
  l RECORD;
  new_id INTEGER;
  old_ficha INTEGER;
  new_ficha INTEGER;
  first_loja INTEGER;
  tem_loja BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE id_loja IS NULL) THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT id_produto, codigo, descricao, ativo, criado_em
    FROM produtos
    WHERE id_loja IS NULL
    ORDER BY id_produto
  LOOP
    SELECT f.id_ficha
      INTO old_ficha
    FROM ficha_tecnica f
    WHERE f.id_produto = r.id_produto AND f.ativo = TRUE
    ORDER BY f.id_ficha DESC
    LIMIT 1;

    first_loja := NULL;

    FOR l IN
      WITH alvo AS (
        SELECT DISTINCT v.id_loja
        FROM estoque_venda_itens i
        JOIN estoque_vendas v ON v.id_venda = i.id_venda
        WHERE i.id_produto = r.id_produto OR i.codigo = r.codigo
        UNION
        SELECT DISTINCT b.id_loja
        FROM estoque_break_itens bi
        JOIN estoque_break b ON b.id_break = bi.id_break
        WHERE bi.id_produto = r.id_produto OR bi.codigo = r.codigo
      )
      SELECT id_loja FROM (
        SELECT a.id_loja FROM alvo a
        UNION ALL
        SELECT COALESCE(
          (SELECT i.id_loja FROM insumos i ORDER BY i.id_loja LIMIT 1),
          (SELECT lj.id_loja FROM lojas lj WHERE COALESCE(lj.is_active, TRUE) ORDER BY lj.id_loja LIMIT 1)
        ) AS id_loja
        WHERE NOT EXISTS (SELECT 1 FROM alvo)
          AND COALESCE(
            (SELECT i.id_loja FROM insumos i ORDER BY i.id_loja LIMIT 1),
            (SELECT lj.id_loja FROM lojas lj WHERE COALESCE(lj.is_active, TRUE) ORDER BY lj.id_loja LIMIT 1)
          ) IS NOT NULL
      ) x
      WHERE id_loja IS NOT NULL
      ORDER BY id_loja
    LOOP
      IF first_loja IS NULL THEN
        UPDATE produtos
        SET id_loja = l.id_loja, atualizado_em = NOW()
        WHERE id_produto = r.id_produto;
        first_loja := l.id_loja;
        new_id := r.id_produto;
      ELSE
        INSERT INTO produtos (codigo, descricao, ativo, criado_em, atualizado_em, id_loja)
        VALUES (r.codigo, r.descricao, r.ativo, r.criado_em, NOW(), l.id_loja)
        RETURNING id_produto INTO new_id;

        IF old_ficha IS NOT NULL THEN
          INSERT INTO ficha_tecnica (id_produto, ativo, observacao, criado_em, atualizado_em)
          SELECT new_id, f.ativo, f.observacao, f.criado_em, NOW()
          FROM ficha_tecnica f
          WHERE f.id_ficha = old_ficha
          RETURNING id_ficha INTO new_ficha;

          INSERT INTO ficha_tecnica_itens (id_ficha, codigo_insumo, quantidade, observacao)
          SELECT new_ficha, fi.codigo_insumo, fi.quantidade, fi.observacao
          FROM ficha_tecnica_itens fi
          WHERE fi.id_ficha = old_ficha;
        END IF;
      END IF;

      UPDATE estoque_venda_itens i
      SET id_produto = new_id
      FROM estoque_vendas v
      WHERE i.id_venda = v.id_venda
        AND v.id_loja = l.id_loja
        AND (i.id_produto = r.id_produto OR i.codigo = r.codigo);

      UPDATE estoque_break_itens bi
      SET id_produto = new_id
      FROM estoque_break b
      WHERE bi.id_break = b.id_break
        AND b.id_loja = l.id_loja
        AND (bi.id_produto = r.id_produto OR bi.codigo = r.codigo);
    END LOOP;

    IF first_loja IS NULL THEN
      SELECT lj.id_loja INTO first_loja FROM lojas lj ORDER BY lj.id_loja LIMIT 1;
      IF first_loja IS NOT NULL THEN
        UPDATE produtos
        SET id_loja = first_loja, atualizado_em = NOW()
        WHERE id_produto = r.id_produto;
      END IF;
    END IF;
  END LOOP;

  -- Remove órfãos sem loja (sem lojas no sistema)
  DELETE FROM produtos WHERE id_loja IS NULL;
END $$;

ALTER TABLE produtos
  ALTER COLUMN id_loja SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_produtos_loja_codigo'
  ) THEN
    ALTER TABLE produtos
      ADD CONSTRAINT uq_produtos_loja_codigo UNIQUE (id_loja, codigo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_produtos_loja ON produtos (id_loja);

COMMIT;
