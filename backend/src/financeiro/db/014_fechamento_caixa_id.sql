-- O recebimento do PDV gravava o dia sem id: a coluna ficou sem default
-- (a tabela já existia quando o CREATE TABLE IF NOT EXISTS rodou) e o INSERT
-- não informava id. O calendário ignora linha sem id e o dia aparece "Sem dados".

update fechamento_caixa
set id = gen_random_uuid()
where id is null;

alter table fechamento_caixa
  alter column id set default gen_random_uuid();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'finance'
      and table_name = 'fechamento_caixa'
      and column_name = 'id'
      and is_nullable = 'YES'
  ) then
    alter table fechamento_caixa alter column id set not null;
  end if;
end $$;
