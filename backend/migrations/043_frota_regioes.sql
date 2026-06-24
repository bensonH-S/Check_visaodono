BEGIN;

CREATE TABLE IF NOT EXISTS frota_regioes (
  id_regiao SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frota_regiao_lojas (
  id_regiao INT NOT NULL REFERENCES frota_regioes(id_regiao) ON DELETE CASCADE,
  id_loja INT NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  PRIMARY KEY (id_regiao, id_loja)
);

CREATE TABLE IF NOT EXISTS frota_regiao_tecnicos (
  id_regiao INT NOT NULL REFERENCES frota_regioes(id_regiao) ON DELETE CASCADE,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  PRIMARY KEY (id_regiao, id_usuario)
);

ALTER TABLE frota_veiculos
  ADD COLUMN IF NOT EXISTS id_regiao INT REFERENCES frota_regioes(id_regiao) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_frota_veiculos_regiao ON frota_veiculos(id_regiao);

COMMIT;
