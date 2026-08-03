-- Configuração e status do sync automático de NF por fornecedor (Platlog, Coca…).

CREATE TABLE IF NOT EXISTS estoque_sync_fornecedor (
  id_sync SERIAL PRIMARY KEY,
  fornecedor TEXT NOT NULL
    CHECK (fornecedor IN ('platlog', 'coca')),
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  -- Horário diário (America/Sao_Paulo), formato HH:MM
  horario TIME NOT NULL DEFAULT '06:00',
  limite INTEGER NOT NULL DEFAULT 20 CHECK (limite > 0 AND limite <= 200),
  ultimo_inicio TIMESTAMPTZ,
  ultimo_fim TIMESTAMPTZ,
  ultimo_status TEXT
    CHECK (ultimo_status IS NULL OR ultimo_status IN ('ok', 'erro', 'rodando', 'parcial')),
  ultimo_resumo JSONB,
  ultimo_erro TEXT,
  ultima_execucao_dia DATE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fornecedor, id_loja)
);

COMMENT ON TABLE estoque_sync_fornecedor IS
  'Agenda diária de sync NF (eSupri/Platlog, Coca…). Credenciais ficam no .env.';

-- Seed Terraço + Platlog (inativo até ativar na tela)
INSERT INTO estoque_sync_fornecedor (fornecedor, id_loja, ativo, horario, limite)
SELECT 'platlog', id_loja, FALSE, '06:00'::time, 20
FROM lojas
WHERE bk_number = '30797' OR name ILIKE '%TERRA%SHOPPING%'
ON CONFLICT (fornecedor, id_loja) DO NOTHING;
