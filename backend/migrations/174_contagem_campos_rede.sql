-- PC/FD e UNIDADES desses itens não copiam sozinhos (cadastro é por loja).
-- Libera o que as lojas pediram: pacote no balde/guardanapo/lâmina/pano/saco
-- e unidade nos rolos de etiqueta (quarta, segunda, sexta, terça).

BEGIN;

UPDATE insumos
SET permite_contagem_kg_und = TRUE, atualizado_em = NOW()
WHERE ativo = TRUE
  AND COALESCE(permite_contagem_kg_und, FALSE) = FALSE
  AND (
    descricao ILIKE '%ETIQUETA%ROLO%'
    OR codigo ILIKE '%ETIQUETA%ROLO%'
  );

UPDATE insumos
SET permite_contagem_pc_fd = TRUE, atualizado_em = NOW()
WHERE ativo = TRUE
  AND COALESCE(permite_contagem_pc_fd, FALSE) = FALSE
  AND (
    UPPER(BTRIM(codigo)) IN (
      'RCNT-BALDEPAPEL900MLBKC',
      '9241',
      '009241',
      '038752',
      '32909',
      '34932',
      '34933',
      '32906',
      '38481',
      '38482',
      '38480',
      '30413',
      '040367',
      '40367',
      '040365',
      '40365',
      '31544'
    )
    OR descricao ILIKE '%BALDE PAPEL%900%'
    OR descricao ILIKE '%GUARDANAPO%SORVETE%'
    OR descricao ILIKE '%PANO%MULTIUSO%'
    OR descricao ILIKE '%SACO%LIXO%'
    OR descricao ILIKE 'LAMINA %'
    OR descricao ILIKE 'LÂMINA %'
  );

COMMIT;
