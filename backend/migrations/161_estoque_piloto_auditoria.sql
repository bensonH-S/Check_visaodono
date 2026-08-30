-- Auditoria temporária detalhada do piloto de baixa (loja 23531).
-- Não altera movimentos existentes.

BEGIN;

CREATE TABLE IF NOT EXISTS estoque_baixa_auditoria (
  id_auditoria BIGSERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  id_venda INTEGER,
  data_venda DATE,
  codigo_produto TEXT,
  descricao_produto TEXT,
  quantidade_vendida NUMERIC(14, 6),
  codigo_ficha TEXT,
  id_insumo INTEGER,
  codigo_insumo TEXT,
  descricao_insumo TEXT,
  quantidade_receita NUMERIC(14, 6),
  unidade_receita TEXT,
  unidade_estoque TEXT,
  fator_aplicado NUMERIC(14, 8),
  origem_conversao TEXT,
  consumo_unitario NUMERIC(14, 6),
  delta NUMERIC(14, 6),
  saldo_antes NUMERIC(14, 6),
  saldo_depois NUMERIC(14, 6),
  status TEXT NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoque_baixa_auditoria_loja_em
  ON estoque_baixa_auditoria (id_loja, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_estoque_baixa_auditoria_status
  ON estoque_baixa_auditoria (id_loja, status, criado_em DESC);

COMMENT ON TABLE estoque_baixa_auditoria IS
  'Auditoria temporária do piloto: um registro por componente da ficha em cada baixa de venda.';

COMMIT;
