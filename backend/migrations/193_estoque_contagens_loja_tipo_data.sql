-- Acelera painel contagens/rede (LATERAL por loja + tipo + dia).
CREATE INDEX IF NOT EXISTS idx_estoque_contagens_loja_tipo_data
  ON estoque_contagens (id_loja, tipo, data_contagem DESC, id_contagem DESC);

CREATE INDEX IF NOT EXISTS idx_estoque_contagens_loja_tipo_finalizada
  ON estoque_contagens (id_loja, tipo, data_contagem DESC, id_contagem DESC)
  WHERE status = 'finalizada';
