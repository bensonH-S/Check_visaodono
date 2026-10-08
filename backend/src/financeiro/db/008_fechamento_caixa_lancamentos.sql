-- Lançamentos de despesa e depósito no caixa do dia.

alter table fechamento_caixa
  add column if not exists depositos_caixa numeric(14, 2) not null default 0;

create table if not exists fechamento_caixa_lancamentos (
  id uuid primary key default gen_random_uuid(),
  fechamento_id uuid not null references fechamento_caixa(id) on delete cascade,
  tipo text not null check (tipo in ('despesa', 'deposito')),
  valor numeric(14, 2) not null default 0,
  plano_conta_id uuid references plano_contas(id),
  fornecedor_id uuid references fornecedores(id),
  numero text not null default '',
  descricao text not null default '',
  criado_em timestamptz not null default now()
);

create index if not exists fechamento_caixa_lancamentos_dia_idx
  on fechamento_caixa_lancamentos (fechamento_id);

alter table fechamento_caixa_lancamentos
  add column if not exists fornecedor_nome text not null default '';
alter table fechamento_caixa_lancamentos
  add column if not exists comprovante_arquivo text;
alter table fechamento_caixa_lancamentos
  add column if not exists comprovante_nome text not null default '';
