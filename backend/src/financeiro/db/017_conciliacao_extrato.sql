-- Conciliação bancária por upload de extrato (OFX/CSV).
-- Só saídas (pagar) no MVP. Entrada/adquirente fica para depois.
-- O núcleo legado às vezes nasceu sem PK; garante unique em id antes do FK.

alter table if exists contas_bancarias alter column id set default gen_random_uuid();
update contas_bancarias set id = gen_random_uuid() where id is null;
create unique index if not exists contas_bancarias_id_uidx on contas_bancarias (id);

alter table if exists empresas alter column id set default gen_random_uuid();
update empresas set id = gen_random_uuid() where id is null;
create unique index if not exists empresas_id_uidx on empresas (id);

alter table if exists despesas alter column id set default gen_random_uuid();
update despesas set id = gen_random_uuid() where id is null;
create unique index if not exists despesas_id_uidx on despesas (id);

create table if not exists extrato_arquivos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas_bancarias (id) on delete cascade,
  nome_arquivo text not null,
  formato text not null check (formato in ('ofx', 'csv')),
  hash text not null,
  de date,
  ate date,
  qtd_linhas int not null default 0,
  importado_em timestamptz not null default now(),
  unique (conta_id, hash)
);

create table if not exists extrato_lancamentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas_bancarias (id) on delete cascade,
  empresa_id uuid not null references empresas (id) on delete cascade,
  arquivo_id uuid references extrato_arquivos (id) on delete set null,
  evento_id text not null,
  operacao text not null check (operacao in ('D', 'C')),
  estorno boolean not null default false,
  data_contabil date not null,
  data_evento date,
  valor numeric(14, 2) not null,
  historico text,
  documento_ref text,
  despesa_id uuid references despesas (id) on delete set null,
  status text not null default 'pendente'
    check (status in ('pendente', 'sugerido', 'conciliado', 'sem_par')),
  sugerido_despesa_id uuid references despesas (id) on delete set null,
  importado_em timestamptz not null default now(),
  unique (conta_id, evento_id)
);

create index if not exists extrato_lancamentos_conta_data_idx
  on extrato_lancamentos (conta_id, data_contabil, operacao);

create index if not exists extrato_lancamentos_despesa_idx
  on extrato_lancamentos (despesa_id)
  where despesa_id is not null;

-- Planilha .xlsx do banco entra no mesmo extrato.
do $$
declare nome text;
begin
  for nome in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'extrato_arquivos'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%formato%'
  loop
    execute format('alter table extrato_arquivos drop constraint %I', nome);
  end loop;
end $$;

alter table extrato_arquivos
  add constraint extrato_arquivos_formato_check
  check (formato in ('ofx', 'csv', 'xlsx'));
