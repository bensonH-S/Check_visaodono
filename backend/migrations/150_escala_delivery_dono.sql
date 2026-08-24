BEGIN;

-- Delivery grava destino + dono (Kadu). O índice antigo impedia duas lojas no mesmo dia.
DROP INDEX IF EXISTS uq_escala_visitas_celula_pessoa;
CREATE UNIQUE INDEX uq_escala_visitas_celula_pessoa
  ON escala_visitas_celula (id_semana, id_loja, dia, id_regional)
  WHERE id_regional IS NOT NULL AND id_loja_destino IS NULL;

COMMIT;
