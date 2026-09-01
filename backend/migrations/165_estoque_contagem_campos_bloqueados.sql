-- Planilha dos gestores pintou CAIXA + PC/FD + KG/UND de preto em 16 SKUs.
-- Na conferência as três células ficam bloqueadas; na finalização o item em
-- branco vira 0 e zera o saldo. Diária: só 35221 (carne gourmet). Mensal: os 16.

BEGIN;

-- Caixa e unidade avulsa sempre; pacote só quando o cadastro já tem fator PC/FD.
UPDATE insumos
SET permite_contagem_caixa = TRUE,
    permite_contagem_kg_und = TRUE,
    permite_contagem_pc_fd = CASE
      WHEN COALESCE(und_parcial, 1) > 1 THEN TRUE
      ELSE permite_contagem_pc_fd
    END,
    atualizado_em = NOW()
WHERE ativo = TRUE
  AND permite_contagem_caixa = FALSE
  AND permite_contagem_pc_fd = FALSE
  AND permite_contagem_kg_und = FALSE;

ALTER TABLE insumos DROP CONSTRAINT IF EXISTS insumos_permite_contagem_ao_menos_um;
ALTER TABLE insumos ADD CONSTRAINT insumos_permite_contagem_ao_menos_um
  CHECK (
    NOT ativo
    OR permite_contagem_caixa
    OR permite_contagem_pc_fd
    OR permite_contagem_kg_und
  );

COMMIT;
