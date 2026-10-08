-- Garante PK em despesas. Coletas antigas gravaram título sem id.
update despesas set id = gen_random_uuid() where id is null;
alter table despesas alter column id set default gen_random_uuid();
alter table despesas alter column id set not null;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'finance.despesas'::regclass and contype = 'p'
  ) then
    alter table despesas add primary key (id);
  end if;
end $$;
