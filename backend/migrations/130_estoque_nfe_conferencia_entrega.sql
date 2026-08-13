-- Conferência de recebimento NF: portal sugere saída; gestor valida itens.

BEGIN;

ALTER TABLE estoque_nfe
  ADD COLUMN IF NOT EXISTS data_saida DATE,
  ADD COLUMN IF NOT EXISTS status_portal TEXT,
  ADD COLUMN IF NOT EXISTS status_entrega TEXT NOT NULL DEFAULT 'aguardando_portal';

-- status_entrega:
--   aguardando_portal     = NF importada, ainda sem sinal de saída/entrega no fornecedor
--   em_transito           = portal indica faturado/remessa/em transporte
--   aguardando_conferencia = portal indica saída/entrega → gestor confere itens na loja
--   conferida             = gestor confirmou e saldo foi atualizado
--   divergente            = gestor marcou diferença de quantidade

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_estoque_nfe_status_entrega'
  ) THEN
    ALTER TABLE estoque_nfe
      ADD CONSTRAINT chk_estoque_nfe_status_entrega
      CHECK (status_entrega IN (
        'aguardando_portal',
        'em_transito',
        'aguardando_conferencia',
        'conferida',
        'divergente'
      ));
  END IF;
END $$;

COMMENT ON COLUMN estoque_nfe.data_saida IS
  'Data de saída/expedição do fornecedor (XML dhSaiEnt ou portal). Sugestão para CMV — não é emissão.';
COMMENT ON COLUMN estoque_nfe.status_portal IS
  'Status bruto do portal do fornecedor (ex.: Entregue, Em transporte).';
COMMENT ON COLUMN estoque_nfe.status_entrega IS
  'Ciclo de recebimento na loja. Entrada no saldo só após conferida.';

CREATE INDEX IF NOT EXISTS idx_estoque_nfe_status_entrega
  ON estoque_nfe (id_loja, status_entrega, data_saida DESC NULLS LAST);

ALTER TABLE estoque_nfe_itens
  ADD COLUMN IF NOT EXISTS qtd_conferida NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS conferido BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS divergencia_obs TEXT;

-- NFs já com entrada_registrada → conferida
UPDATE estoque_nfe
SET status_entrega = 'conferida'
WHERE entrada_registrada = TRUE
  AND status_entrega = 'aguardando_portal';

COMMIT;
