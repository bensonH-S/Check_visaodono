-- Grupos WhatsApp do Alvim (Liderança, Gestores, Região / Projetos de TI).

ALTER TABLE agente_alvim_config
  ADD COLUMN IF NOT EXISTS grupos JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS agente_alvim_pedidos (
  id SERIAL PRIMARY KEY,
  texto TEXT NOT NULL,
  itens TEXT[] NOT NULL DEFAULT '{}',
  solicitado_por TEXT,
  grupo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
