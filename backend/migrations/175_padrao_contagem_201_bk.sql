-- Copia o padrão de CONTAGEM da 201 Norte para as BK.
-- Não mexe em preço nem saldo. Popeyes (15022) fica de fora.

BEGIN;

UPDATE insumos dest
SET
  participa_contagem = src.participa_contagem,
  contagem_diaria = src.contagem_diaria,
  grupo_diario = src.grupo_diario,
  contagem_critica = src.contagem_critica,
  grupo_critico = src.grupo_critico,
  permite_contagem_caixa = src.permite_contagem_caixa,
  permite_contagem_pc_fd = src.permite_contagem_pc_fd,
  permite_contagem_kg_und = src.permite_contagem_kg_und,
  unidade_fracionada = src.unidade_fracionada,
  atualizado_em = NOW()
FROM insumos src, lojas l201, lojas ld
WHERE src.id_loja = l201.id_loja
  AND dest.id_loja = ld.id_loja
  AND src.ativo = TRUE
  AND dest.ativo = TRUE
  AND dest.id_loja <> src.id_loja
  AND TRIM(COALESCE(l201.bk_number, '')) = '19929'
  AND TRIM(COALESCE(ld.bk_number, '')) <> '15022'
  AND (
    UPPER(BTRIM(dest.codigo)) = UPPER(BTRIM(src.codigo))
    OR (
      dest.codigo ~ '^[0-9]+$'
      AND src.codigo ~ '^[0-9]+$'
      AND TRIM(LEADING '0' FROM dest.codigo) = TRIM(LEADING '0' FROM src.codigo)
    )
  )
  AND (
    dest.participa_contagem IS DISTINCT FROM src.participa_contagem
    OR dest.contagem_diaria IS DISTINCT FROM src.contagem_diaria
    OR dest.contagem_critica IS DISTINCT FROM src.contagem_critica
    OR dest.permite_contagem_caixa IS DISTINCT FROM src.permite_contagem_caixa
    OR dest.permite_contagem_pc_fd IS DISTINCT FROM src.permite_contagem_pc_fd
    OR dest.permite_contagem_kg_und IS DISTINCT FROM src.permite_contagem_kg_und
    OR dest.unidade_fracionada IS DISTINCT FROM src.unidade_fracionada
  );

COMMIT;
