-- Escala de folga dos gestores (loja + time de campo).
CREATE TABLE IF NOT EXISTS escala_gestores (
  id_gestor SERIAL PRIMARY KEY,
  id_loja INTEGER REFERENCES lojas(id_loja) ON DELETE SET NULL,
  bk_number TEXT,
  nome TEXT NOT NULL,
  grupo TEXT NOT NULL DEFAULT 'loja'
    CHECK (grupo IN ('loja', 'campo')),
  folga_padrao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_escala_gestores_loja_nome
  ON escala_gestores (COALESCE(bk_number, ''), LOWER(BTRIM(nome)))
  WHERE ativo = TRUE;

CREATE TABLE IF NOT EXISTS escala_gestores_celula (
  id_celula SERIAL PRIMARY KEY,
  id_gestor INTEGER NOT NULL REFERENCES escala_gestores(id_gestor) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('folga', 'ferias', 'falta', 'ausencia')),
  UNIQUE (id_gestor, data)
);

CREATE INDEX IF NOT EXISTS idx_escala_gestores_celula_data
  ON escala_gestores_celula (data, id_gestor);
