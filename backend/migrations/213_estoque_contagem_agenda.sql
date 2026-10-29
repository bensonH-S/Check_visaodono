-- Agenda do dia de cada loja: diária, semanal (segunda) ou mensal (dia 1).
-- Não guarda a lista de itens. A mensal continua no cadastro.

BEGIN;

CREATE TABLE IF NOT EXISTS estoque_contagem_agenda (
  id_loja INTEGER NOT NULL REFERENCES lojas(id_loja) ON DELETE CASCADE,
  data_agenda DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('diaria', 'critica_semanal', 'completa')),
  diaria BOOLEAN NOT NULL,
  semanal BOOLEAN NOT NULL,
  mensal BOOLEAN NOT NULL,
  aplicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id_loja, data_agenda)
);

COMMENT ON TABLE estoque_contagem_agenda IS
  'Tipo de contagem liberado no dia, por loja. A lista da mensal não entra aqui.';

COMMIT;
