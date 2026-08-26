-- Mix da semanal: Coca-Cola clássica bag 18 L; Zero / Fanta / Sprite 10 L.

BEGIN;

-- Cadastro: tira 18 L de Zero / Fanta / Sprite (Coca clássica permanece 18 L).
UPDATE insumos
SET descricao = regexp_replace(
      regexp_replace(descricao, '18\s*LT', '10 LT', 'i'),
      '18000\s*ML',
      '10000ML',
      'i'
    ),
    und_convertida = 10,
    atualizado_em = NOW()
WHERE ativo = TRUE
  AND descricao ~* 'BAG'
  AND descricao ~* '(FANTA|SPRITE|ZERO|SEM ACUCAR)'
  AND descricao !~* 'MOLHO|MAIONESE|BARBECUE|LIPTON'
  AND NOT (
    descricao ~* 'COCA'
    AND descricao !~* 'ZERO|SEM ACUCAR'
  );

COMMENT ON COLUMN insumos.contagem_critica IS
  'Semanal de segunda: mix (Coca 18 L, demais bags 10 L) e latas';

COMMIT;
