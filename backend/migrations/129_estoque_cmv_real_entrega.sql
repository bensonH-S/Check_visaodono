-- CMV real: data de entrega da NF (não emissão), movimentos com data de negócio,
-- fechamento mensal com lock e log de alertas.

BEGIN;

-- ── NF: entrega vs emissão ─────────────────────────────────────────────────
ALTER TABLE estoque_nfe
  ADD COLUMN IF NOT EXISTS data_entrega DATE,
  ADD COLUMN IF NOT EXISTS entrada_registrada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entrada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entrada_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

COMMENT ON COLUMN estoque_nfe.emissao IS 'Data de emissão da NF (fiscal). NÃO usar no CMV.';
COMMENT ON COLUMN estoque_nfe.data_entrega IS
  'Data em que a mercadoria entrou na loja. CMV real / compras usam esta data.';

CREATE INDEX IF NOT EXISTS idx_estoque_nfe_loja_entrega
  ON estoque_nfe (id_loja, data_entrega DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_estoque_nfe_pendente_entrada
  ON estoque_nfe (id_loja, entrada_registrada)
  WHERE entrada_registrada = FALSE;

-- ── Movimentos: data de negócio (entrega / contagem / break) ───────────────
ALTER TABLE estoque_movimentos
  ADD COLUMN IF NOT EXISTS data_movimento DATE;

UPDATE estoque_movimentos
SET data_movimento = (criado_em AT TIME ZONE 'America/Sao_Paulo')::date
WHERE data_movimento IS NULL;

ALTER TABLE estoque_movimentos
  ALTER COLUMN data_movimento SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;

CREATE INDEX IF NOT EXISTS idx_estoque_mov_loja_data_mov
  ON estoque_movimentos (id_loja, data_movimento DESC, id_movimento DESC);

-- ── Fechamento mensal (lock) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_fechamentos (
  id_fechamento SERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  ano_mes CHAR(7) NOT NULL, -- YYYY-MM
  status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'fechado')),
  id_contagem_ei INTEGER REFERENCES estoque_contagens(id_contagem) ON DELETE SET NULL,
  id_contagem_ef INTEGER REFERENCES estoque_contagens(id_contagem) ON DELETE SET NULL,
  data_ei DATE,
  data_ef DATE,
  venda NUMERIC(14, 2),
  estoque_inicial NUMERIC(14, 2),
  compras NUMERIC(14, 2),
  estoque_final NUMERIC(14, 2),
  consumo_real NUMERIC(14, 2),
  cmv_real_pct NUMERIC(8, 4),
  cmv_teorico_pct NUMERIC(8, 4),
  meta_pct NUMERIC(8, 4) DEFAULT 38,
  snapshot_json JSONB,
  fechado_em TIMESTAMPTZ,
  fechado_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  reaberto_em TIMESTAMPTZ,
  reaberto_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_estoque_fechamento_loja_mes UNIQUE (id_loja, ano_mes)
);

CREATE INDEX IF NOT EXISTS idx_estoque_fechamentos_loja
  ON estoque_fechamentos (id_loja, ano_mes DESC);

-- ── Alertas (dedupe) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_alertas_log (
  id_alerta BIGSERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  chave TEXT NOT NULL,
  payload JSONB,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_estoque_alerta_dedupe UNIQUE (id_loja, tipo, chave)
);

COMMIT;
