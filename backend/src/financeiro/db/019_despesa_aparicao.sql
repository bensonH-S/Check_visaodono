-- Semana anterior fica registrada. O valor que conta é o da semana vigente.
alter table despesas add column if not exists excluida_manualmente boolean not null default false;

create table if not exists despesa_aparicoes (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid not null references despesas (id) on delete cascade,
  vencimento date not null,
  valor numeric(14, 2) not null,
  valor_face numeric(14, 2),
  juros numeric(14, 2) not null default 0,
  multa numeric(14, 2) not null default 0,
  conta boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (despesa_id, vencimento)
);

create index if not exists despesa_aparicoes_vencimento_idx
  on despesa_aparicoes (vencimento);
