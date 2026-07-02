BEGIN;

ALTER TABLE escala_visitas_celula ADD COLUMN IF NOT EXISTS id_celula SERIAL;

ALTER TABLE escala_visitas_celula DROP CONSTRAINT IF EXISTS escala_visitas_celula_pkey;

ALTER TABLE escala_visitas_celula ADD PRIMARY KEY (id_celula);

CREATE UNIQUE INDEX IF NOT EXISTS uq_escala_visitas_celula_pessoa
  ON escala_visitas_celula (id_semana, id_loja, dia, id_regional)
  WHERE id_regional IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escala_visitas_celula_semana_loja_dia
  ON escala_visitas_celula (id_semana, id_loja, dia);

COMMIT;
