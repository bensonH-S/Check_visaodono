-- Catálogo de SLAs separado das categorias de manutenção
BEGIN;

CREATE TABLE IF NOT EXISTS manut_sla (
  id_sla SERIAL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  horas INT NOT NULL CHECK (horas > 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE manut_categorias
  ADD COLUMN IF NOT EXISTS id_sla INT REFERENCES manut_sla(id_sla);

INSERT INTO manut_sla (nome, horas)
SELECT 'SLA ' || d.horas || 'h', d.horas
FROM (SELECT DISTINCT sla_horas AS horas FROM manut_categorias) d
WHERE NOT EXISTS (SELECT 1 FROM manut_sla LIMIT 1);

UPDATE manut_categorias c
SET id_sla = s.id_sla
FROM manut_sla s
WHERE c.id_sla IS NULL AND s.horas = c.sla_horas;

COMMIT;
