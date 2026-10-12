-- Free Control → Contas a Pagar (lote semanal).
alter table despesas add column if not exists freecontrol_tipo text;

do $$
declare nome text;
begin
  for nome in
    select conname from pg_constraint
    where conrelid = 'despesas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%fonte%'
  loop
    execute format('alter table despesas drop constraint %I', nome);
  end loop;
end $$;

alter table despesas add constraint despesas_fonte_check
  check (fonte is null or fonte in ('dda', 'manual', 'nfe', 'freecontrol'));

do $$
declare nome text;
begin
  for nome in
    select conname from pg_constraint
    where conrelid = 'despesas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%freecontrol_tipo%'
  loop
    execute format('alter table despesas drop constraint %I', nome);
  end loop;
end $$;

alter table despesas add constraint despesas_freecontrol_tipo_check
  check (
    freecontrol_tipo is null
    or freecontrol_tipo in ('freelance', 'treinamento', 'despesa')
  );

create index if not exists despesas_fonte_freecontrol_idx
  on despesas (fonte)
  where fonte = 'freecontrol';

create index if not exists despesas_freecontrol_tipo_idx
  on despesas (freecontrol_tipo)
  where freecontrol_tipo is not null;
