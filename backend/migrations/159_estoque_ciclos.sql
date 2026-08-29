-- Ciclo de estoque por timestamp (contagem A → contagem B).
-- Separa dia calendário de ciclo operacional.

BEGIN;

-- Perfil operacional por loja (janela oficial de contagem)
CREATE TABLE IF NOT EXISTS lojas_estoque_perfil (
  id_loja INTEGER PRIMARY KEY REFERENCES lojas(id_loja) ON DELETE CASCADE,
  modo_ciclo TEXT NOT NULL DEFAULT 'antes_abertura'
    CHECK (modo_ciclo IN ('antes_abertura', 'corte_24h')),
  hora_corte TIME NOT NULL DEFAULT '06:00',
  janela_minutos INTEGER NOT NULL DEFAULT 30
    CHECK (janela_minutos >= 0 AND janela_minutos <= 180),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lojas_estoque_perfil IS
  'Janela oficial de contagem: antes_abertura ou corte_24h (ex. 06:00 ±30min).';

-- Instantâneo real da contagem + flag operacional (não bloqueia)
ALTER TABLE estoque_contagens
  ADD COLUMN IF NOT EXISTS contado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fora_janela BOOLEAN;

UPDATE estoque_contagens
SET contado_em = finalizado_em
WHERE contado_em IS NULL AND finalizado_em IS NOT NULL;

COMMENT ON COLUMN estoque_contagens.contado_em IS
  'Instante real usado como âncora do ciclo (COALESCE com finalizado_em).';
COMMENT ON COLUMN estoque_contagens.fora_janela IS
  'TRUE se finalizou fora da janela oficial da loja; NULL = sem perfil.';

-- Persistência opcional de ciclos calculados
CREATE TABLE IF NOT EXISTS estoque_ciclos (
  id_ciclo BIGSERIAL PRIMARY KEY,
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  id_contagem_inicio INTEGER NOT NULL REFERENCES estoque_contagens(id_contagem) ON DELETE CASCADE,
  id_contagem_fim INTEGER NOT NULL REFERENCES estoque_contagens(id_contagem) ON DELETE CASCADE,
  inicio_em TIMESTAMPTZ NOT NULL,
  fim_em TIMESTAMPTZ NOT NULL,
  duracao_segundos INTEGER NOT NULL,
  fora_janela BOOLEAN,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_estoque_ciclos_par UNIQUE (id_contagem_inicio, id_contagem_fim),
  CONSTRAINT chk_estoque_ciclos_ordem CHECK (fim_em > inicio_em)
);

CREATE INDEX IF NOT EXISTS idx_estoque_ciclos_loja_fim
  ON estoque_ciclos (id_loja, fim_em DESC);

COMMENT ON TABLE estoque_ciclos IS
  'Ciclo A→B entre duas contagens finalizadas (timestamp real).';

COMMIT;
