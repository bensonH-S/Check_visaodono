-- NFs baixadas do portal eSupri (Platlog) — custo e auditoria (sem F360).

CREATE TABLE IF NOT EXISTS estoque_nfe (
  id_nfe SERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  fornecedor TEXT NOT NULL DEFAULT 'platlog',
  chave TEXT,
  numero TEXT,
  serie TEXT,
  emissao DATE,
  emitente_cnpj TEXT,
  emitente_nome TEXT,
  valor_total NUMERIC(14, 2),
  xml_path TEXT,
  status TEXT NOT NULL DEFAULT 'importada'
    CHECK (status IN ('baixada', 'importada', 'parcial', 'erro')),
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_nfe_loja_chave
  ON estoque_nfe (id_loja, chave)
  WHERE chave IS NOT NULL AND chave <> '';

CREATE INDEX IF NOT EXISTS idx_estoque_nfe_loja_emissao
  ON estoque_nfe (id_loja, emissao DESC);

CREATE TABLE IF NOT EXISTS estoque_nfe_itens (
  id_item SERIAL PRIMARY KEY,
  id_nfe INTEGER NOT NULL REFERENCES estoque_nfe(id_nfe) ON DELETE CASCADE,
  n_item INTEGER,
  codigo_nf TEXT,
  ean TEXT,
  descricao TEXT,
  u_com TEXT,
  q_com NUMERIC(14, 4),
  v_un_com NUMERIC(14, 6),
  v_prod NUMERIC(14, 4),
  id_insumo INTEGER REFERENCES insumos(id_insumo) ON DELETE SET NULL,
  match_tipo TEXT,
  preco_caixa_aplicado NUMERIC(14, 4),
  qtd_estoque NUMERIC(14, 4),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoque_nfe_itens_nfe ON estoque_nfe_itens (id_nfe);
CREATE INDEX IF NOT EXISTS idx_estoque_nfe_itens_insumo ON estoque_nfe_itens (id_insumo);
