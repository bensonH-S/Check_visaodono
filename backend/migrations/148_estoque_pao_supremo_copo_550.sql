-- Pão Supremo: libera PC/FD. Copo 550 ml entra nas contagens já abertas.

BEGIN;

CREATE TEMP TABLE tmp_bk_lojas AS
SELECT id_loja FROM lojas
WHERE COALESCE(is_active, TRUE)
  AND name ILIKE '%burger king%';

-- 1) Pão Supremo (36252 = planilha). Pacote de 18 un na caixa de 180.
UPDATE insumos
SET permite_contagem_pc_fd = TRUE,
    und_parcial = CASE WHEN COALESCE(und_parcial, 1) <= 1 THEN 18 ELSE und_parcial END,
    atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND ativo = TRUE
  AND (
    codigo IN ('36252', '30232')
    OR descricao ~* 'PAO CONG SUPREMO'
  );

-- Duplicata com zero à frente (mesmo pão). Fica o 36252.
UPDATE insumos
SET ativo = FALSE, contagem_diaria = FALSE, contagem_critica = FALSE, atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = '036252';

-- 2) Copo 550 ml drive: cadastro já existe; garante flags e nome visível junto dos 440.
UPDATE insumos
SET ativo = TRUE,
    contagem_diaria = TRUE,
    grupo_diario = 'refil',
    permite_contagem_pc_fd = TRUE,
    permite_contagem_caixa = TRUE,
    und_parcial = CASE WHEN COALESCE(und_parcial, 1) <= 1 THEN 50 ELSE und_parcial END,
    descricao = CASE
      WHEN descricao ~* 'REFRIG' THEN descricao
      ELSE 'COPO REFRIG.PP BK 550ML CX 1200 UND'
    END,
    atualizado_em = NOW()
WHERE id_loja IN (SELECT id_loja FROM tmp_bk_lojas)
  AND codigo = '042242';

-- 3) Coloca o 550 nas diárias/completas já abertas (não estava no snapshot da manhã).
INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
SELECT c.id_contagem,
       i.id_insumo,
       COALESCE(s.quantidade, 0),
       NULL
FROM estoque_contagens c
JOIN insumos i
  ON i.id_loja = c.id_loja
 AND i.codigo = '042242'
 AND i.ativo = TRUE
LEFT JOIN estoque_saldos s
  ON s.id_insumo = i.id_insumo AND s.id_loja = i.id_loja
WHERE c.status = 'aberta'
  AND COALESCE(c.tipo, 'completa') IN ('diaria', 'completa')
  AND NOT EXISTS (
    SELECT 1 FROM estoque_itens ei
    WHERE ei.id_contagem = c.id_contagem
      AND ei.id_insumo = i.id_insumo
  );

DELETE FROM estoque_itens ei
USING estoque_contagens c, insumos i
WHERE ei.id_contagem = c.id_contagem
  AND ei.id_insumo = i.id_insumo
  AND c.status = 'aberta'
  AND i.ativo = FALSE
  AND i.id_loja IN (SELECT id_loja FROM tmp_bk_lojas);

COMMIT;
