-- Clientes da API externa (Mycto). O token em claro não entra no banco: só o SHA-256.
-- A env MYCTO_API_TOKEN autentica sem esta tabela. A tabela serve para mais de uma chave
-- e para revogar (ativo = false) sem redeploy.
--
-- Hash (não grave o token no histórico do shell se o ambiente logar argv):
--   node --input-type=module -e "import {createHash} from 'node:crypto'; const t=process.env.TOKEN||''; if(!t) throw new Error('defina TOKEN'); console.log(createHash('sha256').update(t).digest('hex'))"
--
--   INSERT INTO api_clientes (nome, token_hash) VALUES ('mycto', '<hex>');

CREATE TABLE IF NOT EXISTS api_clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acesso_em TIMESTAMPTZ,
  CONSTRAINT uq_api_clientes_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_clientes_ativo
  ON api_clientes (ativo)
  WHERE ativo = TRUE;

CREATE TABLE IF NOT EXISTS api_acesso_log (
  id BIGSERIAL PRIMARY KEY,
  id_cliente INTEGER REFERENCES api_clientes (id) ON DELETE SET NULL,
  cliente_nome TEXT,
  metodo TEXT NOT NULL,
  caminho TEXT NOT NULL,
  status INTEGER,
  ip TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_acesso_log_criado
  ON api_acesso_log (criado_em DESC);

COMMENT ON TABLE api_clientes IS 'Chaves de API externas (Mycto). token_hash = SHA-256 hex do Bearer.';
COMMENT ON TABLE api_acesso_log IS 'Acesso à API externa. Sem token e sem corpo da nota.';
