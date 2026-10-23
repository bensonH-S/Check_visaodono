-- Tabela de preço BKC × Platlog e espelho dos pedidos do eSupri.
-- O preço da tabela é o teto: NF ou pedido acima dele vira cobrança.

BEGIN;

CREATE TABLE IF NOT EXISTS estoque_tabela_preco (
  id BIGSERIAL PRIMARY KEY,
  vigencia DATE NOT NULL,
  tabela TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT,
  tipologia TEXT,
  preco NUMERIC(14, 4) NOT NULL,
  origem TEXT,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vigencia, tabela, codigo)
);
CREATE INDEX IF NOT EXISTS idx_estoque_tabela_preco_busca
  ON estoque_tabela_preco (tabela, codigo, vigencia DESC);

COMMENT ON TABLE estoque_tabela_preco IS
  'Preço de venda acordado BKC × Platlog por tabela (BB5 = Franquia N/NE/CO). codigo sem zeros à esquerda.';

CREATE TABLE IF NOT EXISTS estoque_pedido_platlog (
  id_pedido BIGSERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja),
  codigo TEXT NOT NULL,
  data_pedido DATE,
  hora_pedido TEXT,
  valor_total NUMERIC(14, 2),
  qtd_itens INTEGER,
  peso_bruto NUMERIC(14, 3),
  data_entrega DATE,
  status TEXT,
  flag_status TEXT,
  observacao TEXT,
  portal_inserido_em TIMESTAMP,
  portal_atualizado_em TIMESTAMP,
  itens_lidos_em TIMESTAMPTZ,
  sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_loja, codigo)
);
CREATE INDEX IF NOT EXISTS idx_estoque_pedido_platlog_loja_data
  ON estoque_pedido_platlog (id_loja, data_pedido DESC);

CREATE TABLE IF NOT EXISTS estoque_pedido_platlog_itens (
  id_item BIGSERIAL PRIMARY KEY,
  id_pedido BIGINT NOT NULL REFERENCES estoque_pedido_platlog(id_pedido) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  descricao TEXT,
  quantidade NUMERIC(14, 3),
  unidade TEXT,
  valor_unitario NUMERIC(14, 4),
  valor_total NUMERIC(14, 2)
);
CREATE INDEX IF NOT EXISTS idx_estoque_pedido_platlog_itens_pedido
  ON estoque_pedido_platlog_itens (id_pedido);

ALTER TABLE estoque_nfe ADD COLUMN IF NOT EXISTS pedido_esupri TEXT;
CREATE INDEX IF NOT EXISTS idx_estoque_nfe_pedido_esupri
  ON estoque_nfe (id_loja, pedido_esupri) WHERE pedido_esupri IS NOT NULL;
COMMENT ON COLUMN estoque_nfe.pedido_esupri IS 'Pedido do eSupri que gerou a nota (xPed "E-Supri: U50491").';

COMMIT;
