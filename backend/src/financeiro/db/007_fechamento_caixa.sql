-- Fechamento de caixa por loja e dia. Gate operacional: dinheiro + PIX.

create table if not exists fechamento_caixa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  data date not null,
  dinheiro numeric(14, 2) not null default 0,
  pix numeric(14, 2) not null default 0,
  debito numeric(14, 2) not null default 0,
  credito numeric(14, 2) not null default 0,
  cart_digital numeric(14, 2) not null default 0,
  ifood numeric(14, 2) not null default 0,
  azul numeric(14, 2) not null default 0,
  rappi numeric(14, 2) not null default 0,
  food99 numeric(14, 2) not null default 0,
  despesas_caixa numeric(14, 2) not null default 0,
  observacao text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho', 'conferido', 'fechado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, data)
);

create index if not exists fechamento_caixa_empresa_data_idx on fechamento_caixa (empresa_id, data);
create index if not exists fechamento_caixa_data_idx on fechamento_caixa (data);
