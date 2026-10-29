-- Simulação do pedido sugerido. Só guarda rascunho de teste. Não é pedido enviado.

BEGIN;

CREATE TABLE IF NOT EXISTS estoque_pedido_simulacao (
  id_simulacao BIGSERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modo TEXT NOT NULL DEFAULT 'teste',
  dias INTEGER NOT NULL,
  estoque_seguranca_dias INTEGER NOT NULL,
  meta_cmp NUMERIC(8, 4) NOT NULL,
  valor_pedido NUMERIC(14, 2) NOT NULL DEFAULT 0,
  itens_com_caixa INTEGER NOT NULL DEFAULT 0,
  itens_bloqueados INTEGER NOT NULL DEFAULT 0,
  resumo JSONB NOT NULL,
  itens JSONB NOT NULL,
  CONSTRAINT estoque_pedido_simulacao_modo_check CHECK (modo = 'teste')
);

CREATE INDEX IF NOT EXISTS idx_estoque_pedido_simulacao_loja
  ON estoque_pedido_simulacao (id_loja, criado_em DESC);

COMMENT ON TABLE estoque_pedido_simulacao IS
  'Rascunho calculado na aba Pedido. modo teste: a linha não autoriza compra.';

COMMIT;
