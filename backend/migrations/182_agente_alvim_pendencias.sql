-- Memória operacional: o sistema controla o estado da pendência.

CREATE TABLE IF NOT EXISTS agente_alvim_pendencias (
  id BIGSERIAL PRIMARY KEY,
  chave TEXT NOT NULL,
  tipo TEXT NOT NULL,
  estado TEXT NOT NULL,
  loja TEXT,
  id_loja INT,
  regional TEXT,
  id_usuario INT,
  id_regiao INT,
  assunto TEXT,
  prazo TEXT,
  dia DATE NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolvido_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agente_alvim_pendencias_chave
  ON agente_alvim_pendencias (chave);

CREATE INDEX IF NOT EXISTS idx_agente_alvim_pendencias_abertas
  ON agente_alvim_pendencias (dia, estado);
