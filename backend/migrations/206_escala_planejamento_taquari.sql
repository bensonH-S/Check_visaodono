-- Loja BK Taquari (BKN 34390) + eventos de planejamento na escala.

INSERT INTO lojas (name, bk_number, is_active, city, state, address)
SELECT 'BURGER KING - TAQUARI', '34390', TRUE, 'Brasília', 'DF', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM lojas WHERE bk_number = '34390'
);

INSERT INTO escala_gestores (id_loja, bk_number, nome, grupo, folga_padrao, ordem, ativo)
SELECT l.id_loja, '34390', 'A definir', 'loja', NULL, 900, TRUE
FROM lojas l
WHERE l.bk_number = '34390'
  AND NOT EXISTS (
    SELECT 1
    FROM escala_gestores g
    WHERE g.ativo = TRUE
      AND COALESCE(g.bk_number, '') = '34390'
  );

CREATE TABLE IF NOT EXISTS escala_planejamento_evento (
  id_evento SERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('audiencia', 'reuniao', 'congresso', 'treinamento')),
  observacao TEXT,
  criado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escala_planejamento_loja_data
  ON escala_planejamento_evento (id_loja, data DESC);

CREATE INDEX IF NOT EXISTS idx_escala_planejamento_data_tipo
  ON escala_planejamento_evento (data, tipo);
