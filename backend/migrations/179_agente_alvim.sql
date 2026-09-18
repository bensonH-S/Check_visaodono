-- Agente Alvim: persona persistida + dedup de envios (não usar memória do container).
-- Mesa financeiro nasce desligada; ingestão de planilha entra quando o arquivo chegar.

CREATE TABLE IF NOT EXISTS agente_alvim_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome TEXT NOT NULL DEFAULT 'Agente Alvim',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  mesa_operacao BOOLEAN NOT NULL DEFAULT TRUE,
  mesa_financeiro BOOLEAN NOT NULL DEFAULT FALSE,
  grupo_whatsapp TEXT,
  horario_inicio TIME NOT NULL DEFAULT '07:00',
  horario_fim TIME NOT NULL DEFAULT '22:00',
  hora_estoque TIME NOT NULL DEFAULT '08:00',
  hora_contagem TIME NOT NULL DEFAULT '11:00',
  hora_escala TIME NOT NULL DEFAULT '07:30',
  dias_ativos SMALLINT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6],
  tom TEXT NOT NULL DEFAULT 'Direto, operacional, sem enrolação. Fala como o Alvim no grupo da operação. Nunca inventa número, saldo ou loja.',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO agente_alvim_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS agente_alvim_envios (
  id_envio BIGSERIAL PRIMARY KEY,
  chave TEXT NOT NULL,
  ferramenta TEXT NOT NULL,
  destino TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agente_alvim_envios_chave
  ON agente_alvim_envios (chave);

CREATE INDEX IF NOT EXISTS idx_agente_alvim_envios_em
  ON agente_alvim_envios (enviado_em DESC);
