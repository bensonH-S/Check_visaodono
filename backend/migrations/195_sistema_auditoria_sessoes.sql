-- Sessões e navegação: tempo conectado + cada aba/rota que o usuário abre.

CREATE TABLE IF NOT EXISTS sistema_sessoes (
  id_sessao BIGSERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  iniciada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_ping_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em TIMESTAMPTZ,
  duracao_segundos INT,
  ip TEXT,
  user_agent TEXT,
  dispositivo TEXT,
  origem TEXT
);

CREATE INDEX IF NOT EXISTS idx_sistema_sessoes_usuario ON sistema_sessoes(id_usuario, iniciada_em DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_sessoes_ping ON sistema_sessoes(ultimo_ping_em DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_sessoes_abertas ON sistema_sessoes(id_usuario)
  WHERE encerrada_em IS NULL;

CREATE TABLE IF NOT EXISTS sistema_navegacao (
  id_navegacao BIGSERIAL PRIMARY KEY,
  id_sessao BIGINT NOT NULL REFERENCES sistema_sessoes(id_sessao) ON DELETE CASCADE,
  id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  rota TEXT NOT NULL,
  titulo TEXT,
  entrou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saiu_em TIMESTAMPTZ,
  duracao_segundos INT
);

CREATE INDEX IF NOT EXISTS idx_sistema_navegacao_usuario ON sistema_navegacao(id_usuario, entrou_em DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_navegacao_sessao ON sistema_navegacao(id_sessao, entrou_em DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_navegacao_rota ON sistema_navegacao(rota);

ALTER TABLE sistema_auditoria
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;
