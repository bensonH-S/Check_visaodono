-- Cópia do que a loja digitou, atualizada a cada salvamento.
-- A contagem oficial pode ficar numa data antiga; esta cópia é o que se puxa no dia em que salvaram.

BEGIN;

CREATE TABLE IF NOT EXISTS estoque_contagem_copia (
  id_copia BIGSERIAL PRIMARY KEY,
  id_contagem INTEGER NOT NULL UNIQUE REFERENCES estoque_contagens(id_contagem) ON DELETE CASCADE,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja),
  tipo TEXT NOT NULL,
  data_contagem DATE,
  status TEXT NOT NULL,
  id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  salvo_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preenchidos INTEGER NOT NULL DEFAULT 0,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_estoque_contagem_copia_loja_salvo
  ON estoque_contagem_copia (id_loja, salvo_em DESC);

COMMENT ON TABLE estoque_contagem_copia IS
  'Última cópia digitada de cada contagem. Serve para puxar o que a loja salvou quando o painel não mostra como enviada.';

INSERT INTO estoque_contagem_copia (
  id_contagem, id_loja, tipo, data_contagem, status, id_usuario, salvo_em, preenchidos, itens
)
SELECT c.id_contagem,
       c.id_loja,
       COALESCE(c.tipo, 'completa'),
       c.data_contagem,
       c.status,
       c.criado_por,
       COALESCE(c.finalizado_em, c.contado_em, c.criado_em, NOW()),
       (
         SELECT COUNT(*)::int FROM estoque_itens i
         WHERE i.id_contagem = c.id_contagem
           AND (
             i.estoque_contado IS NOT NULL OR i.contagem_caixa IS NOT NULL
             OR i.contagem_pc_fd IS NOT NULL OR i.contagem_kg_und IS NOT NULL
           )
       ),
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'id_item', i.id_item,
           'codigo', p.codigo,
           'descricao', p.descricao,
           'caixa', i.contagem_caixa,
           'pc', i.contagem_pc_fd,
           'kg', i.contagem_kg_und,
           'contado', i.estoque_contado,
           'sistema', i.estoque_sistema
         ) ORDER BY p.descricao)
         FROM estoque_itens i
         JOIN insumos p ON p.id_insumo = i.id_insumo
         WHERE i.id_contagem = c.id_contagem
           AND (
             i.estoque_contado IS NOT NULL OR i.contagem_caixa IS NOT NULL
             OR i.contagem_pc_fd IS NOT NULL OR i.contagem_kg_und IS NOT NULL
           )
       ), '[]'::jsonb)
FROM estoque_contagens c
WHERE (
    c.status = 'aberta'
    OR c.data_contagem >= CURRENT_DATE - 45
    OR (c.finalizado_em AT TIME ZONE 'America/Sao_Paulo')::date >= CURRENT_DATE - 45
  )
  AND EXISTS (
    SELECT 1 FROM estoque_itens i
    WHERE i.id_contagem = c.id_contagem
      AND (
        i.estoque_contado IS NOT NULL OR i.contagem_caixa IS NOT NULL
        OR i.contagem_pc_fd IS NOT NULL OR i.contagem_kg_und IS NOT NULL
      )
  )
ON CONFLICT (id_contagem) DO NOTHING;

COMMIT;
