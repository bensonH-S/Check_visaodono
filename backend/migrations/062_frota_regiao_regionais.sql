BEGIN;

CREATE TABLE IF NOT EXISTS frota_regiao_regionais (
  id_regiao INT NOT NULL REFERENCES frota_regioes(id_regiao) ON DELETE CASCADE,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  PRIMARY KEY (id_regiao, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_frota_regiao_regionais_regiao ON frota_regiao_regionais(id_regiao);

INSERT INTO frota_regiao_regionais (id_regiao, id_usuario)
SELECT id_regiao, id_regional
FROM frota_regioes
WHERE id_regional IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
