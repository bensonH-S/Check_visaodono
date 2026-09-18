-- Agenda Platlog (eSupri VERONICA) para as lojas com código no portal.
-- NFs entram em estoque_nfe para conferência/entrada no app. Inativo até ligar na tela,
-- exceto quem já tinha config (ON CONFLICT DO NOTHING).

INSERT INTO estoque_sync_fornecedor (fornecedor, id_loja, ativo, horario, limite)
SELECT 'platlog', l.id_loja, TRUE, '05:00'::time, 20
FROM lojas l
WHERE COALESCE(l.is_active, TRUE)
  AND regexp_replace(COALESCE(l.bk_number, ''), '\D', '', 'g') IN (
    '19929','23531','18915','23194','24820','21583','31614','32555',
    '31608','31782','33104','30784','27984','30769','25261','20415',
    '23240','30797','32338','15022'
  )
ON CONFLICT (fornecedor, id_loja) DO NOTHING;

-- Coca/Brasal só nas lojas com login Conecta validado (CNPJ).
INSERT INTO estoque_sync_fornecedor (fornecedor, id_loja, ativo, horario, limite)
SELECT 'coca', l.id_loja, FALSE, '05:30'::time, 20
FROM lojas l
WHERE COALESCE(l.is_active, TRUE)
  AND regexp_replace(COALESCE(l.bk_number, ''), '\D', '', 'g') IN (
    '23531','23240','33104','30784'
  )
ON CONFLICT (fornecedor, id_loja) DO NOTHING;
