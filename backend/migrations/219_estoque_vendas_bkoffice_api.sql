-- Vendas pela API oficial do BK Office (origem bkoffice_api).
-- Não substitui as linhas do Excel: a API grava outra origem no mesmo dia.
-- venda_liquida continua o bruto (valorTotalItem). desconto é coluna nova.
-- Ceilândia NÃO é alterada: o CNPJ do cadastro segue em investigação.
-- Se a API responder "não autorizado", o job registra e segue.

BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'estoque_vendas'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%origem%'
  LOOP
    EXECUTE format('ALTER TABLE estoque_vendas DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE estoque_vendas
  ADD CONSTRAINT estoque_vendas_origem_check
  CHECK (origem IN ('bkoffice', 'bkoffice_api', 'upload', 'manual'));

ALTER TABLE estoque_vendas
  ADD COLUMN IF NOT EXISTS substituida_em TIMESTAMPTZ;

COMMENT ON COLUMN estoque_vendas.substituida_em IS
  'Preenchido quando a baixa do Excel (origem bkoffice) foi desfeita em favor da API.';

ALTER TABLE estoque_venda_itens
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(14, 2);

COMMENT ON COLUMN estoque_venda_itens.desconto IS
  'Desconto do item na origem bkoffice_api. venda_liquida permanece o bruto (valorTotalItem).';

CREATE TABLE IF NOT EXISTS estoque_bkoffice_reimport_backup (
  id_backup BIGSERIAL PRIMARY KEY,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id_loja INTEGER,
  data_venda DATE,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bkoffice_reimport_backup_loja_dia
  ON estoque_bkoffice_reimport_backup (id_loja, data_venda);

COMMENT ON TABLE estoque_bkoffice_reimport_backup IS
  'Snapshot das vendas/itens/movimentos antes do --apply da reimportação pela API.';

-- Taquari: CNPJ confirmado. Entra no sync da API assim que a migration rodar.
-- Só atualiza se houver exatamente uma loja com esse nome (não é Popeyes).
DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n
  FROM lojas
  WHERE (
      name ILIKE '%taquari%'
      OR COALESCE(city, '') ILIKE '%taquari%'
      OR COALESCE(neighborhood, '') ILIKE '%taquari%'
    )
    AND COALESCE(name, '') !~* 'popeyes|popyes';

  IF n = 1 THEN
    UPDATE lojas
    SET cnpj = '35252660000144'
    WHERE (
        name ILIKE '%taquari%'
        OR COALESCE(city, '') ILIKE '%taquari%'
        OR COALESCE(neighborhood, '') ILIKE '%taquari%'
      )
      AND COALESCE(name, '') !~* 'popeyes|popyes'
      AND cnpj IS DISTINCT FROM '35252660000144';
  ELSIF n = 0 THEN
    RAISE NOTICE 'Nenhuma loja Taquari encontrada. CNPJ 35252660000144 não gravado.';
  ELSE
    RAISE EXCEPTION 'Mais de uma loja com nome Taquari (%). CNPJ não aplicado.', n;
  END IF;
END $$;

COMMIT;
