-- Cópia da escala no envio para aprovação.
-- A grade ao vivo pode ser editada ou excluída; o envio fica congelado.

BEGIN;

CREATE TABLE IF NOT EXISTS escala_visitas_envio (
  id_envio SERIAL PRIMARY KEY,
  id_semana INT NOT NULL REFERENCES escala_visitas_semana(id_semana) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('regiao', 'delivery')),
  id_regiao INT REFERENCES frota_regioes(id_regiao) ON DELETE SET NULL,
  submetido_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  submetido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escala_visitas_envio_semana
  ON escala_visitas_envio (id_semana, tipo, id_regiao, submetido_em DESC);

CREATE TABLE IF NOT EXISTS escala_visitas_envio_celula (
  id_envio_celula SERIAL PRIMARY KEY,
  id_envio INT NOT NULL REFERENCES escala_visitas_envio(id_envio) ON DELETE CASCADE,
  id_loja INT NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  dia SMALLINT NOT NULL CHECK (dia >= 0 AND dia <= 6),
  id_regional INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  id_loja_destino INT REFERENCES lojas(id_loja) ON DELETE SET NULL,
  observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_escala_visitas_envio_celula_envio
  ON escala_visitas_envio_celula (id_envio, id_loja, dia);

COMMENT ON TABLE escala_visitas_envio IS
  'Snapshot da escala no momento do envio para aprovação. Não é apagado ao excluir a grade ao vivo.';

-- Backfill: regiões já pendentes/aprovadas (só se ainda houver células).
INSERT INTO escala_visitas_envio (id_semana, tipo, id_regiao, submetido_por, submetido_em)
SELECT s.id_semana, 'regiao', s.id_regiao, s.submetido_por, COALESCE(s.submetido_em, NOW())
FROM escala_visitas_regiao_status s
WHERE s.status IN ('pendente_aprovacao', 'aprovado')
  AND s.submetido_por IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM escala_visitas_celula c
    JOIN frota_regiao_lojas rl ON rl.id_loja = c.id_loja AND rl.id_regiao = s.id_regiao
    LEFT JOIN lojas ld ON LOWER(TRIM(ld.name)) = 'delivery'
    WHERE c.id_semana = s.id_semana
      AND c.id_loja_destino IS NULL
      AND (ld.id_loja IS NULL OR c.id_loja <> ld.id_loja)
  );

INSERT INTO escala_visitas_envio_celula (id_envio, id_loja, dia, id_regional, id_loja_destino, observacao)
SELECT e.id_envio, c.id_loja, c.dia, c.id_regional, c.id_loja_destino, c.observacao
FROM escala_visitas_envio e
JOIN escala_visitas_celula c ON c.id_semana = e.id_semana
JOIN frota_regiao_lojas rl ON rl.id_loja = c.id_loja AND rl.id_regiao = e.id_regiao
LEFT JOIN lojas ld ON LOWER(TRIM(ld.name)) = 'delivery'
WHERE e.tipo = 'regiao'
  AND c.id_loja_destino IS NULL
  AND (ld.id_loja IS NULL OR c.id_loja <> ld.id_loja);

INSERT INTO escala_visitas_envio (id_semana, tipo, id_regiao, submetido_por, submetido_em)
SELECT s.id_semana, 'delivery', NULL, s.submetido_por, COALESCE(s.submetido_em, NOW())
FROM escala_visitas_delivery_status s
JOIN lojas ld ON LOWER(TRIM(ld.name)) = 'delivery'
WHERE s.status IN ('pendente_aprovacao', 'aprovado')
  AND s.submetido_por IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM escala_visitas_celula c
    WHERE c.id_semana = s.id_semana AND c.id_loja = ld.id_loja
  );

INSERT INTO escala_visitas_envio_celula (id_envio, id_loja, dia, id_regional, id_loja_destino, observacao)
SELECT e.id_envio, c.id_loja, c.dia, c.id_regional, c.id_loja_destino, c.observacao
FROM escala_visitas_envio e
JOIN lojas ld ON LOWER(TRIM(ld.name)) = 'delivery'
JOIN escala_visitas_celula c ON c.id_semana = e.id_semana AND c.id_loja = ld.id_loja
WHERE e.tipo = 'delivery';

COMMIT;
