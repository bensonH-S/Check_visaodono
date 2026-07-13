BEGIN;

-- Linha DELIVERY na escala: GA - ESCRITORIO vira âncora; King Assessoria sai da grade.
UPDATE lojas SET name = 'DELIVERY' WHERE name = 'GA - ESCRITORIO';

ALTER TABLE escala_visitas_celula
  ADD COLUMN IF NOT EXISTS id_loja_destino INT REFERENCES lojas(id_loja) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_escala_visitas_celula_delivery
  ON escala_visitas_celula (id_semana, id_loja, dia, id_loja_destino)
  WHERE id_loja_destino IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escala_visitas_celula_loja_destino
  ON escala_visitas_celula (id_loja_destino)
  WHERE id_loja_destino IS NOT NULL;

COMMIT;
