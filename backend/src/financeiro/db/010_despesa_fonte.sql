-- Origem do lançamento: dda (API/arquivo) vs manual (tela).
alter table despesas add column if not exists fonte text
  check (fonte is null or fonte in ('dda', 'manual'));

update despesas
set fonte = 'dda'
where fonte is null
  and (
    documento_ref like 'DDA|%'
    or (forma_pagamento = 'boleto' and documento_ref ~ '^\d{44}$')
  );

update despesas
set fonte = 'manual'
where fonte is null;

create index if not exists despesas_fonte_idx on despesas (fonte);
