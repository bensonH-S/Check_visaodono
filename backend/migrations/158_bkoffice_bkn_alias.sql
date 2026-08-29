-- Alias BKN antigo → BKN atual (troca de código no BK Office).
-- Ex.: Sobradinho 21274 → 30784

BEGIN;

CREATE TABLE IF NOT EXISTS bkoffice_bkn_alias (
  bkn_antigo TEXT PRIMARY KEY,
  bkn_atual TEXT NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bkoffice_bkn_alias IS
  'Se o Excel/BK vier com BKN antigo, grava na loja do BKN atual.';

INSERT INTO bkoffice_bkn_alias (bkn_antigo, bkn_atual, observacao)
VALUES ('21274', '30784', 'Píer fechou: BK ainda usa 21274; Meridian = Sobradinho 30784')
ON CONFLICT (bkn_antigo) DO UPDATE
  SET bkn_atual = EXCLUDED.bkn_atual,
      observacao = EXCLUDED.observacao;

COMMIT;
