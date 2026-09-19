BEGIN;

CREATE TABLE IF NOT EXISTS estoque_fornecedor_credencial (
  id_credencial SERIAL PRIMARY KEY,
  fornecedor TEXT NOT NULL
    CHECK (fornecedor IN ('platlog', 'coca', 'idealwork', 'gimba')),
  id_loja INTEGER REFERENCES lojas(id_loja) ON DELETE CASCADE,
  portal TEXT NOT NULL DEFAULT '',
  usuario TEXT NOT NULL DEFAULT '',
  senha TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_forn_cred_loja
  ON estoque_fornecedor_credencial (fornecedor, id_loja, portal)
  WHERE id_loja IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_forn_cred_rede
  ON estoque_fornecedor_credencial (fornecedor, portal)
  WHERE id_loja IS NULL;

COMMENT ON TABLE estoque_fornecedor_credencial IS
  'Logins dos portais de NF por loja/fornecedor. Não versionar senhas.';

ALTER TABLE estoque_sync_fornecedor
  DROP CONSTRAINT IF EXISTS estoque_sync_fornecedor_fornecedor_check;
ALTER TABLE estoque_sync_fornecedor
  ADD CONSTRAINT estoque_sync_fornecedor_fornecedor_check
  CHECK (fornecedor IN ('platlog', 'coca', 'idealwork', 'gimba'));

ALTER TABLE estoque_sync_fornecedor
  DROP CONSTRAINT IF EXISTS estoque_sync_fornecedor_limite_check;
ALTER TABLE estoque_sync_fornecedor
  ADD CONSTRAINT estoque_sync_fornecedor_limite_check
  CHECK (limite > 0 AND limite <= 500);

UPDATE estoque_sync_fornecedor SET limite = 80 WHERE limite < 80;

INSERT INTO estoque_sync_fornecedor (fornecedor, id_loja, ativo, horario, limite)
SELECT f.fornecedor, l.id_loja, TRUE, '05:00'::time, 80
FROM lojas l
CROSS JOIN (VALUES ('platlog'), ('coca'), ('idealwork'), ('gimba')) AS f(fornecedor)
WHERE COALESCE(l.is_active, TRUE)
  AND regexp_replace(COALESCE(l.bk_number, ''), '\D', '', 'g') IN (
    '19929','23531','18915','23194','24820','21583','31614','32555',
    '31608','31782','33104','30784','27984','30769','25261','20415',
    '23240','30797','32338','15022'
  )
ON CONFLICT (fornecedor, id_loja) DO UPDATE SET
  limite = GREATEST(estoque_sync_fornecedor.limite, 80);

COMMIT;
